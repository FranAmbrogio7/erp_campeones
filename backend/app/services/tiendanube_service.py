import os
import requests
from dotenv import load_dotenv

load_dotenv()

class TiendaNubeService:
    # ==========================================
    # 1. Inicialización
    # ==========================================
    def __init__(self):
        self.store_id = os.getenv('TIENDANUBE_USER_ID')
        self.token = os.getenv('TIENDANUBE_ACCESS_TOKEN')
        self.user_agent = os.getenv('TIENDANUBE_USER_AGENT')
        self.base_url = f"https://api.tiendanube.com/v1/{self.store_id}"
        
        self.headers = {
            "Authentication": f"bearer {self.token}",
            "User-Agent": self.user_agent,
            "Content-Type": "application/json"
        }

    # ==========================================
    # 2. Conexión
    # ==========================================
    def check_connection(self):
        """Prueba simple para ver si las credenciales funcionan"""
        try:
            # Pedimos info de la tienda para ver si responde
            response = requests.get(f"{self.base_url}/store", headers=self.headers)
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                return {"success": False, "error": response.text, "status": response.status_code}
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ==========================================
    # 3. Descargar productos
    # ==========================================
    def get_all_products_cloud(self):
        """Descarga todos los productos de la nube (maneja paginación automática)"""
        products = []
        page = 1
        while True:
            try:
                url = f"{self.base_url}/products?page={page}&per_page=200"
                print(f"Descargando página {page} de Tienda Nube...")
                res = requests.get(url, headers=self.headers)
                data = res.json()
                
                if not data: break # Si viene vacío, terminamos
                
                products.extend(data)
                page += 1
            except Exception as e:
                print(f"Error descargando productos TN: {e}")
                break
        return products


    # ==========================================
    # 4. Crear producto en Tienda Nube
    # ==========================================
    def create_product_in_cloud(self, local_product):
        """
        Toma un objeto Producto (SQLAlchemy) y lo crea en Tienda Nube.
        Retorna el ID de Tienda Nube y el mapeo de variantes.
        """
        # 1. Armar las Variantes (Talles)
        variants_payload = []
        for var in local_product.variantes:
            stock = var.inventario.stock_actual if var.inventario else 0
            variants_payload.append({
                "price": float(local_product.precio),
                "stock": int(stock),
                "sku": var.codigo_sku,
                "values": [{"es": var.talla}]  # El "valor" de la variante (Ej: XL)
            })

        # 2. Armar el Producto Padre
        payload = {
            "images": [], # Pendiente: lógica de imágenes
            "name": {"es": local_product.nombre},
            "description": {"es": local_product.descripcion or ""},
            "attributes": [{"es": "Talle"}], # Definimos que la variante es por "Talle"
            "variants": variants_payload
        }

        try:
            print(f"📤 Subiendo {local_product.nombre} a Tienda Nube...")
            response = requests.post(f"{self.base_url}/products", json=payload, headers=self.headers)
            
            if response.status_code == 201:
                data = response.json()
                return {"success": True, "tn_data": data}
            else:
                return {"success": False, "error": response.text}
                
        except Exception as e:
            return {"success": False, "error": str(e)}


    # ==========================================
    # 5. Actualizar stock de una variante específica
    # ==========================================
    def update_variant_stock(self, tn_product_id, tn_variant_id, new_stock):
        """
        Actualiza el stock de una variante específica en Tienda Nube.
        """
        if not tn_product_id or not tn_variant_id:
            return False

        try:
            url = f"{self.base_url}/products/{tn_product_id}/variants/{tn_variant_id}"
            payload = { "stock": int(new_stock) }
            
            # Usamos PUT para actualizar datos existentes
            response = requests.put(url, json=payload, headers=self.headers)
            
            if response.status_code == 200:
                print(f"✅ Stock actualizado en Nube: Prod {tn_product_id} -> {new_stock} u.")
                return True
            else:
                print(f"❌ Error actualizando stock TN: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error de conexión TN: {e}")
            return False

    def delete_product_in_cloud(self, tn_product_id):
        """Elimina un producto de Tienda Nube"""
        if not tn_product_id: return False
        
        try:
            url = f"{self.base_url}/products/{tn_product_id}"
            res = requests.delete(url, headers=self.headers)
            
            if res.status_code == 200:
                print(f"🗑️ Producto {tn_product_id} eliminado de la Nube.")
                return True
            else:
                print(f"⚠️ No se pudo eliminar de la nube: {res.text}")
                return False
        except Exception as e:
            print(f"❌ Error conexión TN: {e}")
            return False

    
    def update_product_data(self, tn_product_id, nombre, descripcion=None):
        """Actualiza nombre y descripción del producto padre"""
        try:
            url = f"{self.base_url}/products/{tn_product_id}"
            
            payload = {
                "name": {"es": nombre}
            }
            if descripcion is not None:
                payload["description"] = {"es": descripcion}

            # Enviar actualización
            res = requests.put(url, json=payload, headers=self.headers)
            
            if res.status_code == 200:
                print(f"✅ Nombre actualizado en Nube: {nombre}")
                return True
            else:
                print(f"❌ Error actualizando nombre TN: {res.text}")
                return False
        except Exception as e:
            print(f"❌ Error conexión TN: {e}")
            return False

# Instancia global lista para usar
tn_service = TiendaNubeService()