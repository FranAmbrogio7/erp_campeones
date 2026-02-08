from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.products.models import Inventario
from app.sales.models import Venta, DetalleVenta, NotaCredito
from datetime import datetime

bp = Blueprint('returns', __name__, url_prefix='/api/returns')

@bp.route('/process', methods=['POST'])
@jwt_required()
def process_return():
    data = request.get_json()
    items_in = data.get('items_in', [])
    items_out = data.get('items_out', [])
    
    # Datos de pago
    metodo_pago_id = data.get('metodo_pago_id')
    # diferencia_pago = data.get('diferencia_pago', 0) # No lo usamos directo, usamos 'balance'

    try:
        # 1. ACTUALIZAR STOCK (Devolución: Sumar)
        total_in = 0
        for item in items_in:
            var_id = item.get('id_variante')
            inventario = Inventario.query.filter_by(id_variante=var_id).first()
            if inventario:
                inventario.stock_actual += 1
            total_in += float(item.get('precio', 0))

        # 2. ACTUALIZAR STOCK (Cambio: Restar)
        total_out = 0
        for item in items_out:
            var_id = item.get('id_variante')
            inventario = Inventario.query.filter_by(id_variante=var_id).first()
            if inventario:
                inventario.stock_actual -= 1
            total_out += float(item.get('precio', 0))

        balance = total_out - total_in
        nota_credito = None

        # 3. GENERAR NOTA DE CRÉDITO (Si sobra plata al cliente)
        if balance < 0:
            monto_nota = abs(balance)
            codigo_unico = f"NC-{int(datetime.utcnow().timestamp())}"
            nota_credito = NotaCredito(
                codigo=codigo_unico,
                monto=monto_nota,
                fecha_emision=ahora_argentina(),
                estado='activa'
            )
            db.session.add(nota_credito)
            db.session.commit()

        # 4. REGISTRAR VENTA (Si el cliente paga diferencia)
        if balance > 0 and metodo_pago_id:
            nueva_venta = Venta(
                fecha_venta=datetime.utcnow(),
                subtotal=balance, # En un cambio, el subtotal es la diferencia a pagar
                descuento=0,
                total=balance,
                id_metodo_pago=metodo_pago_id,
                observaciones="Generada por CAMBIO/DEVOLUCIÓN"
                # ELIMINADO: usuario_id (Tu base de datos no tiene este campo en Venta)
            )
            db.session.add(nueva_venta)
            db.session.flush() # Para obtener el ID de la venta antes de guardar detalles

            # Registramos los items que salieron como detalle de esta "mini venta"
            for item in items_out:
                detalle = DetalleVenta(
                    id_venta=nueva_venta.id_venta,
                    id_variante=item.get('id_variante'),
                    producto_nombre=item.get('nombre'),
                    cantidad=1,
                    precio_unitario=item.get('precio'),
                    subtotal=item.get('precio')
                )
                db.session.add(detalle)

        db.session.commit()

        return jsonify({
            "msg": "Procesado correctamente",
            "nota_credito": {
                "codigo": nota_credito.codigo,
                "monto": nota_credito.monto
            } if nota_credito else None
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error en returns: {e}") # Para ver el error en la consola del servidor
        return jsonify({"msg": f"Error en transacción: {str(e)}"}), 500