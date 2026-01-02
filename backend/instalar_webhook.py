import requests
import os
from dotenv import load_dotenv

load_dotenv('/var/www/erp_campeones/backend/.env') # Cargar claves reales

# TUS DATOS DEL .ENV
ACCESS_TOKEN = os.getenv('TIENDANUBE_ACCESS_TOKEN')
USER_ID = os.getenv('TIENDANUBE_USER_ID')

# ¡¡USA TU IP PÚBLICA AQUÍ!! (No la 100.x.x.x)
IP_PUBLICA = "http://72.61.219.128" 
WEBHOOK_URL = f"{IP_PUBLICA}/api/webhooks/tn/orders"

def registrar():
    url = f"https://api.tiendanube.com/v1/{USER_ID}/webhooks"
    headers = {
        "Authentication": f"bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Evento: Orden Creada
    data = {
        "event": "order/created",
        "url": WEBHOOK_URL
    }
    
    print(f"📡 Registrando en Tienda Nube: {WEBHOOK_URL}")
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 201:
        print("✅ ¡Webhook registrado con éxito!")
    else:
        print(f"❌ Error: {response.text}")

if __name__ == "__main__":
    registrar()