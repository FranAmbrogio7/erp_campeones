# backend/app/returns/routes.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.extensions import db
# IMPORTANTE: Importamos ProductoVariante para acceder a los IDs de Tienda Nube
from app.products.models import Inventario, ProductoVariante
from app.sales.models import Venta, DetalleVenta, NotaCredito, VentaPago, SesionCaja
from app.sales.routes import sync_tn_background
from datetime import datetime, timedelta
import threading

bp = Blueprint('returns', __name__, url_prefix='/api/returns')

# --- FUNCIÓN AUXILIAR HORA ARGENTINA ---
def ahora_argentina():
    return datetime.utcnow() - timedelta(hours=3)


def _es_item_custom(item):
    """Los ítems de 'Anotador Libre' no están vinculados a stock real."""
    valor = item.get('is_custom')
    return valor is True or str(valor).lower() == 'true'


def _parse_precio(item):
    """Devuelve (precio, error). error es un mensaje listo para el cliente si el precio es inválido."""
    nombre = item.get('nombre', 'un artículo')
    try:
        precio = float(item.get('precio', 0))
    except (TypeError, ValueError):
        return None, f"Precio inválido para '{nombre}'"
    if precio < 0:
        return None, f"Precio inválido para '{nombre}'"
    return precio, None


@bp.route('/process', methods=['POST'])
@jwt_required()
def process_return():
    data = request.get_json()
    items_in = data.get('items_in', [])   # Entran (Cliente devuelve) -> Stock +1
    items_out = data.get('items_out', []) # Salen (Cliente lleva)   -> Stock -1

    metodo_pago_id = data.get('metodo_pago_id')

    if not items_in and not items_out:
        return jsonify({"msg": "No hay artículos para procesar"}), 400

    # El frontend ya bloquea la pantalla si la caja está cerrada, pero el
    # endpoint en sí nunca lo verificaba (a diferencia de /sales/checkout).
    # Sin esto, un cambio procesado con la caja cerrada mueve stock y hasta
    # genera una venta/nota de crédito que no queda dentro de ninguna
    # sesión de caja, y por lo tanto no aparece en los totales del turno.
    sesion_activa = SesionCaja.query.filter_by(estado='abierta', tipo_caja='PRINCIPAL').first()
    if not sesion_activa:
        return jsonify({"msg": "No se puede procesar el cambio: la caja está cerrada."}), 400

    # Guardamos los syncs de Tienda Nube para dispararlos recién después del
    # commit, en un hilo aparte (igual que /sales/checkout). Antes se hacía
    # una llamada HTTP a TN por cada ítem DENTRO de la transacción: con un
    # cambio de varios artículos la request podía tardar varios segundos,
    # lo que además ampliaba la ventana para un doble envío accidental.
    items_to_sync = []

    try:
        # 1. PROCESAR ENTRADAS (Devolución) -> Sumar Stock
        total_in = 0
        for item in items_in:
            precio, error = _parse_precio(item)
            if error:
                db.session.rollback()
                return jsonify({"msg": error}), 400

            variante = None
            if not _es_item_custom(item):
                var_id = item.get('id_variante')
                variante = ProductoVariante.query.get(var_id)
                if not variante:
                    db.session.rollback()
                    return jsonify({"msg": f"El producto '{item.get('nombre', 'desconocido')}' ya no existe en el catálogo."}), 400

                # Si la variante nunca tuvo un registro de inventario, lo
                # creamos ahora en vez de perder el ingreso de stock en
                # silencio (como pasaba antes).
                if not variante.inventario:
                    variante.inventario = Inventario(id_variante=variante.id_variante, stock_actual=0)
                    db.session.add(variante.inventario)

                variante.inventario.stock_actual += 1

                if variante.producto.tiendanube_id and variante.tiendanube_variant_id:
                    items_to_sync.append({
                        'tn_product_id': variante.producto.tiendanube_id,
                        'tn_variant_id': variante.tiendanube_variant_id,
                        'new_stock': variante.inventario.stock_actual,
                        'nombre': variante.producto.nombre
                    })

            total_in += precio

        # 2. PROCESAR SALIDAS (Cambio) -> Restar Stock
        # Antes esto restaba sin chequear nada, pudiendo dejar el stock en
        # negativo si el ítem se había agregado al ticket con datos viejos
        # (por ejemplo, quedó guardado en el navegador de un día para otro y
        # ese talle ya se vendió por otro lado). Ahora se valida igual que
        # en /sales/checkout, y si falta stock se aborta toda la operación
        # (no se descuenta nada a medias).
        total_out = 0
        for item in items_out:
            precio, error = _parse_precio(item)
            if error:
                db.session.rollback()
                return jsonify({"msg": error}), 400

            variante = None
            if not _es_item_custom(item):
                var_id = item.get('id_variante')
                variante = ProductoVariante.query.get(var_id)
                if not variante:
                    db.session.rollback()
                    return jsonify({"msg": f"El producto '{item.get('nombre', 'desconocido')}' ya no existe en el catálogo."}), 400

                stock_disponible = variante.inventario.stock_actual if variante.inventario else 0
                if stock_disponible <= 0:
                    db.session.rollback()
                    talle = item.get('talle', '')
                    return jsonify({"msg": f"Sin stock disponible para: {variante.producto.nombre} (talle {talle})"}), 400

                variante.inventario.stock_actual -= 1

                if variante.producto.tiendanube_id and variante.tiendanube_variant_id:
                    items_to_sync.append({
                        'tn_product_id': variante.producto.tiendanube_id,
                        'tn_variant_id': variante.tiendanube_variant_id,
                        'new_stock': variante.inventario.stock_actual,
                        'nombre': variante.producto.nombre
                    })

            total_out += precio

        # 3. BALANCE FINANCIERO
        balance = total_out - total_in
        nota_credito = None

        # CASO A: Saldo a favor del cliente -> Nota de Crédito
        if balance < 0:
            monto_nota = abs(balance)
            # Mismo generador que usa /sales/notas-credito/crear, con
            # reintento hasta encontrar un código libre (antes se usaba un
            # timestamp en segundos: dos cambios en el mismo segundo
            # generaban el mismo código y el segundo fallaba con error 500
            # por violar el UNIQUE de la tabla).
            codigo_unico = NotaCredito.generar_codigo()
            while NotaCredito.query.filter_by(codigo=codigo_unico).first():
                codigo_unico = NotaCredito.generar_codigo()

            nota_credito = NotaCredito(
                codigo=codigo_unico,
                monto=monto_nota,
                fecha_emision=ahora_argentina(),
                estado='activa',
                observaciones="Generada por cambio/devolución"
            )
            db.session.add(nota_credito)

        # CASO B: Cliente debe pagar diferencia -> Venta
        if balance > 0:
            if not metodo_pago_id:
                db.session.rollback()
                return jsonify({"msg": "Falta seleccionar el método de pago para la diferencia"}), 400

            nueva_venta = Venta(
                fecha_venta=ahora_argentina(),
                subtotal=balance,
                descuento=0,
                total=balance,
                id_metodo_pago=metodo_pago_id,
                observaciones="Generada por CAMBIO/DEVOLUCIÓN"
            )
            db.session.add(nueva_venta)
            db.session.flush()

            # Detalle genérico para la venta
            for item in items_out:
                detalle = DetalleVenta(
                    id_venta=nueva_venta.id_venta,
                    id_variante=item.get('id_variante') if not _es_item_custom(item) else None,
                    producto_nombre=f"CAMBIO: {item.get('nombre')}",
                    cantidad=1,
                    precio_unitario=item.get('precio'),
                    subtotal=item.get('precio')
                )
                db.session.add(detalle)

            # Registrar Pago
            pago = VentaPago(
                id_venta=nueva_venta.id_venta,
                id_metodo_pago=metodo_pago_id,
                monto=balance
            )
            db.session.add(pago)

        db.session.commit()

        # Recién ahora, con todo ya confirmado en la base, avisamos a
        # Tienda Nube en segundo plano.
        if items_to_sync:
            app = current_app._get_current_object()
            thread = threading.Thread(target=sync_tn_background, args=(app, items_to_sync))
            thread.start()

        return jsonify({
            "msg": "Procesado correctamente",
            "nota_credito": {
                "codigo": nota_credito.codigo,
                "monto": nota_credito.monto
            } if nota_credito else None
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error en returns: {e}")
        return jsonify({"msg": f"Error en transacción: {str(e)}"}), 500
