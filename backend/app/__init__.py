# backend/app/__init__.py
import os
from flask import Flask, jsonify
from .config import Config
from .extensions import db, migrate, jwt, cors, ma

# --- IMPORTAMOS LOS BLUEPRINTS ---
from app.sales.routes import bp as sales_bp
from app.sales.webhooks import bp_webhooks # <--- ESTE ES EL IMPORTANTE

def create_app(config_class=Config):
    # 1. Inicializar Flask
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- CONFIGURACIÓN DE CARPETA DE SUBIDAS ---
    UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    # -------------------------------------------

    # 2. Inicializar Extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app)
    ma.init_app(app)

    # 3. REGISTRAR BLUEPRINTS
    # Auth
    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth') 

    # Productos
    from app.products import bp as products_bp
    app.register_blueprint(products_bp, url_prefix='/api/products')

    # Ventas (Sales)
    app.register_blueprint(sales_bp, url_prefix='/api/sales')   

    # Webhooks (Tienda Nube) - ESTA ES LA CORRECCIÓN CLAVE
    # Usamos el blueprint que importamos arriba (app.sales.webhooks)
    app.register_blueprint(bp_webhooks, url_prefix='/api/webhooks')

    # Notas (Si existe el módulo)
    # Asegúrate que 'app.notes.routes' exista, si no, comenta estas líneas
    # from app.notes.routes import bp as notes_bp
    # app.register_blueprint(notes_bp, url_prefix='/api/notes')

    # Compras (Purchases)
    from app.purchases.routes import bp as purchases_bp
    app.register_blueprint(purchases_bp, url_prefix='/api/purchases')

    # Devoluciones (Returns)
    from app.returns.routes import bp as returns_bp
    app.register_blueprint(returns_bp, url_prefix='/api/returns')

    # 4. Ruta de Salud
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "success", 
            "message": "Servidor de Fútbol MVP corriendo correctamente",
            "system": "Flask + MySQL"
        })

    return app