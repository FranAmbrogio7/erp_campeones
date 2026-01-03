from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import ProductoVariante
import os
import hmac
import hashlib
import requests  # <--- IMPORTANTE: Necesitamos esto para llamar a la API

bp = Blueprint('webhooks', __name__)

def verify_hmac(data, hmac_header):
    client_secret = os.getenv('TIENDANUBE_CLIENT_SECRET')
    if not client_secret or not hmac_header:
        return True 
    
    signature = hmac.new(
        client_secret.encode('utf-8'),
        data,
        hashlib.sha256
    ).hexdigest()
    
    return signature == hmac_header

@bp.route('/tn/orders', methods=['POST'])
def handle_tn_order():
    # 1. Seguridad
    hmac_header = request.headers.get('X-LinkedStore-HMAC-SHA256')
    if not verify_hmac(request.get_data(), hmac_header):
        return jsonify({"error": "Invalid signature"}), 401

    data = request.get_json()
    topic = request.headers.get('X-Topic') or data.get('event')
    store_id = request.headers.get('X-LinkedStore-Id') or data.get('store_id')
    order_id = data.get('id')

    print(f"🔔 Webhook recibido: {topic} (ID Orden: {order_id})")

    try:
        if topic == 'order/created' or topic == 'order/paid':
            products_tn = data.get('products', [])

            # --- NUEVA LÓGICA: Si no hay productos, los buscamos en la API ---
            if not products_tn and order_id:
                print(f"🔎 Lista vacía. Consultando API de Tienda Nube para orden #{order_id}...")
                
                access_token = os.getenv('TIENDANUBE_ACCESS_TOKEN')
                url = f"https://api.tiendanube.com/v1/{store_id}/orders/{order_id}"
                headers = {
                    "Authentication": f"bearer {access_token}",
                    "User-Agent": "ERP Campeones (External App)"
                }
                
                response = requests.get(url, headers=headers)
                
                if response.status_code == 200:
                    full_order = response.json()
                    products_tn = full_order.get('products', [])
                    print(f"✅ Datos recuperados: {len(products_tn)} productos encontrados.")
                else:
                    print(f"❌ Error consultando API: {response.text}")
            # ----------------------------------------------------------------

            # Procesar los productos encontrados
            for item in products_tn:
                # Tienda Nube a veces usa 'variant_sku' o 'sku'
                sku = item.get('variant_sku') or item.get('sku')
                cantidad = int(item.get('quantity', 1))
                name = item.get('name', 'Producto desconocido')
                
                if sku:
                    # Buscamos en nuestro ERP (Ignorando mayúsculas/minúsculas)
                    variante = ProductoVariante.query.filter(ProductoVariante.codigo_sku == sku).first()
                    
                    if variante and variante.inventario:
                        stock_antes = variante.inventario.stock_actual
                        variante.inventario.stock_actual -= cantidad
                        print(f"   ⬇️ DESCONTADO: {sku} | {name} (Stock: {stock_antes} -> {variante.inventario.stock_actual})")
                    else:
                        print(f"   ⚠️ SKU NO ENCONTRADO: {sku} ({name}) - Revisa que coincida exactamente.")
                else:
                    print(f"   ⚠️ Producto sin SKU en Tienda Nube: {name}")

            db.session.commit()
            return jsonify({"msg": "Procesado"}), 200
        
        return jsonify({"msg": "Ignorado"}), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc() # Esto imprimirá el error detallado si falla
        return jsonify({"error": str(e)}), 500