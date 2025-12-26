# backend/app/sales/models.py
from app.extensions import db
from datetime import datetime

class MovimientoCaja(db.Model):
    __tablename__ = 'movimientos_caja'
    __table_args__ = {'extend_existing': True}

    id_movimiento = db.Column(db.Integer, primary_key=True)
    id_sesion = db.Column(db.Integer, db.ForeignKey('sesiones_caja.id_sesion'), nullable=False)
    tipo = db.Column(db.String(20)) # 'retiro' o 'ingreso'
    monto = db.Column(db.Numeric(10, 2), nullable=False)
    descripcion = db.Column(db.String(255))
    fecha = db.Column(db.DateTime, default=datetime.now)

class MetodoPago(db.Model):
    __tablename__ = 'metodos_pago'
    __table_args__ = {'extend_existing': True}
    
    id_metodo_pago = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50)) # Ej: Efectivo, Tarjeta, Transferencia

class Cliente(db.Model):
    __tablename__ = 'clientes'
    __table_args__ = {'extend_existing': True}

    id_cliente = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100))
    apellido = db.Column(db.String(100))
    email = db.Column(db.String(100))
    # No necesitamos definir todos los campos, solo la PK es vital para que la relación funcione

class DetalleVenta(db.Model):
    __tablename__ = 'detalles_ventas'
    __table_args__ = {'extend_existing': True}

    id_detalle = db.Column(db.Integer, primary_key=True)
    id_venta = db.Column(db.Integer, db.ForeignKey('ventas.id_venta'), nullable=False)
    id_variante = db.Column(db.Integer, db.ForeignKey('producto_variantes.id_variante'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)

    # Relación para poder saber qué camiseta vendimos al ver el detalle
    variante = db.relationship('ProductoVariante')

class Venta(db.Model):
    __tablename__ = 'ventas'
    __table_args__ = {'extend_existing': True}

    id_venta = db.Column(db.Integer, primary_key=True)
    id_cliente = db.Column(db.Integer, db.ForeignKey('clientes.id_cliente'), nullable=True)
    fecha_venta = db.Column(db.DateTime, default=datetime.now)
    
    # Total original (suma de productos)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0) 
    
    # Descuento aplicado (en dinero)
    descuento = db.Column(db.Numeric(10, 2), default=0)
    
    # Total final cobrado (Subtotal - Descuento)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    
    estado = db.Column(db.String(50), default='completada')
    
    id_metodo_pago = db.Column(db.Integer, db.ForeignKey('metodos_pago.id_metodo_pago'), nullable=True)
    metodo = db.relationship('MetodoPago', backref='ventas')
    
    detalles = db.relationship(DetalleVenta, backref='venta', lazy=True, cascade="all, delete-orphan")

# --- NUEVO: Relación con Sesión de Caja ---
class SesionCaja(db.Model):
    __tablename__ = 'sesiones_caja'
    __table_args__ = {'extend_existing': True}

    id_sesion = db.Column(db.Integer, primary_key=True)
    fecha_apertura = db.Column(db.DateTime, default=datetime.now)
    fecha_cierre = db.Column(db.DateTime, nullable=True)
    
    monto_inicial = db.Column(db.Numeric(10, 2), default=0) # El "cambio" con el que arrancas
    total_ventas_sistema = db.Column(db.Numeric(10, 2), default=0) # Lo que el sistema calculó
    total_real = db.Column(db.Numeric(10, 2), nullable=True) # Lo que contaste billete por billete
    diferencia = db.Column(db.Numeric(10, 2), nullable=True) # Si falta o sobra plata
    
    estado = db.Column(db.String(20), default='abierta') # 'abierta' o 'cerrada'
    usuario_id = db.Column(db.Integer, nullable=True) # Quién abrió la caja


class Reserva(db.Model):
    __tablename__ = 'reservas'
    id_reserva = db.Column(db.Integer, primary_key=True)
    cliente_nombre = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(50))
    total = db.Column(db.Numeric(10, 2))
    monto_sena = db.Column(db.Numeric(10, 2))
    saldo_restante = db.Column(db.Numeric(10, 2))
    fecha_reserva = db.Column(db.DateTime, default=datetime.now)
    fecha_vencimiento = db.Column(db.DateTime)
    estado = db.Column(db.Enum('pendiente', 'retirada', 'cancelada'), default='pendiente')

    # Relación
    detalles = db.relationship('DetalleReserva', backref='reserva', lazy=True)

class DetalleReserva(db.Model):
    __tablename__ = 'detalle_reserva'
    id_detalle = db.Column(db.Integer, primary_key=True)
    id_reserva = db.Column(db.Integer, db.ForeignKey('reservas.id_reserva'), nullable=False)
    id_variante = db.Column(db.Integer, db.ForeignKey('producto_variantes.id_variante'), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False)
    precio_historico = db.Column(db.Numeric(10, 2))
    subtotal = db.Column(db.Numeric(10, 2))

    # Relación para acceder al nombre del producto
    variante = db.relationship('ProductoVariante')