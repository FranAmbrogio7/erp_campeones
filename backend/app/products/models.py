# backend/app/products/models.py
from app.extensions import db

class Categoria(db.Model):
    __tablename__ = 'categorias'
    id_categoria = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)

class CategoriaEspecifica(db.Model):
    __tablename__ = 'categorias_especificas'
    
    id_categoria_especifica = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    # id_categoria = db.Column(...) # Si quisieras relacionarlas (Ej: Solo mostrar ligas si eligen Futbol), pero por ahora lo haremos simple.

class Producto(db.Model):
    __tablename__ = 'productos'

    id_producto = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    precio = db.Column(db.Numeric(10, 2), nullable=False)
    imagen = db.Column(db.String(255), nullable=True)
    id_categoria = db.Column(db.Integer, db.ForeignKey('categorias.id_categoria'))
    
    # --- NUEVO: Agregamos la columna para la específica ---
    id_categoria_especifica = db.Column(db.Integer, db.ForeignKey('categorias_especificas.id_categoria_especifica'), nullable=True)
    
    # Relaciones
    categoria = db.relationship('Categoria', backref='productos_relacionados')
    
    # --- NUEVO: Relación para poder acceder al nombre después ---
    categoria_especifica = db.relationship('CategoriaEspecifica', backref='productos')
    
    variantes = db.relationship('ProductoVariante', backref='producto', lazy=True)
    tiendanube_id = db.Column(db.String(50), nullable=True)
    sincronizado_web = db.Column(db.Boolean, default=False)

class ProductoVariante(db.Model):
    __tablename__ = 'producto_variantes'
    id_variante = db.Column(db.Integer, primary_key=True)
    id_producto = db.Column(db.Integer, db.ForeignKey('productos.id_producto'), nullable=False)
    talla = db.Column(db.String(10), nullable=False) 
    color = db.Column(db.String(50))
    codigo_sku = db.Column(db.String(50), unique=True)
    
    inventario = db.relationship('Inventario', backref='variante', uselist=False, lazy=True)
    tiendanube_variant_id = db.Column(db.String(50), nullable=True)
    

class Inventario(db.Model):
    __tablename__ = 'inventario'
    id_inventario = db.Column(db.Integer, primary_key=True)
    id_variante = db.Column(db.Integer, db.ForeignKey('producto_variantes.id_variante'), nullable=False)
    id_deposito = db.Column(db.Integer, default=1)
    stock_actual = db.Column(db.Integer, default=0)
    stock_minimo = db.Column(db.Integer, default=2)