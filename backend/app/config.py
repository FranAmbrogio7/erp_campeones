# backend/app/config.py
import os
from datetime import timedelta

class Config:
    # Configuración de Base de Datos (Esa ya funciona bien)
    DB_USER = os.environ.get('DB_USER', 'campeones_user')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '0044295023') # Tu contraseña
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_NAME = os.environ.get('DB_NAME', 'campeones_db')
    
    SQLALCHEMY_DATABASE_URI = f'mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False 
    
    # --- CAMBIO IMPORTANTE AQUÍ ---
    # Pon una palabra fija, sin os.environ, para desarrollo.
    SECRET_KEY = 'super-secreta-clave-desarrollo'
    JWT_SECRET_KEY = 'super-secreta-clave-desarrollo' 
    
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)