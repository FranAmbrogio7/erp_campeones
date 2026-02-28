from flask import Blueprint, request, jsonify
from app.extensions import db
from app.sales.models import Cliente
from flask_jwt_extended import jwt_required

bp = Blueprint('clients', __name__)

# OBTENER TODOS LOS CLIENTES
@bp.route('', methods=['GET'])
@jwt_required()
def get_clients():
    try:
        # Ordenamos alfabéticamente por defecto
        clientes = Cliente.query.order_by(Cliente.nombre.asc()).all()
        return jsonify([c.to_dict() for c in clientes]), 200
    except Exception as e:
        return jsonify({"msg": "Error al obtener clientes", "error": str(e)}), 500

# CREAR NUEVO CLIENTE
@bp.route('', methods=['POST'])
@jwt_required()
def create_client():
    try:
        data = request.get_json()
        
        if not data or not data.get('nombre'):
            return jsonify({"msg": "El nombre es obligatorio"}), 400

        nuevo_cliente = Cliente(
            nombre=data.get('nombre'),
            dni=data.get('dni'),
            telefono=data.get('telefono'),
            email=data.get('email'),
            localidad=data.get('localidad'),
            direccion=data.get('direccion'),
            observaciones=data.get('observaciones')
        )
        
        db.session.add(nuevo_cliente)
        db.session.commit()

        return jsonify({"msg": "Cliente creado", "cliente": nuevo_cliente.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al crear cliente", "error": str(e)}), 500

# ACTUALIZAR CLIENTE
@bp.route('/<int:id>', methods=['PUT'])
@jwt_required()
def update_client(id):
    try:
        cliente = Cliente.query.get_or_404(id)
        data = request.get_json()

        if not data.get('nombre'):
            return jsonify({"msg": "El nombre es obligatorio"}), 400

        cliente.nombre = data.get('nombre')
        cliente.dni = data.get('dni')
        cliente.telefono = data.get('telefono')
        cliente.email = data.get('email')
        cliente.localidad = data.get('localidad')
        cliente.direccion = data.get('direccion')
        cliente.observaciones = data.get('observaciones')

        db.session.commit()
        return jsonify({"msg": "Cliente actualizado", "cliente": cliente.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar cliente", "error": str(e)}), 500

# ELIMINAR CLIENTE
@bp.route('/<int:id>', methods=['DELETE'])
@jwt_required()
def delete_client(id):
    try:
        cliente = Cliente.query.get_or_404(id)
        db.session.delete(cliente)
        db.session.commit()
        return jsonify({"msg": "Cliente eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al eliminar cliente", "error": str(e)}), 500