from app.extensions import db
from datetime import datetime

class Cliente(db.Model):
    __tablename__ = 'clientes'

    id_cliente = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    dni = db.Column(db.String(50))
    telefono = db.Column(db.String(50))
    email = db.Column(db.String(100))
    localidad = db.Column(db.String(100))
    direccion = db.Column(db.String(200))
    observaciones = db.Column(db.Text)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id_cliente": self.id_cliente,
            "nombre": self.nombre,
            "dni": self.dni,
            "telefono": self.telefono,
            "email": self.email,
            "localidad": self.localidad,
            "direccion": self.direccion,
            "observaciones": self.observaciones,
            "fecha_creacion": self.fecha_creacion.strftime('%d/%m/%Y %H:%M') if self.fecha_creacion else None
        }