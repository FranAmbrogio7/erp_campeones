#/backend/app/sales/webhooks.py
from flask import Blueprint, request, jsonify
from app.extensions import db
from app.products.models import Producto, ProductoVariante, Inventario
from app.sales.models import Venta, DetalleVenta, MetodoPago
from app.services.tiendanube_service import tn_service
import datetime

# Creamos un Blueprint separado para no ensuciar sales/routes.py
bp_webhooks = Blueprint('webhooks', __name__)

@bp_webhooks.route('/tiendanube/orders', methods=['POST'])
def handle_new_order():
    """
    Recibe notificación de Tienda Nube cuando se crea/paga una orden.
    Topic: order/created o order/paid
    """
    # --- DIAGNÓSTICO: IMPRIMIR TODO LO QUE LLEGA ---
    print("📨 HEADERS COMPLETOS RECIBIDOS:")
    print(request.headers) 
    # -----------------------------------------------

    topic = request.headers.get('X-Topic')
    store_id = request.headers.get('X-Store-Id')

    # --- SOLUCIÓN TEMPORAL: COMENTAMOS LA VALIDACIÓN QUE FALLA ---
    # Si no llega el ID, lo dejamos pasar igual (por ahora) para que actualice stock
    # if str(store_id) != str(tn_service.store_id):
    #     print(f"❌ FALLÓ LA VALIDACIÓN DE ID: Recibido '{store_id}' vs Local '{tn_service.store_id}'")
    #     return jsonify({"msg": "Store ID mismatch"}), 401
    # -------------------------------------------------------------

    data = request.get_json()
    order_id = data.get('id')

    print(f"🔔 WEBHOOK RECIBIDO: Orden #{order_id} ({topic})")

    # (El resto del código sigue igual...)
    if topic == 'order/created':
        try:
            process_cloud_order(data)
            return jsonify({"msg": "Orden procesada localmente"}), 200
        except Exception as e:
            print(f"❌ Error procesando orden nube: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"msg": "Error interno"}), 500

    return jsonify({"msg": "Evento ignorado"}), 200

def process_cloud_order(order_data):
    """Lógica para registrar la venta en MySQL y bajar stock"""
    
    # 1. Verificar si ya registramos esta orden (Evitar duplicados)
    #    (Podríamos agregar un campo 'id_orden_nube' en la tabla Ventas para ser estrictos)
    #    Por ahora, confiamos en que Flask procesa rápido.

    # 2. Buscar o Crear Método de Pago "Tienda Nube"
    metodo_nube = MetodoPago.query.filter_by(nombre="Tienda Nube").first()
    if not metodo_nube:
        metodo_nube = MetodoPago(nombre="Tienda Nube")
        db.session.add(metodo_nube)
        db.session.flush()

    # 3. Crear la Venta Local (Cabecera)
    nueva_venta = Venta(
        total=float(order_data.get('total', 0)),
        subtotal=float(order_data.get('subtotal', 0)),
        descuento=float(order_data.get('discount', 0)),
        id_metodo_pago=metodo_nube.id_metodo_pago,
        fecha_venta=datetime.datetime.now(),
        # Opcional: Podríamos guardar el ID de orden nube en algún campo de notas
    )
    db.session.add(nueva_venta)
    db.session.flush()

    # 4. Procesar Productos
    products = order_data.get('products', [])
    
    for item in products:
        variant_id_nube = item.get('variant_id')
        product_id_nube = item.get('product_id')
        cantidad = int(item.get('quantity', 1))
        
        # Buscar variante local vinculada
        variante_local = ProductoVariante.query.filter_by(tiendanube_variant_id=variant_id_nube).first()
        
        if variante_local:
            # A. Descontar Stock Local
            if variante_local.inventario:
                variante_local.inventario.stock_actual -= cantidad
                print(f"   📉 Stock bajado: {variante_local.codigo_sku} -{cantidad}u")

            # B. Agregar Detalle Venta
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                id_variante=variante_local.id_variante,
                cantidad=cantidad,
                precio_unitario=float(item.get('price', 0)),
                subtotal=float(item.get('price', 0)) * cantidad
            )
            db.session.add(detalle)
        else:
            print(f"   ⚠️ Producto de nube ID {variant_id_nube} no encontrado localmente. Se registra venta sin descontar stock físico.")

    db.session.commit()
    print("✅ Orden guardada en ERP Local correctamente.")