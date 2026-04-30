from flask import Blueprint, jsonify, request
from app.extensions import db
from app.settings.models import Configuracion
from flask_jwt_extended import jwt_required

bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@bp.route('/margen', methods=['GET', 'PUT'])
@jwt_required()
def manage_margen():
    if request.method == 'GET':
        # Buscamos el margen. Si nadie lo configuró aún, devolvemos '1.19' por defecto
        margen = Configuracion.get_valor('margen_web', '1.19')
        return jsonify({"margen": float(margen)}), 200
    
    if request.method == 'PUT':
        data = request.get_json()
        nuevo_margen = data.get('margen')
        
        if not nuevo_margen:
            return jsonify({"msg": "Debe enviar un margen válido"}), 400
            
        conf = Configuracion.query.filter_by(clave='margen_web').first()
        if not conf:
            conf = Configuracion(clave='margen_web', valor=str(nuevo_margen), descripcion="Margen de recargo para Tienda Nube")
            db.session.add(conf)
        else:
            conf.valor = str(nuevo_margen)
        
        db.session.commit()
        return jsonify({"msg": "Margen web actualizado exitosamente"}), 200