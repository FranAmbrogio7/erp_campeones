import csv
from io import StringIO
from flask import Blueprint, jsonify, request, Response
from app.extensions import db
# IMPORTAMOS DESDE TUS ARCHIVOS SEPARADOS
from app.sales.models import Venta, DetalleVenta, MetodoPago, SesionCaja, MovimientoCaja, Reserva, DetalleReserva, Presupuesto, DetallePresupuesto, NotaCredito
from app.products.models import Producto, ProductoVariante, Inventario
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc, func, extract
from datetime import date, datetime, timedelta
from app.services.tiendanube_service import tn_service

bp = Blueprint('sales', __name__)

# --- NUEVO: AGREGAR MOVIMIENTO EN CAJA ---
@bp.route('/caja/movement', methods=['POST'])
@jwt_required()
def add_movement():
    # Buscar caja abierta
    sesion = SesionCaja.query.filter_by(estado='abierta').first()
    if not sesion: return jsonify({"msg": "No hay caja abierta"}), 400

    data = request.get_json()
    try:
        mov = MovimientoCaja(
            id_sesion=sesion.id_sesion,
            tipo=data.get('tipo', 'retiro'),
            monto=data['monto'],
            descripcion=data.get('descripcion')
        )
        db.session.add(mov)
        db.session.commit()
        return jsonify({"msg": "Movimiento registrado"}), 201
    except Exception as e:
        return jsonify({"msg": str(e)}), 500

