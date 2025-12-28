from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity
from app.auth import bp
from app.auth.models import Empleado
from app.extensions import db

@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Validar campos obligatorios de TU base de datos
    if not data.get('nombre') or not data.get('apellido') or not data.get('email') or not data.get('password'):
         return jsonify({"msg": "Faltan datos obligatorios"}), 400

    if Empleado.query.filter_by(email=data['email']).first():
        return jsonify({"msg": "El correo ya existe"}), 400

    try:
        nuevo_emp = Empleado(
            nombre=data['nombre'],
            apellido=data['apellido'], # Agregamos el apellido
            email=data['email'],
            password_hash=generate_password_hash(data['password']), # Guardamos en password_hash
            id_rol=int(data['id_rol']) # ID del rol (1 o 2)
        )
        db.session.add(nuevo_emp)
        db.session.commit()
        return jsonify({"msg": "Empleado creado exitosamente"}), 201

    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({"msg": "Error interno", "error": str(e)}), 500



@bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        empleado = Empleado.query.filter_by(email=email).first()

        if not empleado or not check_password_hash(empleado.password_hash, password):
            return jsonify({"msg": "Credenciales inválidas", "success": False}), 401

        # --- CORRECCIÓN CRÍTICA ---
        # 1. Identity: Debe ser STRING (usamos el ID convertido a texto)
        # 2. additional_claims: Aquí van los datos extra (rol, nombre)
        access_token = create_access_token(
            identity=str(empleado.id_empleado), 
            additional_claims={
                "nombre": f"{empleado.nombre} {empleado.apellido}",
                "rol": empleado.rol_obj.nombre if empleado.rol_obj else "Vendedor"
            }
        )
        # --------------------------

        return jsonify({
            "success": True,
            "token": access_token,
            "user": {
                "nombre": empleado.nombre,
                "apellido": empleado.apellido,
                "rol": empleado.rol_obj.nombre if empleado.rol_obj else "Vendedor"
            }
        }), 200

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"msg": "Error interno", "error": str(e)}), 500