# backend/app/__init__.py
import os
from flask import Flask, jsonify
from .config import Config
from .extensions import db, migrate, jwt, cors, ma

def create_app(config_class=Config):
    # 1. Inicializar Flask
    app = Flask(__name__)
    app.config.from_object(config_class)

    # --- CONFIGURACIÓN DE CARPETA DE SUBIDAS ---
    # Esto crea la ruta: backend/app/static/uploads
    UPLOAD_FOLDER = os.path.join(app.root_path, 'static', 'uploads')
    
    # Crear la carpeta si no existe (automáticamente)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    # -------------------------------------------

    # 2. Inicializar Extensiones con la app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app) # Habilita CORS para todas las rutas por defecto
    ma.init_app(app)

    # 2. Inicializar Blueprints
    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth') 

    from app.products import bp as products_bp
    app.register_blueprint(products_bp, url_prefix='/api/products')

    from app.sales.routes import bp as sales_bp 
    app.register_blueprint(sales_bp, url_prefix='/api/sales')   

    from app.sales.webhooks import bp_webhooks
    app.register_blueprint(bp_webhooks, url_prefix='/api/webhooks')

    # 3. Ruta de prueba simple (Health Check)
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "success", 
            "message": "Servidor de Fútbol MVP corriendo correctamente",
            "system": "Flask + MySQL"
        })
        
    from app.purchases.routes import bp as purchases_bp
    app.register_blueprint(purchases_bp, url_prefix='/api/purchases')

    from app.returns.routes import bp as returns_bp
    app.register_blueprint(returns_bp, url_prefix='/api/returns')

    return app