# --- NUEVO: OBTENER HISTORIAL Y TOTALES ---
@bp.route('/history', methods=['GET'])
@jwt_required()
def get_sales_history():
    try:
        # 1. Verificar si el frontend pide solo la sesión actual (para la Caja) o todo (para Historial)
        solo_actual = request.args.get('current_session') == 'true'
        
        # 2. Query Base: Ventas ordenadas por fecha (más nuevas primero)
        # Usamos joinedload para traer el nombre del método de pago eficientemente
        query = Venta.query.options(db.joinedload(Venta.metodo)).order_by(desc(Venta.fecha_venta))

        if solo_actual:
            # Buscar la sesión abierta
            sesion = SesionCaja.query.filter_by(estado='abierta').first()
            if sesion:
                # Filtramos ventas hechas DESPUÉS de la apertura
                query = query.filter(Venta.fecha_venta >= sesion.fecha_apertura)
            else:
                # Si no hay caja abierta, la lista actual está vacía
                return jsonify({
                    "history": [], 
                    "today_summary": {"total": 0, "count": 0}
                }), 200
        else:
            # Si es historial general, limitamos a las últimas 100 para no saturar
            query = query.limit(100)

        ventas = query.all()
        
        # 3. Procesar datos
        lista_ventas = []
        for v in ventas:
            items_summary = []
            items_detail = []

            for d in v.detalles:
                # --- LÓGICA HÍBRIDA (Normal vs Manual) ---
                if d.variante:
                    # CASO 1: Es un producto de inventario (tiene ID variante)
                    # Verificamos que el producto padre exista (por seguridad)
                    nombre_prod = d.variante.producto.nombre if d.variante.producto else "Producto Eliminado"
                    talle_prod = d.variante.talla
                else:
                    # CASO 2: Es un ítem manual (id_variante es NULL)
                    nombre_prod = d.producto_nombre or "Ítem Personalizado"
                    talle_prod = "-"

                # A. Construir texto resumen para la tabla
                texto_item = f"{nombre_prod} ({talle_prod}) x{d.cantidad}" if talle_prod != "-" else f"{nombre_prod} x{d.cantidad}"
                items_summary.append(texto_item)

                # B. Construir objeto detalle para el Ticket
                items_detail.append({
                    "nombre": nombre_prod,
                    "talle": talle_prod,
                    "cantidad": d.cantidad,
                    "precio": float(d.precio_unitario),
                    "subtotal": float(d.subtotal)
                })

            # Unir el resumen visual con comas
            descripcion_items = ", ".join(items_summary)

            lista_ventas.append({
                "id": v.id_venta,
                "fecha": v.fecha_venta.strftime('%d/%m/%Y %H:%M'),
                "total": float(v.total),
                "metodo": v.metodo.nombre if v.metodo else "N/A",
                "items": descripcion_items,       # String para la tabla visual
                "items_detail": items_detail,     # Array para reimprimir ticket
                "estado": v.estado
            })

        # 4. Calcular Totales del DÍA ACTUAL (Independiente de la sesión, calendario puro)
        hoy = date.today()
        total_hoy = db.session.query(func.sum(Venta.total)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0
        cantidad_ventas_hoy = db.session.query(func.count(Venta.id_venta)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0

        return jsonify({
            "history": lista_ventas,
            "today_summary": {
                "total": float(total_hoy),
                "count": cantidad_ventas_hoy
            }
        }), 200

    except Exception as e:
        print(f"Error historial: {e}")
        import traceback
        traceback.print_exc() # Esto te ayudará a ver errores detallados en consola
        return jsonify({"msg": "Error cargando historial"}), 500

# --- NUEVO ENDPOINT: Listar Métodos ---
@bp.route('/payment-methods', methods=['GET'])
@jwt_required()
def get_payment_methods():
    metodos = MetodoPago.query.all()
    return jsonify([{"id": m.id_metodo_pago, "nombre": m.nombre} for m in metodos]), 200

@bp.route('/scan/<string:sku>', methods=['GET'])
@jwt_required()
def scan_product(sku):
    variante = ProductoVariante.query.filter_by(codigo_sku=sku).first()

    if not variante:
        return jsonify({"found": False, "msg": "Producto no encontrado"}), 404

    # Verificamos si tiene inventario asociado
    stock = variante.inventario.stock_actual if variante.inventario else 0

    return jsonify({
        "found": True,
        "product": {
            "id_variante": variante.id_variante,
            "sku": variante.codigo_sku,
            "nombre": variante.producto.nombre,
            "talle": variante.talla,
            "precio": float(variante.producto.precio),
            "stock_actual": stock
        }
    }), 200


# --- 1. VER ESTADO DE CAJA ---
@bp.route('/caja/status', methods=['GET'])
@jwt_required()
def get_caja_status():
    # 1. Buscar sesión abierta
    sesion = SesionCaja.query.filter_by(estado='abierta').first()
    
    if not sesion:
        return jsonify({"estado": "cerrada"}), 200
    
    # 2. Buscar ventas y retiros
    ventas = Venta.query.filter(Venta.fecha_venta >= sesion.fecha_apertura).all()
    retiros = MovimientoCaja.query.filter_by(id_sesion=sesion.id_sesion, tipo='retiro').all()
    
    # --- NUEVO: Serializar la lista de retiros para el frontend ---
    lista_retiros = [{
        "id": r.id_movimiento,
        "hora": r.fecha.strftime('%H:%M'),
        "descripcion": r.descripcion,
        "monto": float(r.monto)
    } for r in retiros]
    # -------------------------------------------------------------

    total_retiros = sum(m.monto for m in retiros)

    # 4. Calcular Desglose (Igual que antes)
    total_ventas = 0
    desglose = {"Efectivo": 0, "Tarjeta": 0, "Transferencia": 0, "Otros": 0}

    for v in ventas:
        total_ventas += v.total
        nombre_metodo = v.metodo.nombre if v.metodo else "Otros"
        if "Efectivo" in nombre_metodo: desglose["Efectivo"] += v.total
        elif "Tarjeta" in nombre_metodo: desglose["Tarjeta"] += v.total
        elif "Transferencia" in nombre_metodo: desglose["Transferencia"] += v.total
        else: desglose["Otros"] += v.total

    # 5. Calcular Totales Esperados
    efectivo_en_caja = float(sesion.monto_inicial) + float(desglose["Efectivo"]) - float(total_retiros)

    return jsonify({
        "estado": "abierta",
        "id_sesion": sesion.id_sesion,
        "fecha_apertura": sesion.fecha_apertura.strftime('%d/%m %H:%M'),
        "monto_inicial": float(sesion.monto_inicial),
        "ventas_total": float(total_ventas),
        "total_retiros": float(total_retiros),
        
        # --- NUEVO CAMPO EN LA RESPUESTA ---
        "movimientos": lista_retiros, 
        # -----------------------------------

        "desglose": {
            "efectivo_ventas": float(desglose["Efectivo"]),
            "tarjeta": float(desglose["Tarjeta"]),
            "transferencia": float(desglose["Transferencia"]),
            "otros": float(desglose["Otros"])
        },
        "totales_esperados": {
            "efectivo_en_caja": efectivo_en_caja,
            "digital": float(desglose["Tarjeta"]) + float(desglose["Transferencia"]) + float(desglose["Otros"])
        }
    }), 200

# --- 2. ABRIR CAJA ---
@bp.route('/caja/open', methods=['POST'])
@jwt_required()
def open_caja():
    # Verificar que no haya otra abierta
    if SesionCaja.query.filter_by(estado='abierta').first():
        return jsonify({"msg": "Ya existe una caja abierta"}), 400

    data = request.get_json()
    monto_inicial = data.get('monto_inicial', 0)

    nueva_sesion = SesionCaja(monto_inicial=monto_inicial, estado='abierta')
    db.session.add(nueva_sesion)
    db.session.commit()
    
    return jsonify({"msg": "Caja abierta exitosamente"}), 201

# --- 3. CERRAR CAJA ---
@bp.route('/caja/close', methods=['POST'])
@jwt_required()
def close_caja():
    sesion = SesionCaja.query.filter_by(estado='abierta').first()
    if not sesion:
        return jsonify({"msg": "No hay caja para cerrar"}), 400

    data = request.get_json()
    total_real_usuario = data.get('total_real') # El efectivo que contó el usuario

    if total_real_usuario is None:
        return jsonify({"msg": "Debes ingresar el monto contado"}), 400

    # 1. Obtener todas las ventas de la sesión
    ventas = Venta.query.filter(Venta.fecha_venta >= sesion.fecha_apertura).all()
    
    # 2. Sumar SOLO lo que fue en EFECTIVO
    ventas_efectivo = 0
    total_ventas_global = 0 # Para guardarlo como dato estadístico

    for v in ventas:
        total_ventas_global += v.total
        # Verificamos si el método contiene "Efectivo"
        if v.metodo and "Efectivo" in v.metodo.nombre:
            ventas_efectivo += v.total

    # 3. Sumar Retiros/Gastos (Restan a la caja)
    retiros = MovimientoCaja.query.filter_by(id_sesion=sesion.id_sesion, tipo='retiro').all()
    total_retiros = sum(m.monto for m in retiros)

    # 4. Cálculo del Dinero Esperado en el Cajón
    # Esperado = Base + Entradas Efectivo - Salidas Efectivo
    esperado_efectivo = float(sesion.monto_inicial) + float(ventas_efectivo) - float(total_retiros)
    
    # 5. Calcular Diferencia (Sobra o Falta)
    diferencia = float(total_real_usuario) - esperado_efectivo

    # Actualizar sesión
    sesion.fecha_cierre = datetime.now()
    sesion.total_ventas_sistema = total_ventas_global # Guardamos todo lo vendido
    sesion.total_real = total_real_usuario
    sesion.diferencia = diferencia # La diferencia es solo sobre el efectivo
    sesion.estado = 'cerrada'

    db.session.commit()

    return jsonify({
        "msg": "Caja cerrada",
        "resumen": {
            "esperado": esperado_efectivo, # Enviamos lo que debía haber en billetes
            "real": float(total_real_usuario),
            "diferencia": diferencia
        }
    }), 200


# 1. LISTAR TODAS LAS CAJAS CERRADAS
@bp.route('/caja/list', methods=['GET'])
@jwt_required()
def list_closed_sessions():
    # Traemos las últimas 20 cajas cerradas
    sesiones = SesionCaja.query.filter_by(estado='cerrada')\
        .order_by(desc(SesionCaja.fecha_cierre)).limit(20).all()
    
    resultado = []
    for s in sesiones:
        resultado.append({
            "id": s.id_sesion,
            "apertura": s.fecha_apertura.strftime('%d/%m/%Y %H:%M'), 
            "cierre": s.fecha_cierre.strftime('%d/%m/%Y %H:%M'),
            "ventas": float(s.total_ventas_sistema),
            "diferencia": float(s.diferencia)
        })
    return jsonify(resultado), 200

# 2. DESCARGAR CSV DE UNA SESIÓN
@bp.route('/caja/<int:id>/export', methods=['GET'])
def export_caja_csv(id):
    # Nota: Quitamos jwt_required para facilitar descarga directa desde navegador, 
    # o lo pasamos como token en URL si quieres seguridad estricta.
    
    sesion = SesionCaja.query.get(id)
    if not sesion: return "Caja no encontrada", 404

    # Buscar ventas de esa sesión (entre apertura y cierre)
    ventas = Venta.query.filter(
        Venta.fecha_venta >= sesion.fecha_apertura,
        Venta.fecha_venta <= sesion.fecha_cierre
    ).all()

    # Buscar movimientos (retiros)
    movimientos = MovimientoCaja.query.filter_by(id_sesion=id).all()

    # Generar CSV en memoria
    si = StringIO()
    cw = csv.writer(si)
    
    # Encabezados
    cw.writerow(['REPORTE DE CAJA #', id])
    cw.writerow(['Apertura', sesion.fecha_apertura, 'Monto Inicial', sesion.monto_inicial])
    cw.writerow(['Cierre', sesion.fecha_cierre, 'Total Real Contado', sesion.total_real])
    cw.writerow([])
    
    # Sección Ventas
    cw.writerow(['--- VENTAS ---'])
    cw.writerow(['ID Venta', 'Hora', 'Metodo Pago', 'Total', 'Items'])
    for v in ventas:
        items_str = " | ".join([f"{d.variante.producto.nombre} x{d.cantidad}" for d in v.detalles])
        metodo = v.metodo.nombre if v.metodo else "N/A"
        cw.writerow([v.id_venta, v.fecha_venta.strftime('%H:%M'), metodo, v.total, items_str])
    
    cw.writerow([])
    
    # Sección Retiros
    cw.writerow(['--- RETIROS / GASTOS ---'])
    cw.writerow(['Hora', 'Monto', 'Descripcion'])
    for m in movimientos:
        cw.writerow([m.fecha.strftime('%H:%M'), m.monto, m.descripcion])

    output = Response(si.getvalue(), mimetype="text/csv")
    output.headers["Content-Disposition"] = f"attachment; filename=caja_{id}_{sesion.fecha_cierre.date()}.csv"  
    return output


@bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    try:
        hoy = date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year

        # 1. VENTAS HOY
        total_hoy = db.session.query(func.sum(Venta.total)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0
        count_hoy = db.session.query(func.count(Venta.id_venta)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0

        # 2. VENTAS DEL MES (KPI Clave)
        total_mes = db.session.query(func.sum(Venta.total)).filter(
            extract('month', Venta.fecha_venta) == mes_actual,
            extract('year', Venta.fecha_venta) == anio_actual
        ).scalar() or 0

        # 3. STOCK CRÍTICO (Tu pedido específico)
        # Buscamos variantes donde el stock sea menor o igual al mínimo
        low_stock_query = db.session.query(Producto, ProductoVariante, Inventario)\
            .join(ProductoVariante, Producto.id_producto == ProductoVariante.id_producto)\
            .join(Inventario, ProductoVariante.id_variante == Inventario.id_variante)\
            .filter(Inventario.stock_actual <= Inventario.stock_minimo)\
            .limit(10).all() # Limitamos a 10 para no saturar el dashboard

        low_stock_list = []
        for prod, var, inv in low_stock_query:
            low_stock_list.append({
                "id": prod.id_producto,
                "nombre": prod.nombre,
                "talle": var.talla,
                "sku": var.codigo_sku,
                "stock": inv.stock_actual,
                "minimo": inv.stock_minimo
            })

        # 4. ÚLTIMAS 5 VENTAS (Actividad)
        ultimas_ventas = Venta.query.order_by(desc(Venta.fecha_venta)).limit(5).all()
        recent_activity = [{
            "hora": v.fecha_venta.strftime('%H:%M'),
            "total": float(v.total),
            "metodo": v.metodo.nombre if v.metodo else "-"
        } for v in ultimas_ventas]

        # 5. ESTADO CAJA
        caja = SesionCaja.query.filter_by(estado='abierta').first()
        caja_status = "abierta" if caja else "cerrada"

        return jsonify({
            "financial": {
                "hoy": float(total_hoy),
                "mes": float(total_mes),
                "tickets": count_hoy,
                "caja_status": caja_status
            },
            "low_stock": low_stock_list,
            "recent_activity": recent_activity
        }), 200

    except Exception as e:
        print(e)
        return jsonify({"msg": "Error dashboard"}), 500


# backend/app/sales/routes.py

# ... imports ...
from sqlalchemy import func, desc

@bp.route('/stats/period', methods=['POST'])
@jwt_required()
def get_period_stats():
    data = request.get_json()
    start_date = data.get('start_date') # String 'YYYY-MM-DD'
    end_date = data.get('end_date')     # String 'YYYY-MM-DD'

    if not start_date or not end_date:
        return jsonify({"msg": "Fechas requeridas"}), 400

    try:
        # Añadimos hora al end_date para incluir todo el último día (hasta 23:59:59)
        end_date_full = f"{end_date} 23:59:59"

        # 1. QUERY BASE: Ventas en el rango (excluyendo canceladas si tuvieras)
        query_base = Venta.query.filter(
            Venta.fecha_venta >= start_date,
            Venta.fecha_venta <= end_date_full
        )

        # 2. TOTALES GENERALES
        total_ingresos = query_base.with_entities(func.sum(Venta.total)).scalar() or 0
        total_tickets = query_base.with_entities(func.count(Venta.id_venta)).scalar() or 0
        ticket_promedio = total_ingresos / total_tickets if total_tickets > 0 else 0

        # 3. VENTAS POR MÉTODO DE PAGO
        # Group by MetodoPago
        by_method = db.session.query(
            MetodoPago.nombre, 
            func.sum(Venta.total), 
            func.count(Venta.id_venta)
        ).join(Venta).filter(
            Venta.fecha_venta >= start_date,
            Venta.fecha_venta <= end_date_full
        ).group_by(MetodoPago.nombre).all()

        methods_data = [{
            "nombre": m[0], 
            "total": float(m[1]), 
            "count": m[2]
        } for m in by_method]

        # 4. TOP 5 PRODUCTOS MÁS VENDIDOS (Por cantidad)
        top_products = db.session.query(
            Producto.nombre,
            func.sum(DetalleVenta.cantidad).label('qty_total'),
            func.sum(DetalleVenta.subtotal).label('money_total')
        ).join(ProductoVariante, DetalleVenta.id_variante == ProductoVariante.id_variante)\
         .join(Producto, ProductoVariante.id_producto == Producto.id_producto)\
         .join(Venta, DetalleVenta.id_venta == Venta.id_venta)\
         .filter(Venta.fecha_venta >= start_date, Venta.fecha_venta <= end_date_full)\
         .group_by(Producto.id_producto)\
         .order_by(desc('money_total'))\
         .limit(5).all()

        top_products_data = [{
            "nombre": tp[0], 
            "unidades": int(tp[1]), 
            "recaudado": float(tp[2])
        } for tp in top_products]

        return jsonify({
            "summary": {
                "ingresos": float(total_ingresos),
                "tickets": total_tickets,
                "promedio": float(ticket_promedio)
            },
            "by_method": methods_data,
            "top_products": top_products_data
        }), 200

    except Exception as e:
        print(f"Error stats: {e}")
        return jsonify({"msg": "Error calculando estadísticas"}), 500



@bp.route('/stats/products-detail', methods=['POST'])
@jwt_required()
def get_product_stats_detail():
    data = request.get_json()
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not start_date or not end_date: return jsonify({"msg": "Fechas requeridas"}), 400

    try:
        end_date_full = f"{end_date} 23:59:59"

        # Consulta corregida con GROUP BY completo
        stats = db.session.query(
            Producto.nombre,
            Categoria.nombre.label('categoria'),
            func.sum(DetalleVenta.cantidad).label('unidades'),
            func.sum(DetalleVenta.subtotal).label('ingresos')
        ).select_from(DetalleVenta)\
         .join(ProductoVariante, DetalleVenta.id_variante == ProductoVariante.id_variante)\
         .join(Producto, ProductoVariante.id_producto == Producto.id_producto)\
         .join(Categoria, Producto.id_categoria == Categoria.id_categoria, isouter=True)\
         .join(Venta, DetalleVenta.id_venta == Venta.id_venta)\
         .filter(Venta.fecha_venta >= start_date, Venta.fecha_venta <= end_date_full)\
         .group_by(Producto.id_producto, Producto.nombre, Categoria.nombre)\
         .order_by(desc('unidades'))\
         .all()

        resultado = [{
            "nombre": row.nombre,
            "categoria": row.categoria or "Sin categoría",
            "unidades": int(row.unidades),
            "ingresos": float(row.ingresos)
        } for row in stats]

        return jsonify(resultado), 200

    except Exception as e:
        print(f"Error detalle productos: {e}")
        return jsonify({"msg": str(e)}), 500


# --- MÓDULO DE RESERVAS ---

@bp.route('/reservas', methods=['GET'])
@jwt_required()
def get_reservas():
    # Traemos las pendientes primero
    reservas = Reserva.query.order_by(
        Reserva.estado == 'pendiente', 
        desc(Reserva.fecha_reserva)
    ).all()
    
    resultado = []
    for r in reservas:
        items = []
        for d in r.detalles:
            items.append({
                "producto": d.variante.producto.nombre,
                "talle": d.variante.talla,
                "cantidad": d.cantidad,
                "precio": float(d.precio_historico)
            })
        
        resultado.append({
            "id": r.id_reserva,
            "cliente": r.cliente_nombre,
            "telefono": r.telefono,
            "fecha": r.fecha_reserva.strftime('%d/%m/%Y'),
            "vencimiento": r.fecha_vencimiento.strftime('%d/%m/%Y'),
            "total": float(r.total),
            "sena": float(r.monto_sena),
            "saldo": float(r.saldo_restante),
            "estado": r.estado,
            "items": items,
            "is_vencida": r.estado == 'pendiente' and r.fecha_vencimiento < datetime.now()
        })
    return jsonify(resultado), 200

@bp.route('/reservas/crear', methods=['POST'])
@jwt_required()
def create_reserva():
    data = request.get_json()
    items = data.get('items', [])
    cliente = data.get('cliente', 'Anónimo')
    telefono = data.get('telefono', '')
    sena = float(data.get('sena', 0))
    total_calculado = float(data.get('total', 0))
    id_metodo_pago = data.get('id_metodo_pago') # Recibimos el método
    
    if not items: return jsonify({"msg": "Sin items"}), 400

    # 1. Crear Reserva (Lógica de stock y apartada)
    saldo = total_calculado - sena
    fecha_vencimiento = datetime.now() + timedelta(days=30)

    nueva_reserva = Reserva(
        cliente_nombre=cliente,
        telefono=telefono,
        total=total_calculado,
        monto_sena=sena,
        saldo_restante=saldo,
        fecha_vencimiento=fecha_vencimiento,
        estado='pendiente'
    )
    db.session.add(nueva_reserva)
    db.session.flush()

    # 2. REGISTRAR LA SEÑA COMO UNA VENTA (Para que impacte en caja y reportes)
    if sena > 0:
        if not id_metodo_pago:
             # Rollback si hay plata pero no método (seguridad)
             db.session.rollback()
             return jsonify({"msg": "Falta el medio de pago para la seña"}), 400

        # Creamos una venta por el monto de la seña
        venta_sena = Venta(
            total=sena,
            subtotal=sena,
            descuento=0,
            id_metodo_pago=id_metodo_pago,
            fecha_venta=datetime.now()
        )
        db.session.add(venta_sena)
        db.session.flush()

        # Creamos un detalle de venta simbólico para que el sistema sepa qué es
        # Usamos el primer artículo de la reserva como referencia visual, 
        # pero con cantidad 1 y precio = seña.
        # IMPORTANTE: No descontamos stock aquí (ya se descuenta en el paso 3)
        primer_item = items[0]
        detalle_v = DetalleVenta(
            id_venta=venta_sena.id_venta,
            id_variante=primer_item['id_variante'],
            cantidad=1, 
            precio_unitario=sena, # El precio es el valor de la seña
            subtotal=sena
        )
        db.session.add(detalle_v)

    # 3. Procesar Items y DESCONTAR STOCK FÍSICO
    for item in items:
        variante = ProductoVariante.query.get(item['id_variante'])
        
        if variante.inventario.stock_actual < item['cantidad']:
            db.session.rollback()
            return jsonify({"msg": f"Sin stock suficiente: {variante.producto.nombre}"}), 400

        # Descuento real del inventario
        variante.inventario.stock_actual -= item['cantidad']

        # SYNC TIENDA NUBE
        if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
            tn_service.update_variant_stock(
                tn_product_id=variante.producto.tiendanube_id,
                tn_variant_id=variante.tiendanube_variant_id,
                new_stock=variante.inventario.stock_actual
            )

        # Detalle de la reserva (guardamos qué productos son realmente)
        detalle_r = DetalleReserva(
            id_reserva=nueva_reserva.id_reserva,
            id_variante=variante.id_variante,
            cantidad=item['cantidad'],
            precio_historico=item['precio'],
            subtotal=item['subtotal']
        )
        db.session.add(detalle_r)

    db.session.commit()
    return jsonify({"msg": "Reserva creada exitosamente", "id": nueva_reserva.id_reserva}), 201


@bp.route('/reservas/<int:id>/retirar', methods=['POST'])
@jwt_required()
def retirar_reserva(id):
    reserva = Reserva.query.get_or_404(id)
    if reserva.estado != 'pendiente':
        return jsonify({"msg": "La reserva no está pendiente"}), 400

    # Registrar el ingreso del SALDO RESTANTE en caja
    if reserva.saldo_restante > 0:
        sesion = SesionCaja.query.filter_by(estado='abierta').first()
        if not sesion: return jsonify({"msg": "Debe abrir caja para cobrar el saldo"}), 400
        
        mov = MovimientoCaja(
            id_sesion=sesion.id_sesion,
            tipo='ingreso',
            monto=reserva.saldo_restante,
            descripcion=f"Saldo retiro Reserva #{reserva.id_reserva}"
        )
        db.session.add(mov)

        # Opcional: Aquí podrías crear una "Venta" formal si quieres que figure en reportes de ventas
        # y no solo como movimiento de caja. Para simplificar, lo dejamos como movimiento de caja.

    reserva.estado = 'retirada'
    db.session.commit()
    return jsonify({"msg": "Reserva retirada y saldo cobrado"}), 200

@bp.route('/reservas/<int:id>/cancelar', methods=['POST'])
@jwt_required()
def cancelar_reserva(id):
    reserva = Reserva.query.get_or_404(id)
    if reserva.estado != 'pendiente':
        return jsonify({"msg": "Solo se pueden cancelar reservas pendientes"}), 400

    # DEVOLVER STOCK
    for det in reserva.detalles:
        variante = det.variante
        variante.inventario.stock_actual += det.cantidad
        
        # SYNC TIENDA NUBE (Devolvemos el stock a la web)
        if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
            tn_service.update_variant_stock(
                tn_product_id=variante.producto.tiendanube_id,
                tn_variant_id=variante.tiendanube_variant_id,
                new_stock=variante.inventario.stock_actual
            )

    # Nota: La seña NO se devuelve automáticamente de la caja. 
    # Si se devuelve dinero, el cajero debe hacer un "Retiro" manual en caja.
    
    reserva.estado = 'cancelada'
    db.session.commit()
    return jsonify({"msg": "Reserva cancelada y stock restaurado"}), 200



@bp.route('/presupuestos', methods=['POST'])
@jwt_required()
def create_budget():
    data = request.get_json()
    items = data.get('items', [])
    cliente = data.get('cliente', 'Consumidor Final')
    descuento_pct = int(data.get('descuento', 0))
    
    if not items: return jsonify({"msg": "El presupuesto está vacío"}), 400

    # Calcular totales desde el backend para seguridad
    subtotal_gral = 0
    detalles_para_guardar = []

    for item in items:
        precio = float(item['precio'])
        cantidad = int(item['cantidad'])
        subtotal_item = precio * cantidad
        subtotal_gral += subtotal_item
        
        detalles_para_guardar.append({
            "id_variante": item['id_variante'],
            "cantidad": cantidad,
            "precio": precio,
            "subtotal": subtotal_item
        })

    # Aplicar Descuento
    monto_descuento = subtotal_gral * (descuento_pct / 100)
    total_final = subtotal_gral - monto_descuento

    # Crear Cabecera
    nuevo_presupuesto = Presupuesto(
        cliente_nombre=cliente,
        subtotal=subtotal_gral,
        descuento_porcentaje=descuento_pct,
        total_final=total_final,
        observaciones=data.get('observaciones', '')
    )
    db.session.add(nuevo_presupuesto)
    db.session.flush()

    # Guardar Detalles
    for d in detalles_para_guardar:
        det = DetallePresupuesto(
            id_presupuesto=nuevo_presupuesto.id_presupuesto,
            id_variante=d['id_variante'],
            cantidad=d['cantidad'],
            precio_unitario=d['precio'],
            subtotal=d['subtotal']
        )
        db.session.add(det)

    db.session.commit()
    
    return jsonify({
        "msg": "Presupuesto creado", 
        "id": nuevo_presupuesto.id_presupuesto,
        "total": total_final
    }), 201


@bp.route('/<int:id_venta>/anular', methods=['DELETE'])
@jwt_required()
def anular_venta(id_venta):
    try:
        venta = Venta.query.get_or_404(id_venta)
        
        # Validación de seguridad
        if getattr(venta, 'estado', None) == 'anulada': 
             return jsonify({"msg": "Esta venta ya está anulada"}), 400

        detalles = DetalleVenta.query.filter_by(id_venta=id_venta).all()
        
        # --- BUCLE DE DEVOLUCIÓN ---
        for d in detalles:
            variante = ProductoVariante.query.get(d.id_variante)
            
            if variante and variante.inventario:
                # A. Devolver Stock Local (ERP)
                variante.inventario.stock_actual += d.cantidad
                
                # B. Sincronizar con Tienda Nube (NUEVO)
                # Verificamos si el producto está conectado a la nube
                if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
                    try:
                        tn_service.update_variant_stock(
                            tn_product_id=variante.producto.tiendanube_id,
                            tn_variant_id=variante.tiendanube_variant_id,
                            new_stock=variante.inventario.stock_actual
                        )
                        print(f"✅ TN Sync: Stock restaurado para {variante.producto.nombre}")
                    except Exception as tn_error:
                        # Si falla internet o la API, lo logueamos pero NO rompemos la anulación local
                        print(f"⚠️ Error sincronizando Tienda Nube al anular: {tn_error}")

        # Borrado físico de la venta (o cambio de estado)
        for d in detalles:
            db.session.delete(d)
        db.session.delete(venta)

        db.session.commit()
        return jsonify({"msg": f"Venta #{id_venta} anulada, stock local y nube actualizados."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al anular", "error": str(e)}), 500

@bp.route('/notas-credito/crear', methods=['POST'])
@jwt_required()
def crear_nota_credito():
    data = request.get_json()
    try:
        monto = data.get('monto')
        observaciones = data.get('observaciones', '')

        # Validaciones básicas
        if not monto or float(monto) <= 0:
            return jsonify({"msg": "El monto debe ser mayor a 0"}), 400

        # Generar Código Único (Intenta hasta que encuentre uno libre)
        codigo = NotaCredito.generar_codigo()
        while NotaCredito.query.filter_by(codigo=codigo).first():
            codigo = NotaCredito.generar_codigo()

        # Crear Objeto
        nueva_nota = NotaCredito(
            codigo=codigo,
            monto=float(monto),
            fecha_emision=datetime.now(),
            estado='activa',
            observaciones=observaciones
        )
        
        db.session.add(nueva_nota)
        db.session.commit()
        
        return jsonify({
            "msg": "Nota creada exitosamente", 
            "nota": {
                "id": nueva_nota.id_nota,
                "codigo": nueva_nota.codigo, 
                "monto": nueva_nota.monto
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print("Error creando nota:", e)
        return jsonify({"msg": "Error al crear nota", "error": str(e)}), 500


# 1. LISTAR NOTAS (Para la página de gestión)
@bp.route('/notas-credito', methods=['GET'])
@jwt_required()
def get_notas_credito():
    notas = NotaCredito.query.order_by(NotaCredito.fecha_emision.desc()).all()
    result = []
    for n in notas:
        result.append({
            "id": n.id_nota,
            "codigo": n.codigo,
            "monto": n.monto,
            "estado": n.estado,
            "fecha": n.fecha_emision.strftime('%d/%m/%Y %H:%M'),
            "observaciones": n.observaciones
        })
    return jsonify(result), 200

# 2. VALIDAR CÓDIGO (Para el POS antes de cobrar)
@bp.route('/notas-credito/validar/<code>', methods=['GET'])
@jwt_required()
def validar_nota(code):
    nota = NotaCredito.query.filter_by(codigo=code).first()
    
    if not nota:
        return jsonify({"valid": False, "msg": "Código inexistente"}), 404
        
    if nota.estado != 'activa':
        return jsonify({"valid": False, "msg": "Esta nota ya fue utilizada"}), 400
        
    return jsonify({
        "valid": True,
        "id": nota.id_nota,
        "monto": nota.monto,
        "msg": "Nota válida"
    }), 200

# 3. MODIFICAR EL CHECKOUT (Para "quemar" la nota)
# Busca tu función 'checkout' actual y modifícala así:

@bp.route('/checkout', methods=['POST'])
@jwt_required()
def create_sale():
    try:
        data = request.get_json()
        # user_id = get_jwt_identity() # Comentado temporalmente hasta que tengas la columna
        
        # Datos de entrada
        items = data.get('items', [])
        metodo_pago_id = data.get('metodo_pago_id')
        total_final = data.get('total_final')
        subtotal_calculado = data.get('subtotal_calculado')
        codigo_nota = data.get('codigo_nota_credito')

        if not items:
            return jsonify({"msg": "Carrito vacío"}), 400

        # 1. Crear la Cabecera de la Venta
        nueva_venta = Venta(
            fecha_venta=datetime.now(), # Corregido: fecha_venta
            total=total_final,
            # id_usuario=user_id,     # Comentado: id_usuario
            id_metodo_pago=metodo_pago_id,
            estado='completada'
        )
        db.session.add(nueva_venta)
        db.session.flush() # Esto genera el ID (id_venta)

        # 2. Procesar la Nota de Crédito
        if codigo_nota:
            nota = NotaCredito.query.filter_by(codigo=codigo_nota, estado='activa').first()
            if nota:
                nota.estado = 'usada'
                nota.id_venta_uso = nueva_venta.id_venta # <--- CORREGIDO (antes .id)
            else:
                pass

        # 3. Procesar los Ítems
        for item_data in items:
            
            # --- LÓGICA PARA ÍTEM MANUAL (CUSTOM) ---
            if item_data.get('is_custom') == True:
                detalle = DetalleVenta(
                    id_venta=nueva_venta.id_venta, # <--- CORREGIDO (antes .id)
                    id_variante=None,
                    producto_nombre=item_data['nombre'],
                    cantidad=item_data['cantidad'],
                    precio_unitario=item_data['precio'],
                    subtotal=item_data['subtotal']
                )
                db.session.add(detalle)
                continue 
            # ----------------------------------------

            # --- LÓGICA PARA ÍTEM DE INVENTARIO (NORMAL) ---
            variante = ProductoVariante.query.get(item_data['id_variante'])
            
            if not variante:
                db.session.rollback()
                return jsonify({"msg": f"Producto no encontrado: {item_data.get('sku')}"}), 400

            # Descontar Stock
            if variante.inventario:
                if variante.inventario.stock_actual < item_data['cantidad']:
                    db.session.rollback()
                    return jsonify({"msg": f"Stock insuficiente para {item_data['nombre']}"}), 400
                
                variante.inventario.stock_actual -= item_data['cantidad']
            
            # Crear Detalle Normal
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta, # <--- CORREGIDO (antes .id)
                id_variante=variante.id_variante,
                producto_nombre=item_data['nombre'],
                cantidad=item_data['cantidad'],
                precio_unitario=item_data['precio'],
                subtotal=item_data['subtotal']
            )
            db.session.add(detalle)

        # 4. Confirmar todo
        db.session.commit()
        
        return jsonify({
            "msg": "Venta registrada exitosamente", 
            "id": nueva_venta.id_venta # <--- CORREGIDO (antes .id)
        }), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"msg": "Error en el servidor", "error": str(e)}), 500