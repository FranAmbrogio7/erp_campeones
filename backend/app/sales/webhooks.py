# /backend/app/sales/webhooks.py
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import ProductoVariante
from app.sales.models import Venta, DetalleVenta, MetodoPago, VentaPago 
from app.services.tiendanube_service import tn_service
from datetime import datetime, timedelta

bp_webhooks = Blueprint('webhooks', __name__)

# --- Función para hora local ---
def ahora_argentina():
    return datetime.utcnow() - timedelta(hours=3)

@bp_webhooks.route('/tiendanube/orders', methods=['POST'])
def handle_new_order():
    """
    Recibe notificación de Tienda Nube, valida y descarga la orden completa.
    """
    try:
        # 1. Obtener Headers y Datos
        store_id_header = request.headers.get('X-Store-Id') or request.headers.get('x-store-id')
        
        data = request.get_json() or {}
        order_id = data.get('id')
        
        # --- SEGURIDAD 1: Validar Store ID ---
        if tn_service.store_id and store_id_header:
            if str(store_id_header) != str(tn_service.store_id):
                print(f"⛔ Alerta de Seguridad: ID recibido {store_id_header} no coincide con local.")
                return jsonify({"msg": "Unauthorized Store ID"}), 401

        if not order_id:
            return jsonify({"msg": "Sin ID de orden"}), 200

        print(f"🔔 NOTIFICACIÓN RECIBIDA: ID #{order_id}")

        # --- SEGURIDAD 2: Evitar Duplicados ---
        venta_existente = Venta.query.filter(Venta.observaciones.like(f"%{order_id}%")).first()
        if venta_existente:
            print(f"⚠️ La Orden #{order_id} ya fue procesada anteriormente (Venta ID: {venta_existente.id_venta}). Se ignora.")
            return jsonify({"msg": "Orden ya registrada previamente"}), 200

        # 3. DESCARGAR LA DATA COMPLETA
        full_order_data = tn_service.get_order_details(order_id)

        if not full_order_data:
            print("❌ No se pudo obtener la información de la orden desde la API.")
            return jsonify({"msg": "Error fetching order data"}), 500

        # 4. PROCESAR LA ORDEN
        process_cloud_order(full_order_data)
        
        return jsonify({"msg": "Orden procesada exitosamente"}), 200

    except Exception as e:
        print(f"🔥 ERROR CRÍTICO EN WEBHOOK: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": "Error interno"}), 500

def process_cloud_order(order_data):
    """Lógica para registrar la venta en MySQL y bajar stock usando el PRECIO LOCAL"""
    
    order_id_tn = order_data.get('id')

    # 1. Buscar o Crear Método de Pago "Tienda Nube"
    metodo_nube = MetodoPago.query.filter_by(nombre="Tienda Nube").first()
    if not metodo_nube:
        metodo_nube = MetodoPago(nombre="Tienda Nube")
        db.session.add(metodo_nube)
        db.session.flush()

    products = order_data.get('products', [])
    
    if not products:
        print("⚠️ ALERTA: La orden descargada no tiene productos.")

    # --- NUEVA LÓGICA: Calcular el total con el precio local ---
    total_venta_local = 0
    detalles_a_guardar = []

    for item in products:
        variant_id_nube = str(item.get('variant_id'))
        cantidad = int(item.get('quantity', 1))
        precio_tienda = float(item.get('price', 0)) # Precio de la web por defecto
        nombre_producto = item.get('name', 'Producto Nube')
        
        print(f"   procesando item: {nombre_producto} (VarID: {variant_id_nube})")

        # Buscar variante local vinculada
        variante_local = ProductoVariante.query.filter_by(tiendanube_variant_id=variant_id_nube).first()
        
        # Intento por SKU si falla ID
        if not variante_local:
             sku = item.get('sku')
             if sku:
                 variante_local = ProductoVariante.query.filter_by(codigo_sku=sku).first()

        precio_final_aplicado = precio_tienda

        if variante_local:
            # A. Descontar Stock Local
            if variante_local.inventario:
                variante_local.inventario.stock_actual -= cantidad
                print(f"   📉 Stock bajado: {variante_local.producto.nombre} -{cantidad}u")
            
            # B. Reemplazar por Precio Local
            if variante_local.producto and variante_local.producto.precio:
                precio_final_aplicado = float(variante_local.producto.precio)
                print(f"   💵 Aplicando Precio Local de lista: ${precio_final_aplicado} (Ignorando precio web: ${precio_tienda})")
            
            detalles_a_guardar.append({
                "id_variante": variante_local.id_variante,
                "producto_nombre": variante_local.producto.nombre,
                "cantidad": cantidad,
                "precio_unitario": precio_final_aplicado,
                "subtotal": precio_final_aplicado * cantidad
            })
        else:
            print(f"   ⚠️ Producto no vinculado localmente. Se guardará con el precio de TiendaNube.")
            detalles_a_guardar.append({
                "id_variante": None,
                "producto_nombre": nombre_producto,
                "cantidad": cantidad,
                "precio_unitario": precio_final_aplicado,
                "subtotal": precio_final_aplicado * cantidad
            })

        # Sumamos al total general de la venta
        total_venta_local += (precio_final_aplicado * cantidad)


    # 2. Crear la Venta Local (Usando el monto sumado real sin envíos)
    nueva_venta = Venta(
        total=total_venta_local,
        subtotal=total_venta_local,
        descuento=0,
        id_metodo_pago=metodo_nube.id_metodo_pago,
        fecha_venta=ahora_argentina(),
        observaciones=f"Orden Tienda Nube #{order_id_tn}" # Clave para detectar duplicados
    )
    db.session.add(nueva_venta)
    db.session.flush() # Guardar temporalmente para obtener el ID de la venta

    # 3. Guardar los Detalles (Productos de la venta)
    for det in detalles_a_guardar:
        detalle_db = DetalleVenta(
            id_venta=nueva_venta.id_venta,
            id_variante=det["id_variante"],
            producto_nombre=det["producto_nombre"],
            cantidad=det["cantidad"],
            precio_unitario=det["precio_unitario"],
            subtotal=det["subtotal"]
        )
        db.session.add(detalle_db)

    # 4. Guardar el VentaPago (Fundamental para que no de 0 en el Historial de Ventas)
    nuevo_pago = VentaPago(
        id_venta=nueva_venta.id_venta,
        id_metodo_pago=metodo_nube.id_metodo_pago,
        monto=total_venta_local
    )
    db.session.add(nuevo_pago)

    db.session.commit()
    print(f"✅ Venta local registrada exitosamente por un total de ${total_venta_local}")