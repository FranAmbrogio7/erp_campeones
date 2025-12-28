from app.extensions import db
from datetime import datetime

class Rol(db.Model):
    __tablename__ = 'roles_empleados' 
    # Según tu imagen: id_rol, nombre, descripcion
    id_rol = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50))
    descripcion = db.Column(db.String(255))

class Empleado(db.Model):
    __tablename__ = 'empleados'
    # Según tu diagrama: id_empleado, nombre, apellido, email, password_hash, id_rol, fecha_ingreso
    id_empleado = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    apellido = db.Column(db.String(100), nullable=False) # ¡Campo nuevo!
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False) # Nota el nombre exacto
    id_rol = db.Column(db.Integer, db.ForeignKey('roles_empleados.id_rol'), nullable=False)
    fecha_ingreso = db.Column(db.DateTime, default=datetime.now)

    # Relación para acceder al rol desde el empleado
    rol_obj = db.relationship('Rol', backref='empleados')