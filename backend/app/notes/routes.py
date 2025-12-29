from flask import Blueprint, request, jsonify
from app.extensions import db
from app.notes.models import Nota
from flask_jwt_extended import jwt_required
from datetime import datetime

bp = Blueprint('notes', __name__)

# LISTAR TODAS
@bp.route('/', methods=['GET'])
@jwt_required()
def get_notes():
    # Ordenar: Primero las importantes, luego las nuevas, al final las completadas
    notas = Nota.query.order_by(
        Nota.completada.asc(), 
        Nota.importante.desc(), 
        Nota.fecha.desc()
    ).all()
    return jsonify([n.to_dict() for n in notas]), 200

# CREAR NUEVA
@bp.route('/', methods=['POST'])
@jwt_required()
def create_note():
    data = request.get_json()
    if not data.get('contenido'):
        return jsonify({"msg": "Contenido vacío"}), 400

    nueva_nota = Nota(
        contenido=data.get('contenido'),
        importante=data.get('importante', False),
        fecha=datetime.now()
    )
    db.session.add(nueva_nota)
    db.session.commit()
    return jsonify(nueva_nota.to_dict()), 201

# EDITAR ESTADO (Completar / Importante)
@bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_note(id):
    nota = Nota.query.get_or_404(id)
    data = request.get_json()
    
    if 'completada' in data:
        nota.completada = data['completada']
    if 'importante' in data:
        nota.importante = data['importante']
        
    db.session.commit()
    return jsonify(nota.to_dict()), 200

# BORRAR
@bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_note(id):
    nota = Nota.query.get_or_404(id)
    db.session.delete(nota)
    db.session.commit()
    return jsonify({"msg": "Nota eliminada"}), 200