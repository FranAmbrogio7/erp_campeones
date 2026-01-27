import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

class TiendaNubeService:
    def __init__(self):
        # 1. CARGA DE CREDENCIALES (Aquí estaba el error, faltaba esto)
        self.access_token = os.getenv('TIENDANUBE_ACCESS_TOKEN')
        self.store_id = os.getenv('TIENDANUBE_STORE_ID')
        self.api_url = f"https://api.tiendanube.com/v1/{self.store_id}" if self.store_id else None
        self.user_agent = "AppGestion (tu_email@ejemplo.com)"
        
        # 2. CONFIGURACIÓN DE PRECIOS
        self.PORCENTAJE_WEB = 1.15  # 15% de aumento para la web

    def _get_headers(self):
        """Helper para headers comunes"""
        return {
            "Authentication": f"bearer {self.access_token}",
            "User-Agent": self.user_agent,
            "Content-Type": "application/json"
        }

    def check_connection(self):
        """Verifica si las credenciales funcionan"""
        if not self.access_token or not self.store_id:
            return {"success": False, "error": "Faltan credenciales en .env"}
        
        try:
            url = f"{self.api_url}/store"
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # --- LÓGICA DE PRECIOS ---

    def calcular_precio_web(self, precio_local):
        """Aplica el recargo web al precio local"""
        if not precio_local: return 0.0
        try:
            precio = float(precio_local)
            return round(precio * self.PORCENTAJE_WEB, 2)
        except ValueError:
            return 0.0

    def update_variant_price(self, tn_product_id, tn_variant_id, precio_local):
        """Actualiza SOLO el precio de una variante"""
        if not self.access_token or not self.api_url: return

        precio_web = self.calcular_precio_web(precio_local)
        
        url = f"{self.api_url}/products/{tn_product_id}/variants/{tn_variant_id}"
        data = {
            "price": precio_web,
            "promotional_price": None # Opcional: podrías ponerlo en null para limpiar ofertas viejas
        }
        
        try:
            requests.put(url, json=data, headers=self._get_headers())
            print(f"✅ TN Sync: Precio actualizado a ${precio_web} (ID: {tn_variant_id})")
        except Exception as e:
            print(f"⚠️ Error actualizando precio en TN: {e}")

    # --- OTROS MÉTODOS DE SINCRONIZACIÓN ---

    def update_variant_stock(self, tn_product_id, tn_variant_id, new_stock):
        if not self.access_token or not self.api_url: return
        
        url = f"{self.api_url}/products/{tn_product_id}/variants/{tn_variant_id}"
        data = {"stock": int(new_stock)} if new_stock is not None else {}
        
        if not data: return

        try:
            requests.put(url, json=data, headers=self._get_headers())
            print(f"✅ TN Sync: Stock actualizado a {new_stock} (ID: {tn_variant_id})")
        except Exception as e:
            print(f"⚠️ Error actualizando stock en TN: {e}")

    def update_product_data(self, tn_product_id, nombre=None, descripcion=None):
        if not self.access_token or not self.api_url: return
        
        url = f"{self.api_url}/products/{tn_product_id}"
        data = {}
        if nombre: data["name"] = {"es": nombre}
        if descripcion: data["description"] = {"es": descripcion}
        
        if not data: return

        try:
            requests.put(url, json=data, headers=self._get_headers())
            print(f"✅ TN Sync: Datos base actualizados (ID: {tn_product_id})")
        except Exception as e:
            print(f"⚠️ Error actualizando producto en TN: {e}")

    def delete_product_in_cloud(self, tn_product_id):
        if not self.access_token or not self.api_url: return
        
        url = f"{self.api_url}/products/{tn_product_id}"
        try:
            requests.delete(url, headers=self._get_headers())
            print(f"🗑️ TN Sync: Producto eliminado (ID: {tn_product_id})")
        except Exception as e:
            print(f"⚠️ Error eliminando de TN: {e}")

    def create_product_in_cloud(self, local_prod):
        """Sube un producto nuevo completo a Tienda Nube"""
        # 1. EL TRY DEBE CUBRIR TODO EL METODO
        try:
            if not self.access_token or not self.api_url: 
                return {"success": False, "error": "No hay credenciales configuradas"}

            # Preparar Variantes
            variants_data = []
            
            # --- VALIDACIÓN DE SEGURIDAD ---
            # Si local_prod no tiene variantes o es None, esto fallaba antes
            if not local_prod:
                raise ValueError("El producto local es None")
                
            for var in local_prod.variantes:
                stock_val = var.inventario.stock_actual if var.inventario else 0
                precio_web = self.calcular_precio_web(local_prod.precio)
                
                # --- OJO AQUÍ ---
                # Verifica si en tu modelo de BD la propiedad es .talla, .talle o .size
                # Si esto falla, ahora el try lo capturará.
                nombre_talle = getattr(var, 'talla', None) or getattr(var, 'talle', "Único")

                variants_data.append({
                    "price": precio_web,
                    "stock": int(stock_val),
                    "sku": var.codigo_sku,
                    "values": [{"es": nombre_talle}] 
                })

            # Payload del Producto
            payload = {
                "name": {"es": local_prod.nombre},
                "description": {"es": local_prod.descripcion or ""},
                # IMPORTANTE: TiendaNube pide definir qué son los valores (ej: "Talle")
                "attributes": [{"es": "Talle"}], 
                "variants": variants_data,
                "images": [] 
            }

            # Request
            url = f"{self.api_url}/products"
            response = requests.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code == 201:
                return {"success": True, "tn_data": response.json()}
            else:
                # Devuelve el error exacto que da TiendaNube
                return {"success": False, "error": f"API Error {response.status_code}: {response.text}"}

        except Exception as e:
            # AHORA SÍ verás el error real en tu consola gracias a esto:
            import traceback
            print("❌ ERROR CRÍTICO EN CREATE_PRODUCT:")
            traceback.print_exc()
            return {"success": False, "error": str(e)}


    def get_order_details(self, order_id):
        if not self.access_token or not self.api_url: return None

        url = f"{self.api_url}/orders/{order_id}"

        try:
            print(f"📥 Descargando detalles de Orden #{order_id} desde API...")
            response = requests.get(url, headers=self._get_headers())

            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Error descargando orden: {response.status_code} - {response.text}")
            return None
        except Exception as e:
            print(f"🔥 Error conexión API: {e}")
            return None

    
    # ==========================================
    # NUEVOS MÉTODOS PARA SINCRONIZAR VARIANTES
    # ==========================================

    def create_variant_in_cloud(self, tn_product_id, local_variant):
        """
        Crea una variante específica en un producto existente de Tienda Nube.
        Se usa cuando agregas un talle nuevo en el ERP y quieres que aparezca en la web.
        """
        try:
            if not self.access_token or not self.api_url:
                return {"success": False, "error": "No credenciales"}

            # 1. Preparar datos (Precio con aumento web y Stock)
            precio_web = self.calcular_precio_web(local_variant.precio)
            
            # Manejo seguro del stock (si no tiene inventario, va 0)
            stock_val = local_variant.inventario.stock_actual if local_variant.inventario else 0
            
            # Manejo del nombre del talle (compatible con tu lógica anterior)
            # Intenta buscar .talla, sino .talle, sino pone "Único"
            nombre_talle = getattr(local_variant, 'talla', None) or getattr(local_variant, 'talle', "Único")

            # 2. Payload para Tienda Nube
            payload = {
                "price": precio_web,
                "stock": int(stock_val),
                "sku": local_variant.codigo_sku or "",
                # IMPORTANTE: TN necesita el valor de la propiedad (ej: "XL") dentro de "values"
                "values": [{"es": nombre_talle}] 
            }

            # 3. Request POST
            url = f"{self.api_url}/products/{tn_product_id}/variants"
            response = requests.post(url, json=payload, headers=self._get_headers())

            if response.status_code == 201:
                print(f"✅ TN Sync: Variante '{nombre_talle}' creada exitosamente.")
                return {"success": True, "tn_data": response.json()}
            else:
                error_msg = f"API Error {response.status_code}: {response.text}"
                print(f"❌ {error_msg}")
                return {"success": False, "error": error_msg}

        except Exception as e:
            print(f"🔥 Error excepción create_variant: {e}")
            return {"success": False, "error": str(e)}

    def sync_missing_variants(self, local_prod):
        """
        Recorre las variantes del producto local.
        Si alguna NO tiene tiendanube_variant_id, la crea en la nube.
        """
        # Si el producto padre no está en la nube, no podemos agregarle hijos.
        if not local_prod.tiendanube_id:
            print("⚠️ El producto padre no está vinculado a TN. Primero vincúlalo completo.")
            return False 

        hubo_cambios = False
        
        print(f"🔄 Verificando variantes nuevas para: {local_prod.nombre}...")

        for var in local_prod.variantes:
            # --- CORRECCIÓN AQUÍ (Antes decía var.tiendanube_id) ---
            if not var.tiendanube_variant_id:
                print(f"   ✨ Variante nueva detectada en ERP (SKU: {var.codigo_sku}). Creando en TN...")
                
                # Llamamos a la API
                resp = self.create_variant_in_cloud(local_prod.tiendanube_id, var)
                
                if resp['success']:
                    # ÉXITO: Asignamos el nuevo ID al objeto
                    # --- CORRECCIÓN AQUÍ TAMBIÉN ---
                    var.tiendanube_variant_id = str(resp['tn_data']['id'])
                    hubo_cambios = True
                else:
                    print(f"   ❌ Falló la creación de la variante {var.codigo_sku}")
        
        return hubo_cambios

# Instancia global para importar en otros lados
tn_service = TiendaNubeService()