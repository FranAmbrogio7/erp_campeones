# /backend/app/sales/webhooks.py
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import ProductoVariante
from app.sales.models import Venta, DetalleVenta, MetodoPago
from app.services.tiendanube_service import tn_service
import datetime

bp_webhooks = Blueprint('webhooks', __name__)

@bp_webhooks.route('/tiendanube/orders', methods=['POST'])
def handle_new_order():
    """
    Recibe notificación de Tienda Nube, valida y descarga la orden completa.
    """
    try:
        # 1. Obtener Headers y Datos
        # Tienda Nube a veces manda headers en minúscula, probamos ambos casos
        store_id_header = request.headers.get('X-Store-Id') or request.headers.get('x-store-id')
        
        data = request.get_json() or {}
        order_id = data.get('id')
        
        # --- SEGURIDAD 1: Validar Store ID ---
        # Si tienes configurado el ID en el servicio, verificamos que coincida
        if tn_service.store_id and store_id_header:
            if str(store_id_header) != str(tn_service.store_id):
                print(f"⛔ Alerta de Seguridad: ID recibido {store_id_header} no coincide con local.")
                return jsonify({"msg": "Unauthorized Store ID"}), 401

        if not order_id:
            return jsonify({"msg": "Sin ID de orden"}), 200

        print(f"🔔 NOTIFICACIÓN RECIBIDA: ID #{order_id}")

        # --- SEGURIDAD 2: Evitar Duplicados ---
        # Buscamos si ya existe una venta con este ID en las observaciones
        venta_existente = Venta.query.filter(Venta.observaciones.like(f"%{order_id}%")).first()
        if venta_existente:
            print(f"⚠️ La Orden #{order_id} ya fue procesada anteriormente (Venta ID: {venta_existente.id_venta}). Se ignora.")
            return jsonify({"msg": "Orden ya registrada previamente"}), 200

        # 3. DESCARGAR LA DATA COMPLETA (Estrategia Segura)
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
    """Lógica para registrar la venta en MySQL y bajar stock"""
    
    order_id_tn = order_data.get('id')

    # 1. Buscar o Crear Método de Pago "Tienda Nube"
    metodo_nube = MetodoPago.query.filter_by(nombre="Tienda Nube").first()
    if not metodo_nube:
        metodo_nube = MetodoPago(nombre="Tienda Nube")
        db.session.add(metodo_nube)
        db.session.flush()

    # 2. Crear la Venta Local
    nueva_venta = Venta(
        total=float(order_data.get('total', 0)),
        subtotal=float(order_data.get('subtotal', 0)),
        descuento=float(order_data.get('discount', 0)),
        id_metodo_pago=metodo_nube.id_metodo_pago,
        fecha_venta=datetime.datetime.now(),
        observaciones=f"Orden Tienda Nube #{order_id_tn}" # Clave para detectar duplicados
    )
    db.session.add(nueva_venta)
    db.session.flush()

    # 3. Procesar Productos
    products = order_data.get('products', [])
    
    if not products:
        print("⚠️ ALERTA: La orden descargada no tiene productos.")

    for item in products:
        variant_id_nube = str(item.get('variant_id'))
        cantidad = int(item.get('quantity', 1))
        precio = float(item.get('price', 0))
        nombre_producto = item.get('name', 'Producto Nube')
        
        print(f"   procesando item: {nombre_producto} (S) (VarID: {variant_id_nube})")

        # Buscar variante local vinculada
        variante_local = ProductoVariante.query.filter_by(tiendanube_variant_id=variant_id_nube).first()
        
        # Intento por SKU si falla ID
        if not variante_local:
             sku = item.get('sku')
             if sku:
                 variante_local = ProductoVariante.query.filter_by(codigo_sku=sku).first()

        if variante_local:
            # A. Descontar Stock Local
            if variante_local.inventario:
                variante_local.inventario.stock_actual -= cantidad
                print(f"   📉 Stock bajado: {variante_local.producto.nombre} -{cantidad}u")
            
            # B. Guardar Detalle
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                id_variante=variante_local.id_variante,
                producto_nombre=variante_local.producto.nombre,
                cantidad=cantidad,
                precio_unitario=precio,
                subtotal=precio * cantidad
            )
            db.session.add(detalle)
        else:
            print(f"   ⚠️ Producto no vinculado. Se guarda sin descontar stock.")
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                producto_nombre=nombre_producto,
                cantidad=cantidad,
                precio_unitario=precio,
                subtotal=precio * cantidad
            )
            db.session.add(detalle)

    db.session.commit()
    print("✅ Venta registrada y stock actualizado.")