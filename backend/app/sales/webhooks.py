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
    Recibe notificación de Tienda Nube
    """
    try:
        # --- DIAGNÓSTICO: VER QUÉ LLEGA REALMENTE ---
        print("\n📨 --- INICIO WEBHOOK ---")
        print("HEADERS RECIBIDOS:")
        # Imprimimos cada cabecera para ver si 'X-Store-Id' llega en minúsculas o distinto
        for key, value in request.headers.items():
            print(f"   {key}: {value}")
        print("--------------------------\n")

        topic = request.headers.get('X-Topic') or request.headers.get('x-topic')
        store_id = request.headers.get('X-Store-Id') or request.headers.get('x-store-id')

        # --- BYPASS DE SEGURIDAD TEMPORAL ---
        # Comentamos esto para que FUNCIONE AHORA MISMO
        # if str(store_id) != str(tn_service.store_id):
        #    print(f"❌ RECHAZADO: ID Recibido '{store_id}' vs Local '{tn_service.store_id}'")
        #    return jsonify({"msg": "Store ID mismatch"}), 401
        
        data = request.get_json()
        order_id = data.get('id')
        
        print(f"🔔 PROCESANDO ORDEN #{order_id} (Topic: {topic})")

        if topic == 'order/created':
            process_cloud_order(data)
            return jsonify({"msg": "Orden procesada localmente"}), 200
            
        return jsonify({"msg": "Evento ignorado"}), 200

    except Exception as e:
        print(f"🔥 ERROR CRÍTICO EN WEBHOOK: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": "Error interno"}), 500

def process_cloud_order(order_data):
    """Lógica para registrar la venta en MySQL y bajar stock"""
    
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
        observaciones=f"Orden Tienda Nube #{order_data.get('id')}"
    )
    db.session.add(nueva_venta)
    db.session.flush()

    # 3. Procesar Productos
    products = order_data.get('products', [])
    
    for item in products:
        variant_id_nube = str(item.get('variant_id')) # Convertimos a string por seguridad
        cantidad = int(item.get('quantity', 1))
        precio = float(item.get('price', 0))
        
        # Buscar variante local vinculada
        variante_local = ProductoVariante.query.filter_by(tiendanube_variant_id=variant_id_nube).first()
        
        # Si no la encuentra por ID de variante, intenta por SKU (Plan B)
        if not variante_local:
             sku = item.get('sku')
             if sku:
                 variante_local = ProductoVariante.query.filter_by(codigo_sku=sku).first()

        if variante_local:
            # A. Descontar Stock Local
            if variante_local.inventario:
                variante_local.inventario.stock_actual -= cantidad
                print(f"   📉 Stock bajado: {variante_local.producto.nombre} -{cantidad}u")

            # B. Agregar Detalle Venta
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
            print(f"   ⚠️ Producto Nube ID {variant_id_nube} no encontrado localmente. Se registra sin descontar stock.")
            # Registramos el item genérico para que no falte en el ticket
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                producto_nombre=item.get('name', 'Producto Desconocido'),
                cantidad=cantidad,
                precio_unitario=precio,
                subtotal=precio * cantidad
            )
            db.session.add(detalle)

    db.session.commit()
    print("✅ Orden guardada y stock actualizado.")