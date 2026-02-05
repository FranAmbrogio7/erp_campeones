import io
import os
import qrcode
import threading
import time
import requests
from PIL import Image
from reportlab.lib.utils import ImageReader
from werkzeug.utils import secure_filename
from flask import jsonify, request, send_file, current_app
from app.products import bp
# IMPORTAMOS DESDE EL ARCHIVO DE PRODUCTOS
from app.products.models import Producto, ProductoVariante, Categoria, CategoriaEspecifica, Inventario
from app.extensions import db
from flask_jwt_extended import jwt_required
import barcode
from barcode.writer import ImageWriter
from sqlalchemy import or_, func
from reportlab.graphics.barcode import code128
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from app.services.tiendanube_service import tn_service # <--- SERVICIO IMPORTADO

# ==========================================
# 1. CRUD DE CATEGORÍAS
# ==========================================

@bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    cats = Categoria.query.all()
    return jsonify([{"id": c.id_categoria, "nombre": c.nombre} for c in cats]), 200

@bp.route('/categories', methods=['POST'])
@jwt_required()
def create_category():
    data = request.get_json()
    if not data.get('nombre'): return jsonify({"msg": "Nombre requerido"}), 400
    
    new_cat = Categoria(nombre=data['nombre'])
    db.session.add(new_cat)
    db.session.commit()
    return jsonify({"msg": "Categoría creada", "id": new_cat.id_categoria}), 201

@bp.route('/categories/<int:id>', methods=['PUT'])
@jwt_required()
def update_category(id):
    cat = Categoria.query.get_or_404(id)
    data = request.get_json()
    cat.nombre = data.get('nombre', cat.nombre)
    db.session.commit()
    return jsonify({"msg": "Categoría actualizada"}), 200

@bp.route('/categories/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_category(id):
    cat = Categoria.query.get_or_404(id)
    try:
        db.session.delete(cat)
        db.session.commit()
        return jsonify({"msg": "Categoría eliminada"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "No se puede eliminar: Hay productos usando esta categoría"}), 400

# ==========================================
# 2. CRUD DE CATEGORÍAS ESPECÍFICAS (LIGAS)
# ==========================================

@bp.route('/specific-categories', methods=['GET'])
@jwt_required()
def get_specific_categories():
    specs = CategoriaEspecifica.query.all()
    return jsonify([{"id": c.id_categoria_especifica, "nombre": c.nombre} for c in specs]), 200

@bp.route('/specific-categories', methods=['POST'])
@jwt_required()
def create_specific_category():
    data = request.get_json()
    if not data.get('nombre'): return jsonify({"msg": "Nombre requerido"}), 400
    
    new_spec = CategoriaEspecifica(nombre=data['nombre'])
    db.session.add(new_spec)
    db.session.commit()
    return jsonify({"msg": "Liga/Tipo creado", "id": new_spec.id_categoria_especifica}), 201

@bp.route('/specific-categories/<int:id>', methods=['PUT'])
@jwt_required()
def update_specific_category(id):
    spec = CategoriaEspecifica.query.get_or_404(id)
    data = request.get_json()
    spec.nombre = data.get('nombre', spec.nombre)
    db.session.commit()
    return jsonify({"msg": "Actualizado correctamente"}), 200

@bp.route('/specific-categories/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_specific_category(id):
    spec = CategoriaEspecifica.query.get_or_404(id)
    try:
        db.session.delete(spec)
        db.session.commit()
        return jsonify({"msg": "Eliminado correctamente"}), 200
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "No se puede eliminar: Hay productos asociados"}), 400

