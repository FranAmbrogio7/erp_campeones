import requests
import os
# Si lo corres local, necesitas python-dotenv, si es en VPS asegúrate de tener las vars de entorno
try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

# --- CONFIGURACIÓN ---
ACCESS_TOKEN = os.getenv('TIENDANUBE_ACCESS_TOKEN')
USER_ID = os.getenv('TIENDANUBE_USER_ID')

# 👇👇 AQUÍ PONDRÁS TU DOMINIO REAL CUANDO LO TENGAS 👇👇
# Ejemplo: "https://mi-erp-campeones.com" o la IP "https://142.33.22.11"
DOMINIO_PRODUCCION = "https://TU_DOMINIO_REAL_AQUI.com" 

# Ruta completa al webhook
WEBHOOK_URL = f"{DOMINIO_PRODUCCION}/api/webhooks/tn/orders"

def registrar():
    if "TU_DOMINIO_REAL" in DOMINIO_PRODUCCION:
        print("⚠️  ERROR: Debes editar el script y poner tu dominio real en la variable DOMINIO_PRODUCCION")
        return

    url = f"https://api.tiendanube.com/v1/{USER_ID}/webhooks"
    
    headers = {
        "Authentication": f"bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Evento: order/created (Cuando entra el pedido)
    # También podrías registrar 'order/paid' si prefieres descontar stock solo al pagar
    data = {
        "event": "order/created",
        "url": WEBHOOK_URL
    }
    
    print(f"📡 Configurando Tienda Nube para enviar avisos a: {WEBHOOK_URL}")
    
    # 1. Primero intentamos borrar si ya existía para no duplicar (Opcional, pero limpio)
    # (Requiere listar webhooks primero, lo saltamos para simplicidad)

    # 2. Crear Webhook
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 201:
        print("✅ ¡ÉXITO! Tu ERP ahora recibirá las ventas automáticamente.")
        print(f"ID del Webhook: {response.json().get('id')}")
    else:
        print(f"❌ Error ({response.status_code}): {response.text}")

if __name__ == "__main__":
    registrar()