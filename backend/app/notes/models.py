from app.extensions import db
from datetime import datetime

class Nota(db.Model):
    __tablename__ = 'notas'
    
    id = db.Column(db.Integer, primary_key=True)
    contenido = db.Column(db.Text, nullable=False)
    completada = db.Column(db.Boolean, default=False)
    importante = db.Column(db.Boolean, default=False) # Para marcar cosas urgentes (Rojo)
    fecha = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'contenido': self.contenido,
            'completada': self.completada,
            'importante': self.importante,
            'fecha': self.fecha.strftime('%d/%m %H:%M')
        }