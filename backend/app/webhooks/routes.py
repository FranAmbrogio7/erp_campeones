from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import ProductoVariante
import requests
import json
import os
import hmac
import hashlib

bp = Blueprint('webhooks', __name__)

# Función de seguridad (Opcional pero recomendada para producción)
def verify_hmac(data, hmac_header):
    client_secret = os.getenv('TIENDANUBE_CLIENT_SECRET') # Necesitas esto en tu .env
    if not client_secret or not hmac_header:
        return True # Si no hay secreto configurado, dejamos pasar (Modo permisivo)
    
    signature = hmac.new(
        client_secret.encode('utf-8'),
        data,
        hashlib.sha256
    ).hexdigest()
    
    return signature == hmac_header

@bp.route('/tn/orders', methods=['POST'])
def handle_tn_order():
    # 1. Seguridad: Verificar que el mensaje viene de Tienda Nube
    hmac_header = request.headers.get('X-LinkedStore-HMAC-SHA256')
    if not verify_hmac(request.get_data(), hmac_header):
        return jsonify({"error": "Invalid signature"}), 401

    data = request.get_json()
    topic = request.headers.get('X-Topic') or data.get('event')
    store_id = request.headers.get('X-LinkedStore-Id') or data.get('store_id')

    print(f"🔔 Webhook recibido: {topic} (Tienda {store_id})")

    try:
        # 2. Procesar solo órdenes Creadas o Pagadas
        if topic == 'order/created' or topic == 'order/paid':
            # Tienda Nube a veces envía la orden completa o solo un ID. 
            # Asumimos que recibimos la data de la orden.
            products_tn = data.get('products', [])
            
            # Recorremos los productos comprados
            for item in products_tn:
                sku = item.get('sku')
                cantidad = int(item.get('quantity', 1))
                
                if sku:
                    # Buscamos en nuestro ERP
                    variante = ProductoVariante.query.filter_by(codigo_sku=sku).first()
                    
                    if variante and variante.inventario:
                        # DESCONTAMOS STOCK
                        print(f"   ⬇️ Descontando {cantidad} u. de {sku} (Stock antes: {variante.inventario.stock_actual})")
                        variante.inventario.stock_actual -= cantidad
                    else:
                        print(f"   ⚠️ SKU {sku} vendido en web pero no encontrado en ERP.")

            db.session.commit()
            return jsonify({"msg": "Stock actualizado"}), 200
        
        # Respondemos 200 a otros eventos para que TN no reintente
        return jsonify({"msg": "Evento ignorado"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error webhook: {e}")
        return jsonify({"error": str(e)}), 500