# ==========================================
# 3. Obtener lista de productos (ACTUALIZADA)
# ==========================================
@bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    # 1. Parámetros Básicos
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 20, type=int)
    search = request.args.get('search', '', type=str)
    
    # Filtros Existentes
    cat_id = request.args.get('category_id')
    spec_id = request.args.get('specific_id')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    # --- NUEVOS FILTROS (Activo y Stock) ---
    active_param = request.args.get('active', 'true') # Recibe 'true' o 'false'
    min_stock = request.args.get('min_stock', type=int)

    # 2. Query Base (Unimos tablas relacionadas siempre)
    query = Producto.query.outerjoin(Categoria).outerjoin(CategoriaEspecifica)

    # 3. Aplicar Filtros

    # --- A. FILTRO DE ESTADO (Activo / Discontinuo) ---
    if active_param == 'true':
        query = query.filter(Producto.activo == True)
    elif active_param == 'false':
        query = query.filter(Producto.activo == False)
    
    # --- B. FILTROS DE CATEGORÍA Y PRECIO ---
    if cat_id:
        query = query.filter(Producto.id_categoria == cat_id)
    
    if spec_id:
        query = query.filter(Producto.id_categoria_especifica == spec_id)
        
    if min_price is not None:
        query = query.filter(Producto.precio >= min_price)
        
    if max_price is not None and max_price > 0:
        query = query.filter(Producto.precio <= max_price)

    # --- C. BÚSQUEDA AVANZADA (Tu lógica de términos) ---
    if search:
        # Hacemos el join con variantes para buscar por SKU
        query = query.join(ProductoVariante)
        
        terms = search.strip().split()
        
        for term in terms:
            term_filter = f"%{term}%"
            query = query.filter(
                or_(
                    Producto.nombre.ilike(term_filter),
                    Categoria.nombre.ilike(term_filter),
                    ProductoVariante.codigo_sku.ilike(term_filter)
                )
            )
        
        # Agrupamos para evitar duplicados por variantes
        query = query.group_by(Producto.id_producto)

    # --- D. FILTRO "OCULTAR SIN STOCK" ---
    if min_stock is not None and min_stock > 0:
        # Subconsulta: Busca IDs de productos cuya suma de stock en inventario sea >= min_stock
        products_with_stock = db.session.query(ProductoVariante.id_producto) \
            .join(Inventario, Inventario.id_variante == ProductoVariante.id_variante) \
            .group_by(ProductoVariante.id_producto) \
            .having(func.sum(Inventario.stock_actual) >= min_stock) \
            .subquery()
        
        query = query.filter(Producto.id_producto.in_(products_with_stock))

    # 4. Paginación y Resultados
    paginated_data = query.order_by(Producto.id_producto.desc()).paginate(page=page, per_page=per_page, error_out=False)

    resultado = []
    for prod in paginated_data.items:
        stock_total = 0
        lista_variantes = []
        
        # Recorremos variantes para calcular stock total y armar lista
        for var in prod.variantes:
            cantidad = var.inventario.stock_actual if var.inventario else 0
            stock_total += cantidad
            lista_variantes.append({
                "id_variante": var.id_variante,
                "talle": var.talla,
                "sku": var.codigo_sku,
                "stock": cantidad
            })
        
        resultado.append({
            "id": prod.id_producto,
            "nombre": prod.nombre,
            "precio": float(prod.precio),
            "stock_total": stock_total,
            "imagen": prod.imagen,
            "categoria_id": prod.id_categoria,
            "categoria_especifica_id": prod.id_categoria_especifica,
            "categoria": prod.categoria.nombre if prod.categoria else "-", 
            "liga": prod.categoria_especifica.nombre if prod.categoria_especifica else "-", 
            "variantes": lista_variantes,
            "tiendanube_id": prod.tiendanube_id,
            "sincronizado_web": prod.sincronizado_web,
            "activo": prod.activo # <--- Agregamos este dato por si el front lo necesita
        })

    return jsonify({
        "products": resultado,
        "meta": {
            "total_items": paginated_data.total,
            "total_pages": paginated_data.pages,
            "current_page": paginated_data.page,
        }
    }), 200

