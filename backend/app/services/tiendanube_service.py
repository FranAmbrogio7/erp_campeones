import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

class TiendaNubeService:
    def __init__(self):
        # 1. CARGA DE CREDENCIALES
        self.access_token = os.getenv('TIENDANUBE_ACCESS_TOKEN')
        self.store_id = os.getenv('TIENDANUBE_STORE_ID')
        self.api_url = f"https://api.tiendanube.com/v1/{self.store_id}" if self.store_id else None
        self.user_agent = "AppGestion (tu_email@ejemplo.com)"
        
        # 2. CONFIGURACIÓN DE PRECIOS
        self.PORCENTAJE_WEB = 1.26  # 26% de aumento para la web
        
        # 3. CONFIGURACIONES ESTÁNDAR DE ENVÍO
        self.PESO_ESTANDAR = 0.150  # 150 gramos (en kg)
        self.MEDIDAS_ESTANDAR = {
            "width": 10,  # 10 cm
            "height": 10, # 10 cm
            "depth": 5   # 5 cm
        }

        # 4. MOTOR DE PLANTILLAS DE DESCRIPCIÓN
        self.PLANTILLAS = {
            "Camisetas Nacionales": """
                <p><strong>Camiseta Calidad Nacional - Version Hincha</strong></p>
                <ul>
                    <li>Tela deportiva cómoda, resistente y respirable.</li>
                    <li>Escudo y marca bordados para mayor durabilidad y mejor terminación.</li>
                    <li>Estampas en vinilo de alta calidad con excelente definición.</li>
                    <li>Corte cómodo ideal para uso diario, entrenar o alentar a tu equipo.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Camisetas Retro": """
                <p><strong>Camiseta Retro - Clásicos que Hicieron Historia</strong></p>
                <p>Revive los momentos más icónicos del fútbol con esta camiseta retro inspirada en épocas inolvidables.</p>
                <ul>
                    <li>Diseño fiel a los modelos históricos originales.</li>
                    <li>Telas modernas que brindan mayor comodidad y durabilidad.</li>
                    <li>Detalles y escudos cuidadosamente confeccionados.</li>
                    <li>Ideal para coleccionistas y verdaderos fanáticos del fútbol.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Camisetas G5 Importadas": """
                <p><strong>Camiseta G5 Importada - Calidad Premium Profesional</strong></p>
                <ul>
                    <li>Calidad importada G5 con terminaciones premium.</li>
                    <li>Escudo y marca termosellados.</li>
                    <li>Escudos, logos y detalles idénticos a los modelos utilizados por los jugadores.</li>
                    <li>Tela tecnológica liviana y respirable con excelente ajuste.</li>
                    <li>Máximo confort y calidad superior en cada detalle.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Conjuntos": """
                <p><strong>Conjunto Deportivo Completo (Campera + Pantalón)</strong></p>
                <p>Diseñado para brindar comodidad, estilo y rendimiento tanto para entrenar como para uso urbano.</p>
                <ul>
                    <li>Confeccionado con materiales cómodos y resistentes.</li>
                    <li>Campera y pantalón con ajuste moderno y confortable.</li>
                    <li>Bolsillos funcionales con cierre según modelo.</li>
                    <li>Ideal para entrenamiento, viajes o uso diario.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Buzos": """
                <p><strong>Buzo Deportivo Clubes</strong></p>
                <ul>
                    <li>Interior frizado, super suave y cálido para mayor comodidad.</li>
                    <li>Diseño moderno ideal para uso deportivo o urbano.</li>
                    <li>Material resistente y de muy buena calidad.</li>
                    <li>Ajuste cómodo pensado para el día a día.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Camperas": """
                <p><strong>Campera Deportiva Clubes</strong></p>
                <ul>
                    <li>Diseño moderno inspirado en la indumentaria profesional.</li>
                    <li>Material liviano, cómodo y resistente.</li>
                    <li>Cierre frontal y bolsillos funcionales según modelo.</li>
                    <li>Ideal para entrenamientos, viajes o uso diario.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Pantalones Largos": """
                <p><strong>Pantalón Deportivo Largo</strong></p>
                <ul>
                    <li>Interior frizado, super suave y cálido para mayor comodidad.</li>
                    <li>Diseño moderno ideal para uso deportivo o urbano.</li>
                    <li>Material resistente y de muy buena calidad.</li>
                    <li>Ajuste cómodo pensado para el día a día.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """,
            "Shorts": """
                <p><strong>Short Deportivo</strong></p>
                <ul>
                    <li>Tela liviana y respirable para máxima comodidad.</li>
                    <li>Ajuste cómodo ideal para entrenar o uso casual.</li>
                    <li>Cintura elastizada para mejor adaptación.</li>
                    <li>Diseño inspirado en el fútbol profesional.</li>
                </ul>
                <p><strong>📏 Recomendación de Talle:</strong></p>
                <p>Te recomendamos revisar cuidadosamente la guía de talles antes de realizar tu compra. Si estás entre dos talles o preferís un calce más cómodo, aconsejamos elegir un talle más grande.</p>
                <p><em>Las medidas son aproximadas y pueden presentar pequeñas variaciones según el modelo o confección.</em></p>
            """
        }
        
        # --- AHORA LA PLANTILLA POR DEFECTO ESTÁ VACÍA ---
        self.DESCRIPCION_DEFAULT = ""

    def _get_headers(self):
        """Helper para headers comunes"""
        return {
            "Authentication": f"bearer {self.access_token}",
            "User-Agent": self.user_agent,
            "Content-Type": "application/json"
        }

    # =======================================================
    # FUNCIONES AUXILIARES: INTELIGENCIA DE VARIANTES
    # =======================================================
    def _detect_attributes(self, variantes):
        """Detecta si el producto necesita atributos de talle o estampa"""
        usa_talle = False
        usa_estampa = False
        if not variantes: 
            return False, False
            
        for var in variantes:
            t = getattr(var, 'talla', None) or getattr(var, 'talle', 'U')
            c = getattr(var, 'color', None)
            
            # Si tiene un talle que NO sea U, UNICO, etc., requiere Talle
            if t.strip().upper() not in ['U', 'UNICO', 'ÚNICO']: 
                usa_talle = True
            
            # Si tiene una estampa que NO sea Standard, requiere Estampa
            if c and c.strip() not in ['', 'Standard', 'Sin Estampa']: 
                usa_estampa = True
                
        return usa_talle, usa_estampa

    def _build_variant_values(self, usa_talle, usa_estampa, var):
        """Construye el arreglo 'values' dinámicamente según lo que requiera el producto"""
        t = getattr(var, 'talla', None) or getattr(var, 'talle', 'Único')
        c = getattr(var, 'color', None)
        
        t_clean = t.strip() if t else 'Único'
        c_clean = c.strip() if c and c.strip() not in ['', 'Standard'] else 'Sin Estampa'
        
        vals = []
        if usa_talle: vals.append({"es": t_clean})
        if usa_estampa: vals.append({"es": c_clean})
        return vals

    # =======================================================

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
            "promotional_price": None 
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

    def update_product_data(self, local_prod):
            """Actualiza nombre, descripción y ESTRUCTURA (atributos) en TN"""
            if not self.access_token or not self.api_url: return
            if not local_prod or not local_prod.tiendanube_id: return
            
            # 1. LÓGICA DE PLANTILLA 
            descripcion_seleccionada = str(local_prod.descripcion or "").strip()

            if descripcion_seleccionada in self.PLANTILLAS:
                descripcion_final = self.PLANTILLAS[descripcion_seleccionada]
            elif descripcion_seleccionada == "":
                descripcion_final = self.DESCRIPCION_DEFAULT
            else:
                descripcion_final = descripcion_seleccionada

            # 2. EVALUACIÓN INTELIGENTE DE ATRIBUTOS
            usa_talle, usa_estampa = self._detect_attributes(local_prod.variantes)
            
            attributes_list = []
            if usa_talle: attributes_list.append({"es": "Talle"})
            if usa_estampa: attributes_list.append({"es": "Estampa"})

            # 3. PREPARAMOS TODAS LAS VARIANTES EXISTENTES PARA "ACTUALIZARLAS"
            variants_data = []
            for var in local_prod.variantes:
                # Solo migramos las que ya existen en TN.
                if var.tiendanube_variant_id:
                    stock_val = var.inventario.stock_actual if var.inventario else 0
                    precio_web = self.calcular_precio_web(local_prod.precio)

                    variants_data.append({
                        "id": int(var.tiendanube_variant_id), # Fundamental mandar el ID a TN
                        "price": precio_web,
                        "stock": int(stock_val),
                        "sku": var.codigo_sku,
                        "values": self._build_variant_values(usa_talle, usa_estampa, var),
                        "weight": self.PESO_ESTANDAR,
                        "width": self.MEDIDAS_ESTANDAR["width"],
                        "height": self.MEDIDAS_ESTANDAR["height"],
                        "depth": self.MEDIDAS_ESTANDAR["depth"]
                    })

            # 4. ENVIAR A TIENDA NUBE
            url = f"{self.api_url}/products/{local_prod.tiendanube_id}"
            data = {
                "name": {"es": local_prod.nombre},
                "description": {"es": descripcion_final},
                "attributes": attributes_list, 
                "variants": variants_data
            }

            try:
                requests.put(url, json=data, headers=self._get_headers())
                print(f"✅ TN Sync: Estructura de producto actualizada dinámicamente (ID: {local_prod.tiendanube_id})")
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


    def delete_variant_in_cloud(self, tn_product_id, tn_variant_id):
        """Elimina una variante específica en Tienda Nube"""
        if not self.access_token or not self.api_url: return
        
        url = f"{self.api_url}/products/{tn_product_id}/variants/{tn_variant_id}"
        try:
            response = requests.delete(url, headers=self._get_headers())
            if response.status_code == 200:
                print(f"🗑️ TN Sync: Variante eliminada de la nube (ID: {tn_variant_id})")
            else:
                print(f"⚠️ TN Sync: No se pudo eliminar variante. Error: {response.text}")
        except Exception as e:
            print(f"⚠️ Error eliminando variante de TN: {e}")
            

    def create_product_in_cloud(self, local_prod):
        """Sube un producto nuevo a Tienda Nube con lógica inteligente de variantes"""
        try:
            if not self.access_token or not self.api_url: 
                return {"success": False, "error": "No hay credenciales configuradas"}

            if not local_prod:
                raise ValueError("El producto local es None")

            # --- 1. LÓGICA DE DESCRIPCIÓN POR DESPLEGABLE ---
            descripcion_seleccionada = str(local_prod.descripcion or "").strip()
            
            if descripcion_seleccionada in self.PLANTILLAS:
                descripcion_final = self.PLANTILLAS[descripcion_seleccionada]
            elif descripcion_seleccionada == "":
                descripcion_final = self.DESCRIPCION_DEFAULT
            else:
                descripcion_final = descripcion_seleccionada

            # --- 2. LÓGICA INTELIGENTE DE ATRIBUTOS ---
            usa_talle, usa_estampa = self._detect_attributes(local_prod.variantes)
            
            attributes_list = []
            if usa_talle: attributes_list.append({"es": "Talle"})
            if usa_estampa: attributes_list.append({"es": "Estampa"})

            variants_data = []
            for var in local_prod.variantes:
                stock_val = var.inventario.stock_actual if var.inventario else 0
                precio_web = self.calcular_precio_web(local_prod.precio)

                variants_data.append({
                    "price": precio_web,
                    "stock": int(stock_val),
                    "sku": var.codigo_sku,
                    "values": self._build_variant_values(usa_talle, usa_estampa, var),
                    "weight": self.PESO_ESTANDAR,
                    "width": self.MEDIDAS_ESTANDAR["width"],
                    "height": self.MEDIDAS_ESTANDAR["height"],
                    "depth": self.MEDIDAS_ESTANDAR["depth"]
                })

            # --- 3. PAYLOAD DEL PRODUCTO ---
            payload = {
                "name": {"es": local_prod.nombre},
                "description": {"es": descripcion_final},
                "attributes": attributes_list, 
                "variants": variants_data,
                "images": [] 
            }

            url = f"{self.api_url}/products"
            response = requests.post(url, json=payload, headers=self._get_headers())
            
            if response.status_code == 201:
                return {"success": True, "tn_data": response.json()}
            else:
                return {"success": False, "error": f"API Error {response.status_code}: {response.text}"}

        except Exception as e:
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
    # MÉTODOS PARA SINCRONIZAR VARIANTES INDIVIDUALES
    # ==========================================
    def create_variant_in_cloud(self, tn_product_id, local_variant):
        """
        Crea una variante específica en un producto existente de Tienda Nube.
        Respeta la estructura dinámica del padre.
        """
        try:
            if not self.access_token or not self.api_url:
                return {"success": False, "error": "No credenciales"}

            prod_padre = local_variant.producto
            precio_base = prod_padre.precio if prod_padre else 0
            precio_web = self.calcular_precio_web(precio_base)
            
            stock_val = local_variant.inventario.stock_actual if local_variant.inventario else 0
            
            # El hijo respeta las reglas que determinan las variantes del padre
            usa_talle, usa_estampa = self._detect_attributes(prod_padre.variantes)

            # Payload 
            payload = {
                "price": precio_web,
                "stock": int(stock_val),
                "sku": local_variant.codigo_sku or "",
                "values": self._build_variant_values(usa_talle, usa_estampa, local_variant),
                "weight": self.PESO_ESTANDAR,
                "width": self.MEDIDAS_ESTANDAR["width"],
                "height": self.MEDIDAS_ESTANDAR["height"],
                "depth": self.MEDIDAS_ESTANDAR["depth"]
            }

            url = f"{self.api_url}/products/{tn_product_id}/variants"
            response = requests.post(url, json=payload, headers=self._get_headers())

            if response.status_code == 201:
                print(f"✅ TN Sync: Variante creada exitosamente.")
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
        if not local_prod.tiendanube_id:
            print("⚠️ El producto padre no está vinculado a TN. Primero vincúlalo completo.")
            return False 

        hubo_cambios = False
        
        print(f"🔄 Verificando variantes nuevas para: {local_prod.nombre}...")

        for var in local_prod.variantes:
            if not var.tiendanube_variant_id:
                print(f"   ✨ Variante nueva detectada en ERP (SKU: {var.codigo_sku}). Creando en TN...")
                
                resp = self.create_variant_in_cloud(local_prod.tiendanube_id, var)
                
                if resp['success']:
                    var.tiendanube_variant_id = str(resp['tn_data']['id'])
                    hubo_cambios = True
                else:
                    print(f"   ❌ Falló la creación de la variante {var.codigo_sku}")
        
        return hubo_cambios


    def get_first_product_image_url(self, tn_product_id):
        """Obtiene la URL de la primera imagen (principal) de un producto en TN"""
        if not self.access_token or not self.api_url: return None
        
        try:
            url = f"{self.api_url}/products/{tn_product_id}"
            r = requests.get(url, headers=self._get_headers())
            
            if r.status_code == 200:
                data = r.json()
                images = data.get('images', [])
                if images:
                    images.sort(key=lambda x: int(x.get('position', 99)))
                    return images[0].get('src')
            return None
        except Exception as e:
            print(f"Error obteniendo imagen de TN: {e}")
            return None

# Instancia global para importar en otros lados
tn_service = TiendaNubeService()