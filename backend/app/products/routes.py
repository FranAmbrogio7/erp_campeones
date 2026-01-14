import io
import os
from werkzeug.utils import secure_filename
from flask import jsonify, request, send_file, current_app
from app.products import bp
# IMPORTAMOS DESDE EL ARCHIVO DE PRODUCTOS
from app.products.models import Producto, ProductoVariante, Categoria, CategoriaEspecifica, Inventario
from app.extensions import db
from flask_jwt_extended import jwt_required
import barcode
from barcode.writer import ImageWriter
from sqlalchemy import or_
from reportlab.graphics.barcode import code128
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
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
# 3. Obtener lista de productos
# ==========================================
@bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    # 1. Parámetros
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 20, type=int)
    search = request.args.get('search', '', type=str)
    
    # Filtros
    cat_id = request.args.get('category_id')
    spec_id = request.args.get('specific_id')
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)

    # 2. Query Base (Unimos tablas relacionadas siempre)
    query = Producto.query.outerjoin(Categoria).outerjoin(CategoriaEspecifica)

    # 3. Aplicar Filtros
    if search:
        # Hacemos el join con variantes UNA sola vez para poder buscar por SKU
        query = query.join(ProductoVariante)
        
        # --- CAMBIO IMPORTANTE AQUÍ ---
        # Separamos la búsqueda en palabras (ej: "boca retro" -> ["boca", "retro"])
        terms = search.strip().split()
        
        for term in terms:
            term_filter = f"%{term}%"
            # Para cada palabra, exigimos que aparezca en Nombre O Categoria O SKU
            # Al encadenar .filter() sucesivamente, SQLAlchemy aplica un AND entre ellos.
            query = query.filter(
                or_(
                    Producto.nombre.ilike(term_filter),
                    Categoria.nombre.ilike(term_filter),
                    ProductoVariante.codigo_sku.ilike(term_filter)
                )
            )
        # -------------------------------

        # Agrupamos para que no salgan productos repetidos por cada variante encontrada
        query = query.group_by(Producto.id_producto)
    
    if cat_id:
        query = query.filter(Producto.id_categoria == cat_id)
    
    if spec_id:
        query = query.filter(Producto.id_categoria_especifica == spec_id)
        
    if min_price is not None:
        query = query.filter(Producto.precio >= min_price)
        
    if max_price is not None and max_price > 0:
        query = query.filter(Producto.precio <= max_price)

    # 4. Paginación
    paginated_data = query.order_by(Producto.id_producto.desc()).paginate(page=page, per_page=per_page, error_out=False)

    resultado = []
    for prod in paginated_data.items:
        stock_total = 0
        lista_variantes = []
        
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
            "sincronizado_web": prod.sincronizado_web
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
@bp.route('/barcode/<string:sku>', methods=['GET'])
def generate_barcode(sku):
    try:
        EAN = barcode.get_barcode_class('code128')
        my_barcode = EAN(sku, writer=ImageWriter())
        fp = io.BytesIO()
        my_barcode.write(fp)
        fp.seek(0)
        return send_file(fp, mimetype='image/png')
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        
        # 1. Datos de texto (FormData)
        if 'nombre' in request.form: prod.nombre = request.form['nombre']
        if 'precio' in request.form: prod.precio = float(request.form['precio']) # Asegurar float
        if 'categoria_id' in request.form: 
            prod.id_categoria = request.form['categoria_id'] or None
        if 'categoria_especifica_id' in request.form:
            prod.id_categoria_especifica = request.form['categoria_especifica_id'] or None

        # 2. Imagen
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

        db.session.commit()

        # B. SINCRONIZACIÓN CON TIENDA NUBE ------------
        # Si el producto está vinculado, enviamos los cambios.
        if prod.tiendanube_id:
            print(f"🔄 Sincronizando '{prod.nombre}' con Tienda Nube...")

            # 1. Datos básicos
            tn_service.update_product_data(
                tn_product_id=prod.tiendanube_id,
                nombre=prod.nombre,
                descripcion=prod.descripcion
            )
            
            # 2. Stock y PRECIO por variante
            for var in prod.variantes:
                if var.tiendanube_variant_id:
                    # Sync Stock (si se hubiera tocado por otro lado)
                    if var.inventario:
                        tn_service.update_variant_stock(
                            tn_product_id=prod.tiendanube_id,
                            tn_variant_id=var.tiendanube_variant_id,
                            new_stock=var.inventario.stock_actual
                        )
                    
                    # Sync PRECIO (Aquí aplica el aumento web definido en el servicio)
                    tn_service.update_variant_price(
                        tn_product_id=prod.tiendanube_id,
                        tn_variant_id=var.tiendanube_variant_id,
                        precio_local=prod.precio
                    )
        
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
        
        existe = ProductoVariante.query.filter_by(id_producto=prod_id, talla=talla).first()
        if existe: return jsonify({"msg": "Ese talle ya existe"}), 400

        nueva_var = ProductoVariante(
            id_producto=prod_id,
            talla=talla,
            codigo_sku=data.get('sku') or f"P{prod_id}-{talla}",
            color='Standard'
        )
        db.session.add(nueva_var)
        db.session.flush()

        nuevo_inv = Inventario(
            id_variante=nueva_var.id_variante,
            stock_actual=int(data.get('stock', 0))
        )
        db.session.add(nuevo_inv)
        
        db.session.commit()
        
        return jsonify({"msg": "Variante agregada"}), 201
    except Exception as e:
        db.session.rollback()
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

    # Medidas etiqueta: 50mm x 25mm
    LABEL_WIDTH = 50 * mm
    LABEL_HEIGHT = 25 * mm
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(LABEL_WIDTH, LABEL_HEIGHT))

    for item in items:
        try:
            cantidad = int(item.get('cantidad', 1))
            nombre = item.get('nombre', 'Producto')[:28] # Cortamos para que entre en una línea
            talle = item.get('talle', '-')
            sku = item.get('sku', '0000')

            # Formateamos el SKU central con espacios para que se parezca a la foto (ej: P 6 1 3 - X L)
            # Esto le da ese look de "lectura humana"
            sku_espaciado = " ".join(list(sku)) 

            for _ in range(cantidad):
                
                # 1. NOMBRE (Arriba - Pegado al borde superior)
                c.setFont("Helvetica", 7) # Fuente normal, no bold (según foto)
                # Y=22mm
                c.drawCentredString(LABEL_WIDTH / 2, LABEL_HEIGHT - 3.5*mm, nombre)

                # 2. CÓDIGO DE BARRAS
                # Lógica de auto-ajuste de ancho
                bar_width = 0.55 
                barcode = code128.Code128(sku, barHeight=10*mm, barWidth=bar_width)
                
                real_width = barcode.width
                max_width = LABEL_WIDTH - 4*mm

                if real_width > max_width:
                    factor = max_width / real_width
                    bar_width = bar_width * factor
                    barcode = code128.Code128(sku, barHeight=10*mm, barWidth=bar_width)
                    real_width = barcode.width

                x_pos = (LABEL_WIDTH - real_width) / 2
                
                # Dibujamos las barras más arriba para dejar espacio al texto de abajo
                # Y=9mm (Esto deja espacio para el texto grande abajo)
                barcode.drawOn(c, x_pos, 9*mm)

                # 3. SKU GRANDE CENTRAL (El detalle que faltaba)
                # Justo debajo de las barras
                c.setFont("Helvetica-Bold", 9)
                c.drawCentredString(LABEL_WIDTH / 2, 5.5*mm, sku) 
                # Nota: Si prefieres con espacios como "P 6 1 3", cambia 'sku' por 'sku_espaciado' arriba

                # 4. PIE DE PÁGINA (Talle y SKU pequeño)
                # Talle a la izquierda (Bold)
                c.setFont("Helvetica-Bold", 8)
                c.drawString(2*mm, 1.5*mm, f"T: {talle}")

                # SKU pequeño a la derecha (Normal)
                c.setFont("Helvetica", 6)
                c.drawRightString(LABEL_WIDTH - 2*mm, 1.5*mm, sku)

                c.showPage()
                
        except Exception as e:
            print(f"Error PDF: {e}")
            continue

    c.save()
    buffer.seek(0)
    
    return send_file(buffer, mimetype='application/pdf', as_attachment=True, download_name='etiquetas.pdf')
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