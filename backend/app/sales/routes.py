#backend/app/sales/routes.py
import csv
import io
from io import StringIO
from flask import Blueprint, jsonify, request, Response, send_file
from app.extensions import db
# IMPORTAMOS DESDE TUS ARCHIVOS SEPARADOS
from app.sales.models import Venta, DetalleVenta, MetodoPago, SesionCaja, MovimientoCaja, Reserva, DetalleReserva, Presupuesto, DetallePresupuesto, NotaCredito
from app.products.models import Producto, ProductoVariante, Inventario, Categoria
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import desc, func, extract
from datetime import date, datetime, timedelta
from app.services.tiendanube_service import tn_service
from app.sales.models import VentaPago
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit

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
        solo_actual = request.args.get('current_session') == 'true'
        
        query = Venta.query.options(
            db.joinedload(Venta.metodo),
            db.joinedload(Venta.pagos).joinedload(VentaPago.metodo)
        ).order_by(desc(Venta.fecha_venta))

        if solo_actual:
            sesion = SesionCaja.query.filter_by(estado='abierta').first()
            if sesion:
                query = query.filter(Venta.fecha_venta >= sesion.fecha_apertura)
            else:
                return jsonify({"history": [], "today_summary": {"total": 0, "count": 0}}), 200
        else:
            query = query.limit(100)

        ventas = query.all()
        
        lista_ventas = []
        for v in ventas:
            # --- DETALLE DE ITEMS ---
            items_summary = []
            items_detail = []
            for d in v.detalles:
                if d.variante:
                    nombre = d.variante.producto.nombre if d.variante.producto else "Prod. Borrado"
                    talle = d.variante.talla
                else:
                    nombre = getattr(d, 'producto_nombre', 'Ítem Manual') or 'Ítem Manual'
                    talle = "-"
                
                txt = f"{nombre} ({talle}) x{d.cantidad}" if talle != "-" else f"{nombre} x{d.cantidad}"
                items_summary.append(txt)
                items_detail.append({"nombre": nombre, "talle": talle, "cantidad": d.cantidad, "precio": float(d.precio_unitario), "subtotal": float(d.subtotal)})

            # --- LÓGICA VISUAL (TEXTO) ---
            metodo_visual = "N/A"
            if v.pagos and len(v.pagos) > 0:
                partes = []
                for p in v.pagos:
                    n = p.metodo.nombre if p.metodo else "?"
                    partes.append(f"{n} ${float(p.monto):g}")
                metodo_visual = " + ".join(partes)
            else:
                metodo_visual = v.metodo.nombre if v.metodo else "N/A"

            # --- LÓGICA DE DATOS (NÚMEROS PARA EL FRONTEND) ---
            # Esto es lo nuevo: enviamos el array limpio para que el frontend pueda sumar bien
            pagos_data = []
            if v.pagos and len(v.pagos) > 0:
                for p in v.pagos:
                    pagos_data.append({
                        "metodo": p.metodo.nombre if p.metodo else "Otros",
                        "monto": float(p.monto)
                    })
            else:
                # Si es venta vieja o simple, simulamos la estructura
                nombre_m = v.metodo.nombre if v.metodo else "Otros"
                pagos_data.append({"metodo": nombre_m, "monto": float(v.total)})

            lista_ventas.append({
                "id": v.id_venta,
                "fecha": v.fecha_venta.strftime('%d/%m/%Y %H:%M'),
                "total": float(v.total),
                "metodo": metodo_visual, # Texto para mostrar
                "pagos_detalle": pagos_data, # Datos para calcular <--- CLAVE
                "items": ", ".join(items_summary),
                "items_detail": items_detail,
                "estado": v.estado
            })

        hoy = date.today()
        total_hoy = db.session.query(func.sum(Venta.total)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0
        cantidad_ventas_hoy = db.session.query(func.count(Venta.id_venta)).filter(func.date(Venta.fecha_venta) == hoy).scalar() or 0

        return jsonify({
            "history": lista_ventas,
            "today_summary": {"total": float(total_hoy), "count": cantidad_ventas_hoy}
        }), 200

    except Exception as e:
        print(f"Error historial: {e}")
        return jsonify({"msg": "Error cargando historial"}), 500

        

# --- NUEVO ENDPOINT: Listar Métodos ---
@bp.route('/payment-methods', methods=['GET'])
@jwt_required()
def get_payment_methods():
    metodos = MetodoPago.query.all()
    return jsonify([{"id": m.id_metodo_pago, "nombre": m.nombre} for m in metodos]), 200

@bp.route('/scan/<string:code>', methods=['GET']) # Cambiamos 'sku' por 'code' para ser genéricos
@jwt_required()
def scan_product(code):
    # 1. Intentar buscar por SKU exacto (comportamiento original)
    variante = ProductoVariante.query.filter_by(codigo_sku=code).first()
    
    # 2. Si no encuentra y el código es numérico, buscar por ID Interno
    if not variante and code.isdigit():
        variante = ProductoVariante.query.get(int(code))

    if not variante: 
        return jsonify({"found": False, "msg": "Producto no encontrado"}), 404
        
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
    sesion = SesionCaja.query.filter_by(estado='abierta').first()
    if not sesion: return jsonify({"estado": "cerrada"}), 200
    
    # Optimizamos la consulta para traer los pagos junto con la venta (evita errores de carga)
    ventas = Venta.query.options(db.joinedload(Venta.pagos).joinedload(VentaPago.metodo))\
        .filter(Venta.fecha_venta >= sesion.fecha_apertura).all()
        
    retiros = MovimientoCaja.query.filter_by(id_sesion=sesion.id_sesion, tipo='retiro').all()
    
    lista_retiros = [{"id": r.id_movimiento, "hora": r.fecha.strftime('%H:%M'), "descripcion": r.descripcion, "monto": float(r.monto)} for r in retiros]
    total_retiros = sum(m.monto for m in retiros)

    # --- LÓGICA DE SUMA MIXTA CORREGIDA ---
    total_ventas = 0
    desglose = {"Efectivo": 0, "Tarjeta": 0, "Transferencia": 0, "Otros": 0}

    for v in ventas:
        total_ventas += v.total
        
        # Si tiene pagos en la tabla nueva (prioridad)
        if v.pagos and len(v.pagos) > 0:
            for p in v.pagos:
                nombre_metodo = p.metodo.nombre if p.metodo else "Otros"
                monto = float(p.monto)
                
                # Clasificación por nombre
                if "Efectivo" in nombre_metodo: desglose["Efectivo"] += monto
                elif "Tarjeta" in nombre_metodo: desglose["Tarjeta"] += monto
                elif "Transferencia" in nombre_metodo: desglose["Transferencia"] += monto
                else: desglose["Otros"] += monto
        else:
            # Fallback para ventas antiguas (sin tabla pagos)
            nombre_metodo = v.metodo.nombre if v.metodo else "Otros"
            if "Efectivo" in nombre_metodo: desglose["Efectivo"] += float(v.total)
            elif "Tarjeta" in nombre_metodo: desglose["Tarjeta"] += float(v.total)
            elif "Transferencia" in nombre_metodo: desglose["Transferencia"] += float(v.total)
            else: desglose["Otros"] += float(v.total)

    efectivo_en_caja = float(sesion.monto_inicial) + desglose["Efectivo"] - float(total_retiros)

    return jsonify({
        "estado": "abierta",
        "id_sesion": sesion.id_sesion,
        "fecha_apertura": sesion.fecha_apertura.strftime('%d/%m %H:%M'),
        "monto_inicial": float(sesion.monto_inicial),
        "ventas_total": float(total_ventas),
        "total_retiros": float(total_retiros),
        "movimientos": lista_retiros,
        "desglose": desglose,
        "totales_esperados": {
            "efectivo_en_caja": efectivo_en_caja,
            "digital": desglose["Tarjeta"] + desglose["Transferencia"] + desglose["Otros"]
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
    if not sesion: return jsonify({"msg": "No hay caja para cerrar"}), 400

    data = request.get_json()
    total_real_usuario = float(data.get('total_real', 0))

    ventas = Venta.query.filter(Venta.fecha_venta >= sesion.fecha_apertura).all()
    
    # Calcular Efectivo Real Sistema (Soportando mixtos)
    ventas_efectivo = 0
    total_ventas_global = 0

    for v in ventas:
        total_ventas_global += v.total
        if v.pagos:
            for p in v.pagos:
                if "Efectivo" in (p.metodo.nombre or ""):
                    ventas_efectivo += p.monto
        else:
            if v.metodo and "Efectivo" in v.metodo.nombre:
                ventas_efectivo += v.total

    retiros = MovimientoCaja.query.filter_by(id_sesion=sesion.id_sesion, tipo='retiro').all()
    total_retiros = sum(m.monto for m in retiros)

    esperado_efectivo = float(sesion.monto_inicial) + float(ventas_efectivo) - float(total_retiros)
    diferencia = total_real_usuario - esperado_efectivo

    sesion.fecha_cierre = datetime.now()
    sesion.total_ventas_sistema = total_ventas_global
    sesion.total_real = total_real_usuario
    sesion.diferencia = diferencia
    sesion.estado = 'cerrada'

    db.session.commit()

    return jsonify({
        "msg": "Caja cerrada",
        "resumen": {
            "esperado": esperado_efectivo,
            "real": total_real_usuario,
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
    # Nota: Quitamos jwt_required para facilitar descarga directa desde navegador
    
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
        # --- LÓGICA CORREGIDA PARA ÍTEMS MANUALES ---
        lista_nombres_items = []
        for d in v.detalles:
            if d.variante:
                # Caso: Producto de Inventario
                nombre = d.variante.producto.nombre if d.variante.producto else "Producto Borrado"
                talle = d.variante.talla
                lista_nombres_items.append(f"{nombre} ({talle}) x{d.cantidad}")
            else:
                # Caso: Ítem Manual (Sin variante)
                # Usamos getattr por seguridad
                nombre = getattr(d, 'producto_nombre', 'Ítem Manual') or 'Ítem Manual'
                lista_nombres_items.append(f"{nombre} x{d.cantidad}")
        
        # Unimos todo en un solo texto separado por " | "
        items_str = " | ".join(lista_nombres_items)
        # --------------------------------------------

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

# ==========================================
# REEMPLAZAR DESDE AQUÍ
# ==========================================

@bp.route('/reservas/crear', methods=['POST'])
@jwt_required()
def create_reserva():
    data = request.get_json()
    items = data.get('items', [])
    cliente = data.get('cliente', 'Anónimo')
    telefono = data.get('telefono', '')
    sena = float(data.get('sena', 0))
    total_calculado = float(data.get('total', 0))
    id_metodo_pago = data.get('id_metodo_pago') 
    
    if not items: return jsonify({"msg": "Sin items"}), 400

    try:
        # 1. Crear Reserva (Lógica interna de apartado)
        saldo = total_calculado - sena
        fecha_vencimiento = datetime.now() + timedelta(days=15)

        nueva_reserva = Reserva(
            cliente_nombre=cliente,
            telefono=telefono,
            total=total_calculado,
            monto_sena=sena,
            saldo_restante=saldo,
            fecha_reserva=datetime.now(),
            fecha_vencimiento=fecha_vencimiento,
            estado='pendiente'
        )
        db.session.add(nueva_reserva)
        db.session.flush() # Obtenemos ID de reserva

        # 2. REGISTRAR LA SEÑA COMO UNA VENTA REAL
        # Esto es lo que hace que aparezca en tu página de Ventas
        if sena > 0:
            if not id_metodo_pago:
                db.session.rollback()
                return jsonify({"msg": "Falta el medio de pago para la seña"}), 400

            venta_sena = Venta(
                total=sena,
                subtotal=sena,
                descuento=0,
                id_metodo_pago=id_metodo_pago,
                fecha_venta=datetime.now(),
                # Guardamos referencia en observaciones
                observaciones=f"Seña Reserva #{nueva_reserva.id_reserva} - {cliente}"
            )
            db.session.add(venta_sena)
            db.session.flush()

            # Creamos un detalle visual para el historial
            detalle_v = DetalleVenta(
                id_venta=venta_sena.id_venta,
                id_variante=None, # No descontamos stock aquí (se descuenta abajo)
                producto_nombre=f"SEÑA RESERVA #{nueva_reserva.id_reserva} ({items[0].get('nombre')}...)", 
                cantidad=1, 
                precio_unitario=sena,
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

            # SYNC TIENDA NUBE (Si corresponde)
            if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
                try:
                    tn_service.update_variant_stock(
                        tn_product_id=variante.producto.tiendanube_id,
                        tn_variant_id=variante.tiendanube_variant_id,
                        new_stock=variante.inventario.stock_actual
                    )
                except Exception as e:
                    print(f"Error Sync TN Reserva: {e}")

            # Guardar el detalle real en la tabla de reservas
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

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


@bp.route('/reservas/<int:id>/retirar', methods=['POST'])
@jwt_required()
def retirar_reserva(id):
    # Recibimos el método de pago desde el frontend
    data = request.get_json() or {}
    id_metodo_pago = data.get('id_metodo_pago')

    reserva = Reserva.query.get_or_404(id)
    if reserva.estado != 'pendiente':
        return jsonify({"msg": "La reserva no está pendiente"}), 400

    try:
        # REGISTRAR VENTA POR EL SALDO RESTANTE
        # Aquí estaba el problema: antes creabas un MovimientoCaja, ahora creamos una VENTA.
        if reserva.saldo_restante > 0:
            if not id_metodo_pago:
                return jsonify({"msg": "Seleccione un método de pago para el saldo"}), 400

            nueva_venta = Venta(
                total=reserva.saldo_restante,
                subtotal=reserva.saldo_restante,
                descuento=0,
                id_metodo_pago=id_metodo_pago,
                fecha_venta=datetime.now(),
                observaciones=f"Saldo Restante Reserva #{reserva.id_reserva} - {reserva.cliente_nombre}"
            )
            db.session.add(nueva_venta)
            db.session.flush()

            # Detalle visual para el historial
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                id_variante=None, # Ya se descontó stock al crear la reserva
                producto_nombre=f"SALDO RETIRO RESERVA #{reserva.id_reserva}",
                cantidad=1,
                precio_unitario=reserva.saldo_restante,
                subtotal=reserva.saldo_restante
            )
            db.session.add(detalle)

        reserva.estado = 'retirada'
        db.session.commit()
        return jsonify({"msg": "Reserva retirada y venta registrada"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500

        
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



@bp.route('/presupuestos', methods=['GET', 'POST'])
@jwt_required()
def presupuestos():
    # ==========================================
    # 1. LISTAR HISTORIAL (GET)
    # ==========================================
    if request.method == 'GET':
        try:
            historial = Presupuesto.query.order_by(Presupuesto.fecha.desc()).limit(50).all()
            
            output = []
            for p in historial:
                items_formatted = []
                for det in p.detalles:
                    # Obtenemos datos desde la relación (si la variante aún existe)
                    nombre_prod = "Producto eliminado"
                    talle_prod = "-"
                    
                    if det.variante:
                        talle_prod = det.variante.talla # Leemos 'talla' de la variante
                        if det.variante.producto:
                            nombre_prod = det.variante.producto.nombre

                    items_formatted.append({
                        "id_variante": det.id_variante,
                        "cantidad": det.cantidad,
                        "precio": float(det.precio_unitario),
                        "subtotal": float(det.subtotal),
                        "nombre": nombre_prod,
                        "talle": talle_prod 
                    })

                output.append({
                    "id": p.id_presupuesto,
                    "fecha": p.fecha.isoformat(),
                    "cliente": p.cliente_nombre,
                    "total": float(p.total_final),
                    "descuento": p.descuento_porcentaje,
                    "items": items_formatted
                })
            
            return jsonify(output), 200
        except Exception as e:
            print(f"Error GET presupuestos: {e}")
            return jsonify([]), 500

    # ==========================================
    # 2. CREAR PRESUPUESTO (POST)
    # ==========================================
    if request.method == 'POST':
        data = request.get_json()
        
        try:
            items = data.get('items', [])
            cliente = data.get('cliente', 'Consumidor Final')
            descuento_pct = int(data.get('descuento', 0))
            
            if not items: return jsonify({"msg": "Presupuesto vacío"}), 400

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

            monto_descuento = subtotal_gral * (descuento_pct / 100)
            total_final = subtotal_gral - monto_descuento

            nuevo_presupuesto = Presupuesto(
                cliente_nombre=cliente,
                subtotal=subtotal_gral,
                descuento_porcentaje=descuento_pct,
                total_final=total_final,
                fecha=datetime.now()
            )
            db.session.add(nuevo_presupuesto)
            db.session.flush()

            for d in detalles_para_guardar:
                # CORRECCIÓN: No pasamos 'talle' al constructor porque no existe en la tabla
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

        except Exception as e:
            db.session.rollback()
            print(f"Error POST presupuesto: {e}")
            return jsonify({"msg": str(e)}), 500


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

# 3. CHECKOUT (Para "quemar" la nota)
@bp.route('/checkout', methods=['POST'])
@jwt_required()
def checkout():
    try:
        data = request.get_json()
        print(f"📦 INICIO CHECKOUT. Items: {len(data.get('items', []))}") 
        items = data.get('items', [])
        cliente_id = data.get('cliente_id')
        codigo_nota = data.get('codigo_nota_credito')

        # Nuevos campos para pago mixto
        pagos_multiples = data.get('pagos', []) # Lista de {id_metodo: 1, monto: 500}
        metodo_pago_id_simple = data.get('metodo_pago_id') # Fallback simple
        
        # Validaciones básicas
        if not items: return jsonify({"msg": "Carrito vacío"}), 400
        # Permitimos venta sin metodo si es mixto (se valida en frontend), pero por seguridad backend:
        # if not metodo_pago_id: return jsonify({"msg": "Falta método de pago"}), 400

        # --- 1. LÓGICA DE NOTA DE CRÉDITO ---
        nota_usada = None
        observaciones_venta = ""
        
        if codigo_nota:
            nota_usada = NotaCredito.query.filter_by(codigo=codigo_nota).first()
            if not nota_usada:
                return jsonify({"msg": "Código de nota no encontrado"}), 404
            if nota_usada.estado != 'activa':
                return jsonify({"msg": "La nota ya fue utilizada"}), 400
            
            nota_usada.estado = 'usada'
            observaciones_venta = f"Pagado con Nota {codigo_nota}"

        # --- 2. CREACIÓN DE VENTA (CABECERA) ---
        nueva_venta = Venta(
            total=data.get('total_final'),
            subtotal=data.get('subtotal_calculado'),
            descuento=0, 
            fecha_venta=datetime.now(), # Usar datetime.now() del servidor
            id_cliente=cliente_id,
            id_metodo_pago=metodo_pago_id_simple,
            observaciones=observaciones_venta
        )
        db.session.add(nueva_venta)
        db.session.flush() # Obtenemos el ID de venta

        # --- GUARDAR PAGOS ---
        if pagos_multiples:
            for p in pagos_multiples:
                nuevo_pago = VentaPago(
                    id_venta=nueva_venta.id_venta,
                    id_metodo_pago=p['id_metodo'],
                    monto=p['monto']
                )
                db.session.add(nuevo_pago)
        elif metodo_pago_id_simple:
            # Si viene formato simple, creamos 1 registro de pago igual para mantener consistencia
            pago_unico = VentaPago(
                id_venta=nueva_venta.id_venta,
                id_metodo_pago=metodo_pago_id_simple,
                monto=data.get('total_final')
            )
            db.session.add(pago_unico)

        if nota_usada:
            nota_usada.id_venta_uso = nueva_venta.id_venta

        # --- 3. PROCESAR ITEMS ---
        for item in items:
            nombre_item = item.get('nombre', 'Item sin nombre')
            es_custom = item.get('is_custom') # Bandera del Frontend

            # =======================================================
            # CASO A: ÍTEM MANUAL (Sin stock, sin Tienda Nube)
            # =======================================================
            if es_custom is True or str(es_custom).lower() == 'true':
                print(f"   🔸 Ítem Manual detectado: {nombre_item}")
                detalle = DetalleVenta(
                    id_venta=nueva_venta.id_venta,
                    id_variante=None, # Permitimos NULL aquí
                    producto_nombre=nombre_item,
                    cantidad=item['cantidad'],
                    precio_unitario=item['precio'],
                    subtotal=item['subtotal']
                )
                db.session.add(detalle)
                continue # Saltamos al siguiente ítem (NO descontamos stock)

            # =======================================================
            # CASO B: ÍTEM DE INVENTARIO (Con Stock y Sync TN)
            # =======================================================
            id_variante = item.get('id_variante')
            variante = ProductoVariante.query.get(id_variante)
            
            # Protección: Si el producto fue borrado mientras se vendía
            if not variante:
                db.session.rollback()
                return jsonify({"msg": f"El producto '{nombre_item}' ya no existe en base de datos."}), 400

            # Validar Stock Local
            stock_actual = variante.inventario.stock_actual if variante.inventario else 0
            cantidad_solicitada = int(item['cantidad'])

            if stock_actual < cantidad_solicitada:
                db.session.rollback()
                return jsonify({"msg": f"Sin stock suficiente para: {variante.producto.nombre}"}), 400
            
            # Descontar Stock Local
            if variante.inventario:
                variante.inventario.stock_actual -= cantidad_solicitada
                nuevo_stock = variante.inventario.stock_actual
            
                # --- SYNC TIENDA NUBE (Tu código original + Protección) ---
                # Usamos getattr para que NO explote si faltan columnas en la BD
                tn_var_id = getattr(variante, 'tiendanube_variant_id', None)
                tn_prod_id = getattr(variante.producto, 'tiendanube_id', None)

                if tn_var_id and tn_prod_id:
                    try:
                        # Usamos tu servicio original 'tn_service'
                        tn_service.update_variant_stock(
                            tn_product_id=tn_prod_id,
                            tn_variant_id=tn_var_id,
                            new_stock=nuevo_stock
                        )
                        print(f"   ☁️ TN Sync OK: {variante.producto.nombre} -> Stock {nuevo_stock}")
                    except Exception as e:
                        print(f"   ⚠️ Error sync TN para {variante.producto.nombre}: {e}")
                # ---------------------------------------------------------

            # Guardar Detalle
            detalle = DetalleVenta(
                id_venta=nueva_venta.id_venta,
                id_variante=variante.id_variante,
                producto_nombre=variante.producto.nombre, # Guardamos nombre original
                cantidad=cantidad_solicitada,
                precio_unitario=item['precio'],
                subtotal=item['subtotal']
            )
            db.session.add(detalle)

        db.session.commit()
        return jsonify({"msg": "Venta exitosa", "id": nueva_venta.id_venta}), 201

    except Exception as e:
        db.session.rollback()
        print(f"🔥 Error Checkout: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"msg": "Error procesando venta", "error": str(e)}), 500



@bp.route('/caja/<int:id>/pdf', methods=['GET'])
@jwt_required()
def export_caja_pdf(id):
    sesion = SesionCaja.query.get_or_404(id)
    
    # Cargar ventas con sus pagos
    ventas = Venta.query.options(db.joinedload(Venta.pagos).joinedload(VentaPago.metodo))\
        .filter(Venta.fecha_venta >= sesion.fecha_apertura, Venta.fecha_venta <= sesion.fecha_cierre)\
        .order_by(Venta.fecha_venta.asc()).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()

    # Título y Datos Generales (Igual que antes)
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=1, spaceAfter=20)
    elements.append(Paragraph(f"Reporte de Cierre de Caja #{sesion.id_sesion}", title_style))

    datos_grales = [
        ["Apertura:", sesion.fecha_apertura.strftime('%d/%m/%Y %H:%M')],
        ["Cierre:", sesion.fecha_cierre.strftime('%d/%m/%Y %H:%M')],
        ["Caja Inicial:", f"$ {sesion.monto_inicial:,.2f}"],
        ["Total Sistema:", f"$ {sesion.total_ventas_sistema:,.2f}"],
        ["Total Real:", f"$ {sesion.total_real:,.2f}"],
        ["Diferencia:", f"$ {sesion.diferencia:,.2f}"]
    ]
    t_info = Table(datos_grales, colWidths=[120, 200])
    t_info.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('TEXTCOLOR', (0,5), (1,5), colors.red if sesion.diferencia < 0 else colors.green),
        ('FONTNAME', (0,5), (1,5), 'Helvetica-Bold'),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 20))

    # Tabla de Ventas
    data_ventas = [['Hora', 'Ticket', 'Método / Desglose', 'Items', 'Total']]
    total_acumulado = 0
    
    for v in ventas:
        hora = v.fecha_venta.strftime('%H:%M')
        
        # --- LÓGICA VISUAL MÉTODO EN PDF ---
        if v.pagos and len(v.pagos) > 1:
            # Formato: "Mixto: Efec $500 / Transf $500"
            detalles = [f"{p.metodo.nombre[:4]} ${p.monto:,.0f}" for p in v.pagos if p.metodo]
            metodo_str = "MIXTO: " + " / ".join(detalles)
        elif v.pagos and len(v.pagos) == 1:
            metodo_str = v.pagos[0].metodo.nombre
        else:
            metodo_str = v.metodo.nombre if v.metodo else "-"
        
        # Resumen items
        cant_items = len(v.detalles)
        resumen_items = f"{cant_items} items"
        if cant_items > 0:
            first = v.detalles[0].producto_nombre or "Prod"
            resumen_items = f"{first[:15]}..." if cant_items == 1 else f"{first[:10]}... (+{cant_items-1})"

        data_ventas.append([hora, f"#{v.id_venta}", metodo_str, resumen_items, f"$ {v.total:,.0f}"])
        total_acumulado += v.total

    data_ventas.append(['', '', '', 'TOTAL:', f"$ {total_acumulado:,.0f}"])

    # Estilos tabla (Ajustamos anchos para que entre el texto mixto)
    table = Table(data_ventas, colWidths=[40, 50, 200, 120, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('FONTSIZE', (0,0), (-1,-1), 8), # Letra un poco más chica para que entre el mixto
        ('ALIGN', (-1,0), (-1,-1), 'RIGHT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)
    return send_file(buffer, mimetype='application/pdf', as_attachment=False, download_name=f'cierre_{id}.pdf')


@bp.route('/presupuestos', methods=['GET'])
@jwt_required()
def list_presupuestos():
    try:
        # Últimos 50 presupuestos
        history = Presupuesto.query.order_by(Presupuesto.fecha.desc()).limit(50).all()
        
        output = []
        for p in history:
            items_formatted = []
            # Asumiendo que la relación se llama 'detalles' en tu modelo
            for item in p.detalles: 
                items_formatted.append({
                    'sku': item.sku,
                    'nombre': item.nombre_producto,
                    'talle': item.talle,
                    'cantidad': item.cantidad,
                    'precio': item.precio_unitario,
                    'subtotal': item.subtotal,
                    'id_variante': getattr(item, 'id_variante', None) or item.sku # Fallback
                })

            output.append({
                'id': p.id,
                'fecha': p.fecha.isoformat(), # Convierte datetime a string
                'cliente': p.cliente,
                'total': p.total,
                'descuento': getattr(p, 'descuento_porcentaje', 0),
                'items': items_formatted
            })
            
        return jsonify(output), 200
        
    except Exception as e:
        print(f"Error listando presupuestos: {e}")
        return jsonify([]), 500


# Asegúrate de tener estos imports al principio si no los tienes
# from reportlab.lib.colors import HexColor

@bp.route('/presupuestos/<int:id>/pdf', methods=['GET'])
@jwt_required()
def download_budget_pdf(id):
    try:
        presupuesto = Presupuesto.query.get_or_404(id)
        
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        # --- ENCABEZADO ---
        c.setFont("Helvetica-Bold", 18)
        c.drawString(20*mm, height - 20*mm, "PRESUPUESTO")
        
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawString(20*mm, height - 30*mm, f"Nro: #{presupuesto.id_presupuesto}")
        c.drawString(20*mm, height - 35*mm, f"Fecha: {presupuesto.fecha.strftime('%d/%m/%Y')}")
        c.drawString(20*mm, height - 40*mm, f"Cliente: {presupuesto.cliente_nombre}")
        c.setFillColorRGB(0, 0, 0)

        # --- CONFIGURACIÓN TABLA ---
        y = height - 60*mm
        col_prod = 20*mm
        col_talle = 105*mm
        col_cant = 125*mm
        col_unit = 145*mm
        col_sub = 175*mm

        # Fondo Gris Encabezados
        c.setFillColorRGB(0.95, 0.95, 0.95)
        c.rect(20*mm, y - 2*mm, 170*mm, 8*mm, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)

        # Textos Encabezado
        c.setFont("Helvetica-Bold", 9)
        c.drawString(col_prod, y, "Producto / SKU")
        c.drawString(col_talle, y, "Talle")
        c.drawString(col_cant, y, "Cant.")
        c.drawString(col_unit, y, "Unitario")
        c.drawString(col_sub, y, "Subtotal")
        
        c.setLineWidth(1)
        c.line(20*mm, y-2*mm, 190*mm, y-2*mm)
        c.setLineWidth(0.5)

        y -= 10*mm 
        
        # --- FILAS ---
        for det in presupuesto.detalles:
            nombre = "Producto eliminado"
            sku = "-"
            talle = "-"
            
            if det.variante:
                talle = det.variante.talla
                sku = det.variante.codigo_sku
                if det.variante.producto:
                    nombre = det.variante.producto.nombre

            # --- LÓGICA MULTILINEA INTELIGENTE ---
            # 1. Dividimos el nombre en renglones si es muy largo
            ancho_disponible = 80 * mm 
            # simpleSplit(texto, fuente, tamaño, ancho_max)
            lineas_nombre = simpleSplit(nombre, "Helvetica", 9, ancho_disponible)
            
            # 2. Calculamos la altura que ocupará este item
            alto_renglon = 4 * mm
            # La altura total es: (num_lineas * alto) + espacio para SKU + márgenes
            altura_item = (len(lineas_nombre) * alto_renglon) + 8 * mm
            
            # 3. Verificar si cabe en la página actual
            if y - altura_item < 20 * mm: 
                c.showPage()
                y = height - 20 * mm # Reiniciamos Y arriba
            
            # 4. Dibujar el Nombre (Renglón por renglón)
            c.setFont("Helvetica", 9)
            cursor_texto = y
            for linea in lineas_nombre:
                c.drawString(col_prod, cursor_texto, linea)
                cursor_texto -= alto_renglon
            
            # 5. Dibujar SKU (Justo debajo de la última línea del nombre)
            c.setFont("Helvetica", 7)
            c.setFillColorRGB(0.5, 0.5, 0.5)
            c.drawString(col_prod, cursor_texto - 1*mm, f"SKU: {sku}")
            c.setFillColorRGB(0, 0, 0)

            # 6. Dibujar resto de columnas (Alineadas arriba, con la primera línea)
            c.setFont("Helvetica", 9)
            c.drawString(col_talle, y, str(talle))
            c.drawCentredString(col_cant + 5*mm, y, str(det.cantidad))
            c.drawString(col_unit, y, f"${det.precio_unitario:,.0f}")
            c.drawString(col_sub, y, f"${det.subtotal:,.0f}")
            
            # 7. Línea Divisoria (Se adapta a la altura del item)
            line_y = y - altura_item + 3*mm 
            c.setStrokeColorRGB(0.9, 0.9, 0.9)
            c.line(20*mm, line_y, 190*mm, line_y)
            c.setStrokeColorRGB(0, 0, 0)

            # 8. Actualizar Y para el siguiente producto
            y -= altura_item

        # --- TOTALES ---
        y -= 5*mm
        c.setLineWidth(1)
        c.line(110*mm, y+5*mm, 190*mm, y+5*mm)
        
        c.setFont("Helvetica-Bold", 11)
        c.drawString(110*mm, y, "Subtotal:")
        c.drawRightString(190*mm, y, f"${presupuesto.subtotal:,.0f}")
        y -= 6*mm
        
        if presupuesto.descuento_porcentaje > 0:
            c.setFont("Helvetica", 10)
            c.drawString(110*mm, y, f"Desc. ({presupuesto.descuento_porcentaje}%):")
            monto_desc = presupuesto.subtotal - presupuesto.total_final
            c.setFillColorRGB(0.8, 0, 0) 
            c.drawRightString(190*mm, y, f"-${monto_desc:,.0f}")
            c.setFillColorRGB(0, 0, 0)
            y -= 7*mm

        # Fondo Gris Total
        c.setFillColorRGB(0.9, 0.9, 0.9)
        c.rect(105*mm, y-2*mm, 90*mm, 8*mm, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)

        c.setFont("Helvetica-Bold", 14)
        c.drawString(110*mm, y, "TOTAL:")
        c.drawRightString(190*mm, y, f"${presupuesto.total_final:,.0f}")

        c.save()
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"Presupuesto_{presupuesto.id_presupuesto}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        print(f"Error PDF: {e}")
        return jsonify({"msg": "Error generando PDF"}), 500


@bp.route('/reservas/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_reserva(id):
    reserva = Reserva.query.get_or_404(id)
    
    # Protección: No dejar borrar pendientes para no perder el rastro del stock retenido
    if reserva.estado == 'pendiente':
        return jsonify({"msg": "No se puede eliminar una reserva pendiente. Primero cancélala para devolver el stock."}), 400

    try:
        # 1. Borrar detalles primero (si no tienes cascada en el modelo)
        DetalleReserva.query.filter_by(id_reserva=id).delete()
        
        # 2. Borrar la reserva
        db.session.delete(reserva)
        db.session.commit()
        return jsonify({"msg": "Reserva eliminada del historial"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al eliminar", "error": str(e)}), 500



# --- RUTAS DE PRESUPUESTOS ---

@bp.route('/budgets/create', methods=['POST'])
@jwt_required()
def create_budget():
    try:
        data = request.get_json()
        
        # 1. Cálculos seguros
        try:
            total_final = float(data.get('total', 0))
            descuento = float(data.get('descuento', 0))
        except:
            total_final = 0.0
            descuento = 0.0
        
        subtotal_cabecera = total_final
        if descuento > 0 and descuento < 100:
            subtotal_cabecera = total_final / (1 - (descuento / 100))
        
        # 2. Guardar Cabecera
        nuevo_presupuesto = Presupuesto(
            cliente=data.get('cliente', 'Consumidor Final'),
            fecha_emision=datetime.now(),
            descuento_porcentaje=descuento,
            subtotal=subtotal_cabecera,
            total_final=total_final,
            observaciones=""
        )
        
        db.session.add(nuevo_presupuesto)
        db.session.flush()
        
        # 3. Guardar Ítems y Generar Respuesta Robusta
        items_response = []
        
        for item in data.get('items', []):
            try:
                cantidad = int(item.get('cantidad', 1))
                precio = float(item.get('precio', 0))
            except:
                cantidad = 1
                precio = 0.0
                
            talle = item.get('talle', '-')
            nombre = item.get('nombre', 'Ítem sin nombre')
            
            # Guardar en DB
            var_id = item.get('id_variante')
            if isinstance(var_id, str) and not var_id.isdigit(): var_id = None
            
            detalle = DetallePresupuesto(
                id_presupuesto=nuevo_presupuesto.id_presupuesto,
                id_variante=var_id,
                producto_nombre=nombre,
                talle=talle,
                cantidad=cantidad,
                precio_unitario=precio,
                subtotal=precio * cantidad
            )
            db.session.add(detalle)
            
            # AGREGAMOS ALIAS PARA EVITAR ERRORES EN FRONTEND
            # Enviamos el dato con múltiples nombres por si el componente de impresión busca uno específico
            items_response.append({
                "nombre": nombre,
                "descripcion": nombre,   # Alias
                "producto": nombre,      # Alias
                "talle": talle,
                "cantidad": cantidad,
                "precio": precio,
                "precio_unitario": precio, # Alias
                "subtotal": precio * cantidad
            })
            
        db.session.commit()
        
        return jsonify({
            "msg": "Presupuesto guardado",
            "budget": {
                "id": nuevo_presupuesto.id_presupuesto,
                "fecha": nuevo_presupuesto.fecha_emision.strftime('%d/%m/%Y'),
                "cliente": nuevo_presupuesto.cliente,
                "items": items_response,
                "total": total_final,
                "descuento": descuento,
                "subtotal": subtotal_cabecera
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creando presupuesto: {e}")
        return jsonify({"msg": "Error al guardar presupuesto"}), 500

@bp.route('/budgets/history', methods=['GET'])
@jwt_required()
def get_budgets_history():
    try:
        presupuestos = Presupuesto.query.order_by(desc(Presupuesto.fecha_emision)).limit(50).all()
        resultado = []
        for p in presupuestos:
            items = []
            for d in p.detalles:
                items.append({
                    "id_variante": d.id_variante,
                    "nombre": d.producto_nombre,
                    "talle": d.talle,
                    "cantidad": d.cantidad,
                    "precio": float(d.precio_unitario or 0), # Protección contra null
                    "precio_unitario": float(d.precio_unitario or 0)
                })
            
            resultado.append({
                "id": p.id_presupuesto,
                "fecha": p.fecha_emision.strftime('%d/%m/%Y %H:%M'),
                "cliente": p.cliente,
                "total": float(p.total_final or 0), # Protección contra null
                "descuento": float(p.descuento_porcentaje or 0),
                "items": items
            })
        return jsonify(resultado), 200
    except Exception as e:
        print(f"Error historial: {e}")
        return jsonify({"msg": "Error cargando historial"}), 500