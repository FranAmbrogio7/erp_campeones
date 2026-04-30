from app.extensions import db

class Configuracion(db.Model):
    __tablename__ = 'configuracion'
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(50), unique=True, nullable=False) # Ej: 'margen_web'
    valor = db.Column(db.String(100), nullable=False)             # Ej: '1.25'
    descripcion = db.Column(db.String(255))                       # Ej: 'Multiplicador de precio para Tienda Nube'

    @staticmethod
    def get_valor(clave, default=None):
        conf = Configuracion.query.filter_by(clave=clave).first()
        return conf.valor if conf else default