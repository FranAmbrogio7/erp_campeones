from flask import Blueprint, jsonify, request
from app.extensions import db
# Ajusta estos imports según dónde tengas tus modelos realmente. 
# Basado en lo que vimos antes, NotaCredito suele estar en app.sales.models
from app.sales.models import SesionCaja, MovimientoCaja, Venta, NotaCredito
from app.products.models import ProductoVariante, Inventario
from flask_jwt_extended import jwt_required
from app.services.tiendanube_service import tn_service
from datetime import datetime
import string
import random

bp = Blueprint('returns', __name__)

# --- FUNCIÓN AUXILIAR PARA GENERAR CÓDIGO ÚNICO ---
def generar_codigo_nota():
    """Genera un código tipo NC-A1B2C3"""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(random.choice(chars) for _ in range(6))
    return f"NC-{code}"

@bp.route('/process', methods=['POST'])
@jwt_required()
def process_returns():
    data = request.get_json()
    items_in = data.get('items_in', [])   # Productos que ENTRAN (Devolución)
    items_out = data.get('items_out', []) # Productos que SALEN (Cambio)
    
    # Datos opcionales para la nota
    sale_id = data.get('sale_id', '?') 

    try:
        # 1. PROCESAR ENTRADAS (Devolver al stock)
        # ========================================
        total_in = 0
        for item in items_in:
            variante = ProductoVariante.query.get(item['id_variante'])
            if variante and variante.inventario:
                # A. Actualizar Local (+1)
                variante.inventario.stock_actual += 1
                precio_item = float(variante.producto.precio) # O el precio histórico si lo tienes
                total_in += precio_item

                # B. Sincronizar con TIENDA NUBE (Entrada) ☁️
                if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
                    print(f"🔄 Devolución: Aumentando stock TN para {variante.codigo_sku}...")
                    try:
                        tn_service.update_variant_stock(
                            tn_product_id=variante.producto.tiendanube_id,
                            tn_variant_id=variante.tiendanube_variant_id,
                            new_stock=variante.inventario.stock_actual
                        )
                    except Exception as e:
                        print(f"⚠️ Error Sync TN (Entrada): {e}")

        # 2. PROCESAR SALIDAS (Restar del stock)
        # ======================================
        total_out = 0
        for item in items_out:
            variante = ProductoVariante.query.get(item['id_variante'])
            if variante and variante.inventario:
                # Validar stock
                if variante.inventario.stock_actual < 1:
                    db.session.rollback()
                    return jsonify({"msg": f"Sin stock para cambio: {variante.producto.nombre}"}), 400

                # A. Actualizar Local (-1)
                variante.inventario.stock_actual -= 1
                precio_item = float(variante.producto.precio)
                total_out += precio_item

                # B. Sincronizar con TIENDA NUBE (Salida) ☁️
                if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
                    print(f"🔄 Cambio: Descontando stock TN para {variante.codigo_sku}...")
                    try:
                        tn_service.update_variant_stock(
                            tn_product_id=variante.producto.tiendanube_id,
                            tn_variant_id=variante.tiendanube_variant_id,
                            new_stock=variante.inventario.stock_actual
                        )
                    except Exception as e:
                         print(f"⚠️ Error Sync TN (Salida): {e}")

        # 3. LÓGICA DE SALDO / NOTA DE CRÉDITO
        # ====================================
        # Si total_out (lo que se lleva) - total_in (lo que devuelve) es negativo,
        # significa que le debemos dinero al cliente.
        balance = total_out - total_in
        nota_credito_info = None

        if balance < 0:
            monto_a_favor = abs(balance)
            
            # A. Generar Código Único
            codigo_nc = generar_codigo_nota()
            # Asegurarnos de que no exista
            while NotaCredito.query.filter_by(codigo=codigo_nc).first():
                codigo_nc = generar_codigo_nota()

            # B. CREAR Y GUARDAR EN BASE DE DATOS
            nueva_nota = NotaCredito(
                codigo=codigo_nc,
                monto=monto_a_favor,
                fecha_emision=datetime.now(),
                estado='activa',
                observaciones=f"Generada por cambio/devolución Venta #{sale_id}"
            )
            db.session.add(nueva_nota)
            
            # C. Preparar respuesta para el frontend
            nota_credito_info = {
                "codigo": codigo_nc,
                "monto": monto_a_favor
            }
            print(f"✅ Nota de Crédito creada: {codigo_nc} por ${monto_a_favor}")
        
        # Si el balance es positivo (> 0), el cliente debe pagar la diferencia.
        # (Esa lógica se suele manejar en caja como un ingreso extra, aquí solo movemos stock)

        db.session.commit()
        
        return jsonify({
            "msg": "Proceso completado correctamente", 
            "stock_updated": True,
            "nota_credito": nota_credito_info # Enviamos el objeto o null
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error crítico en process_returns: {e}")
        return jsonify({"msg": "Error al procesar la operación", "error": str(e)}), 500