# ==========================================
# 5. Crear producto
# ==========================================
@bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    try:
        # 1. Validar datos obligatorios
        if not request.form.get('nombre') or not request.form.get('precio'):
             return jsonify({"msg": "Faltan datos obligatorios"}), 400

        # 2. Procesar la Imagen
        nombre_imagen = None
        if 'imagen' in request.files:
            file = request.files['imagen']
            if file.filename != '':
                filename = secure_filename(file.filename)
                file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
                nombre_imagen = filename

        # 3. Crear Producto Base (Padre)
        nuevo_prod = Producto(
            nombre=request.form['nombre'],
            descripcion=request.form.get('descripcion', ''),
            precio=request.form['precio'],
            id_categoria=request.form.get('categoria_id'),
            id_categoria_especifica=request.form.get('categoria_especifica_id'),
            imagen=nombre_imagen
        )
        db.session.add(nuevo_prod)
        db.session.flush() # Obtenemos el ID del producto nuevo

        # 4. GENERACIÓN DE VARIANTES (Lógica de Curva de Talles)
        # Recibimos un string tipo "S,M,L,XL" o "4,6,8,10"
        talles_input = request.form.get('talle', 'U') 
        stock_por_talle = int(request.form.get('stock', 0))
        
        # Convertimos "S,M,L" en una lista ['S', 'M', 'L']
        lista_talles = [t.strip() for t in talles_input.split(',')]

        for talle in lista_talles:
            # Generamos SKU automático único: P{ID}-{TALLE}
            # Ej: P105-XL, P105-4
            sku_auto = f"P{nuevo_prod.id_producto}-{talle}"

            nueva_variante = ProductoVariante(
                id_producto=nuevo_prod.id_producto,
                talla=talle,
                codigo_sku=sku_auto,
                color=request.form.get('color', 'Standard')
            )
            db.session.add(nueva_variante)
            db.session.flush() # Necesitamos el ID de la variante

            # Crear Inventario para esta variante
            nuevo_inv = Inventario(
                id_variante=nueva_variante.id_variante,
                stock_actual=stock_por_talle, # Asignamos el mismo stock inicial a cada talle
                stock_minimo=2
            )
            db.session.add(nuevo_inv)

        db.session.commit()
        return jsonify({"msg": f"Producto creado con {len(lista_talles)} variantes"}), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR CREACIÓN: {e}")
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 6. Borrar producto
# ==========================================
@bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_product(id):
    try:
        prod = Producto.query.get(id)
        if not prod:
            return jsonify({"msg": "No encontrado"}), 404
        
        if prod.tiendanube_id:
            tn_service.delete_product_in_cloud(prod.tiendanube_id)

        for var in prod.variantes:
            if var.inventario: db.session.delete(var.inventario)
            db.session.delete(var)
            
        db.session.delete(prod)
        db.session.commit()
        return jsonify({"msg": "Producto eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 7. Generar código de barras
# ==========================================
# backend/app/products/routes.py

@bp.route('/barcode/<string:sku>', methods=['GET'])
def get_barcode_image(sku):
    # Generar QR
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L, # L = Menor redundancia (QR más simple/limpio)
        box_size=10,
        border=1, # Borde mínimo blanco
    )
    qr.add_data(sku)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # Guardar en memoria
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    
    return send_file(buffer, mimetype='image/png')


# ==========================================
# 8. Editar producto (datos generales + imagen + PRECIO WEB)
# ==========================================
@bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_product(id):
    prod = Producto.query.get(id)
    if not prod: return jsonify({"msg": "Producto no encontrado"}), 404
    
    try:
        # A. ACTUALIZACIÓN LOCAL -------------------------
        # (Esta parte queda igual que tu código original)
        if 'nombre' in request.form: prod.nombre = request.form['nombre']
        if 'precio' in request.form: prod.precio = float(request.form['precio'])
        if 'categoria_id' in request.form: 
            prod.id_categoria = request.form['categoria_id'] or None
        if 'categoria_especifica_id' in request.form:
            prod.id_categoria_especifica = request.form['categoria_especifica_id'] or None

        # Imagen
        if 'imagen' in request.files:
            file = request.files['imagen']
            if file.filename != '':
                if prod.imagen:
                    ruta_vieja = os.path.join(current_app.config['UPLOAD_FOLDER'], prod.imagen)
                    if os.path.exists(ruta_vieja):
                        os.remove(ruta_vieja)
                
                filename = secure_filename(file.filename)
                file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
                prod.imagen = filename

        # Guardamos cambios locales primero
        db.session.commit()

        # B. SINCRONIZACIÓN CON TIENDA NUBE ------------
        if prod.tiendanube_id:
            print(f"🔄 Sincronizando '{prod.nombre}' con Tienda Nube...")

            # 1. Datos básicos (Nombre, Descripción)
            tn_service.update_product_data(
                tn_product_id=prod.tiendanube_id,
                nombre=prod.nombre,
                descripcion=prod.descripcion
            )
            
            # 2. Actualizar variantes YA VINCULADAS (Precio y Stock)
            # Nota: Asegúrate de que tu modelo use 'tiendanube_id' o 'tiendanube_variant_id' consistentemente.
            # En el servicio usamos 'tiendanube_id' para la variante.
            for var in prod.variantes:
                # Usamos getattr para soportar ambos nombres por si acaso
                tn_var_id = getattr(var, 'tiendanube_id', None) or getattr(var, 'tiendanube_variant_id', None)
                
                if tn_var_id:
                    # Sync Stock
                    if var.inventario:
                        tn_service.update_variant_stock(
                            tn_product_id=prod.tiendanube_id,
                            tn_variant_id=tn_var_id,
                            new_stock=var.inventario.stock_actual
                        )
                    
                    # Sync PRECIO
                    tn_service.update_variant_price(
                        tn_product_id=prod.tiendanube_id,
                        tn_variant_id=tn_var_id,
                        precio_local=prod.precio
                    )

            # ============================================================
            # 3. NUEVO: SUBIR VARIANTES FALTANTES (La magia nueva ✨)
            # ============================================================
            try:
                # Esta función recorre las variantes, encuentra las que no tienen ID y las crea
                nuevas_creadas = tn_service.sync_missing_variants(prod)
                
                if nuevas_creadas:
                    db.session.commit() # Guardamos los IDs nuevos que nos devolvió Tienda Nube
                    print("💾 Nuevas variantes vinculadas correctamente.")
            
            except Exception as e_sync:
                print(f"⚠️ Error al crear variantes nuevas en TN: {e_sync}")
            # ============================================================
        
        return jsonify({"msg": "Producto actualizado y sincronizado"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error update: {e}")
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 9. Editar stock y SKU de una variante (Sincronizado)
# ==========================================
@bp.route('/variants/<int:id>', methods=['PUT'])
@jwt_required()
def update_variant(id):
    var = ProductoVariante.query.get(id)
    if not var: return jsonify({"msg": "Variante no encontrada"}), 404
    
    data = request.get_json()
    try:
        # Actualizar SKU
        if 'sku' in data: var.codigo_sku = data['sku']
        
        # Actualizar STOCK
        stock_cambio = False
        if 'stock' in data:
            if not var.inventario:
                nuevo_inv = Inventario(id_variante=var.id_variante, stock_actual=int(data['stock']))
                db.session.add(nuevo_inv)
            else:
                var.inventario.stock_actual = int(data['stock'])
            stock_cambio = True
        
        db.session.commit()

        # --- SYNC TIENDA NUBE ---
        if stock_cambio and var.tiendanube_variant_id and var.producto.tiendanube_id:
            print(f"🔄 Sincronizando variante {var.codigo_sku}...")
            tn_service.update_variant_stock(
                tn_product_id=var.producto.tiendanube_id,
                tn_variant_id=var.tiendanube_variant_id,
                new_stock=int(data['stock'])
            )
        # ------------------------

        return jsonify({"msg": "Variante actualizada"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 10. Agregar una nueva variante
# ==========================================
@bp.route('/variants', methods=['POST'])
@jwt_required()
def add_variant():
    data = request.get_json()
    try:
        prod_id = data.get('id_producto')
        talla = data.get('talla')
        
        # 1. Validar duplicados locales
        existe = ProductoVariante.query.filter_by(id_producto=prod_id, talla=talla).first()
        if existe: return jsonify({"msg": "Ese talle ya existe"}), 400

        # 2. Crear Variante Local
        prod_padre = Producto.query.get(prod_id) # Obtenemos el producto padre
        
        nueva_var = ProductoVariante(
            id_producto=prod_id,
            talla=talla,
            codigo_sku=data.get('sku') or f"P{prod_id}-{talla}",
            color='Standard'
        )
        db.session.add(nueva_var)
        db.session.flush() # Generar ID local

        # 3. Crear Inventario Local
        nuevo_inv = Inventario(
            id_variante=nueva_var.id_variante,
            stock_actual=int(data.get('stock', 0))
        )
        db.session.add(nuevo_inv)
        
        # Guardamos en DB local para asegurar que existe antes de enviarla
        db.session.commit()
        
        # -------------------------------------------------------
        # 4. SINCRONIZACIÓN AUTOMÁTICA (El cambio clave)
        # -------------------------------------------------------
        if prod_padre.tiendanube_id:
            print(f"✨ Creando variante '{talla}' en Tienda Nube...")
            try:
                # Llamamos al servicio para crearla en la nube
                resp = tn_service.create_variant_in_cloud(prod_padre.tiendanube_id, nueva_var)
                
                if resp['success']:
                    # Guardamos el ID que nos devuelve Tienda Nube
                    # IMPORTANTE: Usamos 'tiendanube_variant_id' según tu esquema
                    nueva_var.tiendanube_variant_id = str(resp['tn_data']['id'])
                    db.session.commit()
                    print(f"✅ Variante vinculada con ID: {nueva_var.tiendanube_variant_id}")
                else:
                    print(f"⚠️ Error API Tienda Nube: {resp.get('error')}")
            except Exception as e_tn:
                print(f"⚠️ Error excepción Tienda Nube: {e_tn}")
        # -------------------------------------------------------
        
        return jsonify({"msg": "Variante agregada y sincronizada"}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error add_variant: {e}")
        return jsonify({"msg": str(e)}), 500

# ==========================================
# 11. Borrar variante
# ==========================================
@bp.route('/variants/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_variant(id):
    try:
        var = ProductoVariante.query.get(id)
        if not var: return jsonify({"msg": "No encontrada"}), 404
        
        if var.inventario: db.session.delete(var.inventario)
        db.session.delete(var)
        
        db.session.commit()
        return jsonify({"msg": "Variante eliminada"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500

# ==========================================
# 12. ACTUALIZACIÓN MASIVA DE PRECIOS (SYNC WEB)
# ==========================================
@bp.route('/bulk-update-price', methods=['POST'])
@jwt_required()
def bulk_update_price():
    data = request.get_json()
    target_type = data.get('target_type')
    target_id = data.get('target_id')
    action = data.get('action')
    value = float(data.get('value', 0))

    if not action or value < 0:
        return jsonify({"msg": "Datos inválidos"}), 400

    try:
        query = Producto.query
        if target_type == 'category':
            query = query.filter_by(id_categoria=target_id)
        elif target_type == 'specific_category':
            query = query.filter_by(id_categoria_especifica=target_id)
        
        products = query.all()
        count = 0

        for prod in products:
            current_price = float(prod.precio)
            if action == 'percent_inc': new_price = current_price * (1 + value / 100)
            elif action == 'fixed_inc': new_price = current_price + value
            elif action == 'set_value': new_price = value
            else: continue
            
            prod.precio = round(new_price, 2)
            count += 1
            
            # --- SYNC TIENDA NUBE (PRECIO WEB) ---
            if prod.tiendanube_id:
                for var in prod.variantes:
                    if var.tiendanube_variant_id:
                        try:
                            # Enviamos el precio local; el servicio se encarga de sumarle el % extra
                            tn_service.update_variant_price(
                                tn_product_id=prod.tiendanube_id,
                                tn_variant_id=var.tiendanube_variant_id,
                                precio_local=prod.precio
                            )
                        except Exception as e:
                            print(f"⚠️ Error sync precio {var.codigo_sku}: {e}")
            # -------------------------------------

        db.session.commit()
        return jsonify({"msg": f"Precios actualizados en {count} productos y sincronizados con la web."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 13. Actualizar stock en masa
# ==========================================
@bp.route('/stock/bulk-update', methods=['POST'])
@jwt_required()
def bulk_stock_update():
    data = request.get_json()
    items = data.get('items', []) 
    
    if not items: return jsonify({"msg": "Lista vacía"}), 400

    try:
        updated_count = 0
        for item in items:
            variante = ProductoVariante.query.filter_by(codigo_sku=item['sku']).first()
            
            if variante and variante.inventario:
                variante.inventario.stock_actual = int(item['cantidad'])
                updated_count += 1
                
                # --- SYNC TIENDA NUBE (IMPORTANTE PARA CARGA MASIVA) ---
                if variante.tiendanube_variant_id and variante.producto.tiendanube_id:
                    tn_service.update_variant_stock(
                        tn_product_id=variante.producto.tiendanube_id,
                        tn_variant_id=variante.tiendanube_variant_id,
                        new_stock=variante.inventario.stock_actual
                    )
                # -------------------------------------------------------
        
        db.session.commit()
        return jsonify({"msg": f"Stock actualizado en {updated_count} productos"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500


# ==========================================
# 14. Generar PDF de etiquetas en masa
# ==========================================
@bp.route('/labels/batch-pdf', methods=['POST'])
@jwt_required()
def generate_batch_labels_pdf():
    data = request.get_json()
    items = data.get('items', [])
    if not items: return jsonify({"msg": "Lista vacía"}), 400

    # Tamaño de etiqueta: 50mm x 25mm
    LABEL_WIDTH = 50 * mm
    LABEL_HEIGHT = 25 * mm
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(LABEL_WIDTH, LABEL_HEIGHT))

    for item in items:
        try:
            cantidad = int(item.get('cantidad', 1))
            
            # NOTA: Quitamos el [:25] para permitir que el Paragraph maneje
            # nombres largos en múltiples líneas.
            nombre = item.get('nombre', 'Producto') 
            
            talle = item.get('talle', '-')
            sku = item.get('sku', '0000')

            # --- 1. Generamos el QR en memoria ---
            qr = qrcode.QRCode(box_size=10, border=0) # Sin borde para maximizar espacio
            qr.add_data(sku)
            qr.make(fit=True)
            img_qr = qr.make_image(fill_color="black", back_color="white")
            
            # Convertimos a formato compatible con ReportLab
            img_buffer = io.BytesIO()
            img_qr.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            reportlab_img = ImageReader(img_buffer)

            # --- 2. Dibujamos la etiqueta 'cantidad' veces ---
            for _ in range(cantidad):
                
                # A. DIBUJAR QR (Izquierda)
                # Posición (x, y) y tamaño (w, h)
                c.drawImage(reportlab_img, 1.5*mm, 1.5*mm, width=22*mm, height=22*mm)

                # B. NOMBRE DEL PRODUCTO (Derecha - Multilínea)
                # Definimos el estilo del texto
                style = ParagraphStyle(
                    'LabelName',
                    fontName='Helvetica-Bold',
                    fontSize=6,      # Letra pequeña para que entre
                    leading=7,       # Interlineado
                    alignment=0,     # 0 = Izquierda
                    wordWrap='CJK'   # Ayuda a romper palabras largas si es necesario
                )
                
                # Creamos el objeto Párrafo
                p = Paragraph(nombre, style)
                
                # wrapOn calcula cuánto espacio ocupa el texto realmente (ancho, alto)
                # Le damos un ancho máximo de 24mm (espacio derecho disponible)
                w, h = p.wrapOn(c, 24*mm, 15*mm) 
                
                # Dibujamos el texto.
                # Lógica Y: Queremos que el tope esté a 23mm. 
                # Como drawOn dibuja desde abajo del párrafo, restamos la altura (h).
                p.drawOn(c, 25*mm, 23*mm - h)

                # C. SKU (Abajo del nombre o posición fija segura)
                # Lo ponemos fijo abajo a la derecha, sobre el talle
                c.setFont("Helvetica-Bold", 8)
                # Cortamos visualmente el SKU si es larguísimo para que no tape el QR
                c.drawString(25*mm, 8*mm, sku[:18])

                # D. TALLE (Esquina inferior derecha)
                c.setFont("Helvetica-Bold", 10)
                c.drawString(25*mm, 3*mm, f"T: {talle}")

                # Finalizamos esta etiqueta (página)
                c.showPage()
                
        except Exception as e:
            print(f"Error generando etiqueta PDF para {item.get('sku')}: {e}")
            continue

    c.save()
    buffer.seek(0)
    
    return send_file(
        buffer, 
        mimetype='application/pdf', 
        as_attachment=True, 
        download_name='etiquetas_qr.pdf'
    )
# ==========================================
# TIENDA NUBE: TEST Y PUBLICACIÓN
# ==========================================

@bp.route('/tiendanube/test', methods=['GET'])
def test_cloud_connection():
    result = tn_service.check_connection()
    if result['success']:
        tienda = result['data']
        return jsonify({
            "msg": f"✅ Conexión Exitosa con: {tienda.get('name', 'Tienda')}",
            "url": tienda.get('url_with_protocol'),
            "products_count": "Conexión operativa"
        }), 200
    else:
        return jsonify({"msg": "❌ Falló la conexión", "error": result.get('error')}), 400

@bp.route('/<int:id>/publish', methods=['POST'])
@jwt_required()
def publish_product_to_cloud(id):
    prod = Producto.query.get_or_404(id)

    if prod.tiendanube_id:
        return jsonify({"msg": "Este producto ya está vinculado con la web"}), 400

    result = tn_service.create_product_in_cloud(prod)

    if not result['success']:
        return jsonify({"msg": "Error al subir a Tienda Nube", "error": result['error']}), 500

    tn_data = result['tn_data']
    prod.tiendanube_id = tn_data['id']
    prod.sincronizado_web = True

    tn_variants = tn_data.get('variants', [])
    for tn_var in tn_variants:
        sku_nube = tn_var.get('sku')
        local_var = next((v for v in prod.variantes if v.codigo_sku == sku_nube), None)
        if local_var:
            local_var.tiendanube_variant_id = tn_var['id']

    try:
        db.session.commit()
        return jsonify({"msg": "Producto publicado y vinculado exitosamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Se subió pero falló al guardar IDs locales", "error": str(e)}), 500


# ==========================================
# 15. Forzar sincronización con Tienda Nube
# ==========================================
@bp.route('/sync/force-tiendanube', methods=['POST'])
@jwt_required()
def force_sync_tiendanube():
    try:
        # 1. FASE RÁPIDA: Leer Base de Datos Local
        # Recopilamos toda la info necesaria ANTES de lanzar el hilo
        productos = Producto.query.filter(Producto.tiendanube_id.isnot(None)).all()
        lista_para_sync = []
        
        for prod in productos:
            for var in prod.variantes:
                if var.tiendanube_variant_id:
                    # Obtenemos el stock actual de la DB
                    stock_db = var.inventario.stock_actual if var.inventario else 0
                    
                    # Guardamos en una lista plana solo los datos puros
                    lista_para_sync.append({
                        'sku': var.codigo_sku,
                        'prod_id': prod.tiendanube_id,
                        'var_id': var.tiendanube_variant_id,
                        'stock': stock_db
                    })
        
        if not lista_para_sync:
             return jsonify({"msg": "No hay productos vinculados para sincronizar"}), 200

        # 2. FASE DE LANZAMIENTO: Iniciar Hilo
        # Creamos el hilo pasándole la lista de datos
        hilo = threading.Thread(target=run_sync_background, args=(lista_para_sync,))
        # Lo iniciamos como 'daemon' para que no bloquee el cierre del server si fuera necesario
        hilo.daemon = True 
        hilo.start()

        # 3. RESPUESTA INMEDIATA
        # Le decimos al Frontend que ya arrancó, aunque no haya terminado.
        return jsonify({
            "msg": "Sincronización iniciada en segundo plano", 
            "detalles": f"Se están procesando {len(lista_para_sync)} variantes. El proceso continuará en el servidor."
        }), 202

    except Exception as e:
        print(f"Error iniciando sync: {e}")
        return jsonify({"msg": "Error general al iniciar sincronización", "error": str(e)}), 500



# Función auxiliar que correrá "en las sombras"
def run_sync_background(items_list):
    """
    Esta función se ejecuta en un hilo paralelo.
    No bloquea al usuario ni al servidor.
    """
    print(f"🔄 [BACKGROUND] Iniciando Sync Masiva de {len(items_list)} variantes...")
    actualizados = 0
    errores = 0
    
    # Recorremos la lista PRE-CALCULADA (así no tocamos la DB en el hilo, que es más seguro)
    for item in items_list:
        try:
            tn_service.update_variant_stock(
                item['prod_id'], 
                item['var_id'], 
                item['stock']
            )
            # Logueamos progreso en la consola del servidor
            print(f"✅ TN Sync OK: {item['sku']} -> Stock {item['stock']}")
            actualizados += 1
        except Exception as e:
            print(f"❌ TN Sync Error {item['sku']}: {e}")
            errores += 1
            
    print(f"🏁 [BACKGROUND] Sync Finalizada. Exitos: {actualizados} | Errores: {errores}")



@bp.route('/sync/force-prices-update', methods=['GET'])
@jwt_required()
def force_prices_update():
    try:
        # 1. Traemos todos los productos que estén vinculados a TN
        productos = Producto.query.filter(Producto.tiendanube_id.isnot(None)).all()
        
        total_actualizados = 0
        errores = 0
        log = []

        print(f"🚀 Iniciando actualización masiva de precios al 18%...")

        for prod in productos:
            # Pausa muy breve para no saturar la API de Tienda Nube
            time.sleep(0.1) 
            
            for var in prod.variantes:
                if var.tiendanube_variant_id:
                    try:
                        # Esto usará el NUEVO 1.18 que configuraste en el Paso 1
                        tn_service.update_variant_price(
                            tn_product_id=prod.tiendanube_id,
                            tn_variant_id=var.tiendanube_variant_id,
                            precio_local=prod.precio
                        )
                        total_actualizados += 1
                    except Exception as e:
                        errores += 1
                        print(f"Error en {prod.nombre}: {e}")

        return jsonify({
            "msg": "Proceso finalizado",
            "total_variantes_actualizadas": total_actualizados,
            "errores": errores
        }), 200

    except Exception as e:
        return jsonify({"msg": "Error critico", "error": str(e)}), 500



        
@bp.route('/<int:id>/import-image-from-cloud', methods=['POST'])
@jwt_required()
def import_image_from_cloud(id):
    prod = Producto.query.get_or_404(id)
    
    if not prod.tiendanube_id:
        return jsonify({"msg": "Error: El producto no está vinculado a Tienda Nube"}), 400

    try:
        # 1. Obtener URL de la nube
        image_url = tn_service.get_first_product_image_url(prod.tiendanube_id)
        
        if not image_url:
            return jsonify({"msg": "El producto no tiene fotos en Tienda Nube"}), 404

        # 2. Descargar la imagen
        print(f"⬇️ Descargando imagen desde: {image_url}")
        img_data = requests.get(image_url).content
        
        # 3. Guardar archivo en el ERP
        # CORRECCIÓN: Usamos prod.id_producto en lugar de prod.id
        filename = f"tn_imported_{prod.id_producto}_{int(time.time())}.jpg"
        
        upload_folder = current_app.config['UPLOAD_FOLDER']
        filepath = os.path.join(upload_folder, filename)
        
        with open(filepath, 'wb') as f:
            f.write(img_data)

        # 4. Borrar imagen vieja del ERP si existía
        if prod.imagen:
            old_path = os.path.join(upload_folder, prod.imagen)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except:
                    pass

        # 5. Actualizar Base de Datos
        prod.imagen = filename
        db.session.commit()

        return jsonify({
            "msg": "Imagen importada y actualizada correctamente", 
            "imagen": filename
        }), 200

    except Exception as e:
        print(f"Error importando imagen: {e}")
        return jsonify({"msg": f"Error interno: {str(e)}"}), 500



@bp.route('/<int:id>/toggle-status', methods=['PUT'])
@jwt_required()
def toggle_product_status(id):
    prod = Producto.query.get_or_404(id)
    
    # Obtenemos el estado deseado desde el frontend ('active': true/false)
    data = request.get_json()
    new_status = data.get('active', True)
    
    prod.activo = new_status
    
    try:
        db.session.commit()
        estado_str = "activado" if new_status else "archivado"
        return jsonify({"msg": f"Producto {estado_str} correctamente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar estado"}), 500