from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import ProductoVariante
import os
import hmac
import hashlib
import requests
import json
import traceback

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

@bp.route('/tn/orders', methods=['POST'], strict_slashes=False)
def handle_tn_order():
    print("🏁 INICIO DEL WEBHOOK") # Checkpoint 1

    # 1. Seguridad
    hmac_header = request.headers.get('X-LinkedStore-HMAC-SHA256')
    if not verify_hmac(request.get_data(), hmac_header):
        print("❌ Error de firma HMAC")
        return jsonify({"error": "Invalid signature"}), 401

    data = request.get_json()
    topic = request.headers.get('X-Topic') or data.get('event')
    store_id = request.headers.get('X-LinkedStore-Id') or data.get('store_id')
    order_id = data.get('id')

    print(f"🔔 Webhook recibido: {topic} (ID Orden: {order_id})")

    try:
        # Checkpoint 2
        print(f"👉 Analizando evento... ¿Es order/created? {'SÍ' if topic == 'order/created' else 'NO'}")

        if topic == 'order/created' or topic == 'order/paid':
            products_tn = data.get('products', [])

            # Si la lista viene vacía, consultamos la API
            if not products_tn and order_id:
                print(f"🔎 Lista vacía. Consultando API para orden #{order_id}...") # Checkpoint 3
                
                access_token = os.getenv('TIENDANUBE_ACCESS_TOKEN')
                user_id = os.getenv('TIENDANUBE_USER_ID') # A veces ayuda loguearlo
                
                # Checkpoint 4 (Verificar Token - Solo primeros caracteres)
                if access_token:
                    print(f"🔑 Token detectado: {access_token[:5]}...")
                else:
                    print("❌ ERROR CRÍTICO: No hay TIENDANUBE_ACCESS_TOKEN en .env")

                url = f"https://api.tiendanube.com/v1/{store_id}/orders/{order_id}"
                headers = {
                    "Authentication": f"bearer {access_token}",
                    "User-Agent": "ERP Campeones (External App)"
                }
                
                print(f"🚀 Enviando petición a: {url}") # Checkpoint 5
                response = requests.get(url, headers=headers)
                
                print(f"📡 Respuesta API: {response.status_code}") # Checkpoint 6
                
                if response.status_code == 200:
                    full_order = response.json()
                    products_tn = full_order.get('products', [])
                    print(f"✅ Datos recuperados: {len(products_tn)} productos.")
                else:
                    print(f"❌ Error API: {response.text}")

            # Procesar productos
            print(f"🔄 Procesando {len(products_tn)} productos...") # Checkpoint 7
            
            for item in products_tn:
                sku = item.get('variant_sku') or item.get('sku')
                cantidad = int(item.get('quantity', 1))
                name = item.get('name', 'Producto desconocido')
                
                print(f"   🔸 Revisando: {name} (SKU: {sku})") # Checkpoint 8
                
                if sku:
                    variante = ProductoVariante.query.filter(ProductoVariante.codigo_sku == sku).first()
                    
                    if variante:
                        print(f"      ✅ ENCONTRADO EN BD. Stock actual: {variante.inventario.stock_actual}")
                        if variante.inventario:
                            variante.inventario.stock_actual -= cantidad
                            print(f"      ⬇️ DESCONTADO. Nuevo stock: {variante.inventario.stock_actual}")
                        else:
                            print("      ❌ Error: El producto existe pero no tiene registro de inventario asociado.")
                    else:
                        print(f"      ⚠️ NO ENCONTRADO EN BD: El SKU '{sku}' no existe en tu base de datos.")
                else:
                    print("      ⚠️ Item sin SKU.")

            db.session.commit()
            print("💾 Cambios guardados en DB.")
            return jsonify({"msg": "Procesado"}), 200
        
        return jsonify({"msg": "Ignorado"}), 200

    except Exception as e:
        db.session.rollback()
        print("🔥 ERROR FATAL EN EL CÓDIGO:")
        traceback.print_exc() # Esto imprimirá el error exacto
        return jsonify({"error": str(e)}), 500