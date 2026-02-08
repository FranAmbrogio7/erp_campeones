# backend/app/returns/routes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import db
# IMPORTANTE: Importamos ProductoVariante para acceder a los IDs de Tienda Nube
from app.products.models import Inventario, ProductoVariante
from app.sales.models import Venta, DetalleVenta, NotaCredito, VentaPago
from datetime import datetime, timedelta
# IMPORTANTE: Servicio de Tienda Nube
from app.services.tiendanube_service import tn_service

bp = Blueprint('returns', __name__, url_prefix='/api/returns')

# --- FUNCIÓN AUXILIAR HORA ARGENTINA ---
def ahora_argentina():
    return datetime.utcnow() - timedelta(hours=3)

@bp.route('/process', methods=['POST'])
@jwt_required()
def process_return():
    data = request.get_json()
    items_in = data.get('items_in', [])   # Entran (Cliente devuelve) -> Stock +1
    items_out = data.get('items_out', []) # Salen (Cliente lleva)   -> Stock -1
    
    metodo_pago_id = data.get('metodo_pago_id')
    # diferencia_pago no lo usamos directo, usamos 'balance' calculado

    try:
        # 1. PROCESAR ENTRADAS (Devolución) -> Sumar Stock
        total_in = 0
        for item in items_in:
            var_id = item.get('id_variante')
            
            # Buscamos la variante para tener los IDs de TN
            variante = ProductoVariante.query.get(var_id)
            
            if variante and variante.inventario:
                # 1.1 Local
                variante.inventario.stock_actual += 1
                
                # 1.2 Tienda Nube
                if variante.producto.tiendanube_id and variante.tiendanube_variant_id:
                    try:
                        tn_service.update_variant_stock(
                            tn_product_id=variante.producto.tiendanube_id,
                            tn_variant_id=variante.tiendanube_variant_id,
                            new_stock=variante.inventario.stock_actual
                        )
                    except Exception as e:
                        print(f"Error Sync TN (Returns In): {e}")

            total_in += float(item.get('precio', 0))

        # 2. PROCESAR SALIDAS (Cambio) -> Restar Stock
        total_out = 0
        for item in items_out:
            var_id = item.get('id_variante')
            variante = ProductoVariante.query.get(var_id)
            
            if variante and variante.inventario:
                # 1.1 Local
                variante.inventario.stock_actual -= 1
                
                # 1.2 Tienda Nube
                if variante.producto.tiendanube_id and variante.tiendanube_variant_id:
                    try:
                        tn_service.update_variant_stock(
                            tn_product_id=variante.producto.tiendanube_id,
                            tn_variant_id=variante.tiendanube_variant_id,
                            new_stock=variante.inventario.stock_actual
                        )
                    except Exception as e:
                        print(f"Error Sync TN (Returns Out): {e}")

            total_out += float(item.get('precio', 0))

        # 3. BALANCE FINANCIERO
        balance = total_out - total_in
        nota_credito = None

        # CASO A: Saldo a favor del cliente -> Nota de Crédito
        if balance < 0:
            monto_nota = abs(balance)
            # Código único basado en timestamp para evitar duplicados
            codigo_unico = f"NC-{int(datetime.utcnow().timestamp())}"
            
            nota_credito = NotaCredito(
                codigo=codigo_unico,
                monto=monto_nota,
                fecha_emision=datetime.utcnow(), # <--- HORA
                estado='activa',
                observaciones="Generada por cambio/devolución"
            )
            db.session.add(nota_credito)

        # CASO B: Cliente debe pagar diferencia -> Venta
        if balance > 0 and metodo_pago_id:
            nueva_venta = Venta(
                fecha_venta=datetime.utcnow(), # <--- HORA
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
                    id_variante=item.get('id_variante'),
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