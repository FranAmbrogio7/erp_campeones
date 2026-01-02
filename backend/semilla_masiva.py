import os
from dotenv import load_dotenv
load_dotenv()


from app import create_app
from app.extensions import db
from app.products.models import Producto, ProductoVariante, Categoria, CategoriaEspecifica, Inventario

app = create_app()

# --- CONFIGURACIÓN DE PRECIOS Y TALLES ---
PRECIO_ADULTO = 17000
PRECIO_NINO = 12000
STOCK_INICIAL = 0 

TALLES_ADULTO = ["S", "M", "L", "XL", "XXL"]
TALLES_NINO = ["4", "6", "8", "10", "12", "14", "16"]

# --- BASE DE DATOS MAESTRA ---
DATOS_LIGAS = [
    # --- ARGENTINA ---
    {
        "liga": "Liga Profesional (Argentina)",
        "prefijo": "ARG",
        "equipos": [
            "Boca Juniors", "River Plate", "Independiente", "Racing Club", "San Lorenzo",
            "Huracán", "Vélez Sarsfield", "Estudiantes LP", "Gimnasia LP", "Rosario Central",
            "Newells Old Boys", "Talleres de Córdoba", "Belgrano de Córdoba", "Instituto", "Godoy Cruz",
            "Argentinos Juniors", "Lanús", "Banfield", "Defensa y Justicia", "Tigre",
            "Platense", "Unión de Santa Fe", "Atlético Tucumán", "Central Córdoba SdE", "Barracas Central",
            "Sarmiento de Junín", "Independiente Rivadavia", "Deportivo Riestra",
            "San Martín de San Juan", "Aldosivi"
        ]
    },
    {
        "liga": "Primera Nacional (Argentina)",
        "prefijo": "BN", # B Nacional
        "equipos": [
            "Alvarado", "All Boys", "Atlanta", "Deportivo Madryn", "Gimnasia y Tiro",
            "Racing de Córdoba", "San Miguel", "Almagro", "Arsenal", "Colegiales",
            "Deportivo Maipú", "Güemes", "Patronato", "San Martín (Tucumán)", "Tristán Suárez",
            "Los Andes", "Ferro", "Quilmes", "Almirante Brown", "Chacarita Juniors",
            "Colón", "Defensores de Belgrano", "Estudiantes (Buenos Aires)", "Gimnasia (Jujuy)",
            "Mitre (Santiago del Estero)", "Talleres (Remedios de Escalada)", "San Telmo",
            "Central Norte", "Chaco For Ever", "Deportivo Morón", "Estudiantes (Río Cuarto)",
            "Gimnasia (Mendoza)", "Nueva Chicago", "Temperley", "Agropecuario"
        ]
    },
    # --- INTERNACIONALES ---
    {
        "liga": "La Liga (España)",
        "prefijo": "ESP",
        "equipos": ["Barcelona", "Real Madrid", "Atletico Madrid", "Sevilla"]
    },
    {
        "liga": "Premier League (Inglaterra)",
        "prefijo": "ENG",
        "equipos": ["Manchester City", "Manchester United", "Arsenal", "Aston Villa", "Liverpool", 
                    "Chelsea", "Tottenham", "Brighton", "Newcastle United", "West Ham"]
    },
    {
        "liga": "Serie A (Italia)",
        "prefijo": "ITA",
        "equipos": ["Inter", "AC Milan", "Napoli", "Juventus", "Roma", "Fiorentina"]
    },
    {
        "liga": "Bundesliga (Alemania)",
        "prefijo": "GER",
        "equipos": ["Bayern Munich", "Borussia Dortmund", "Bayern Leverkusen"]
    },
    {
        "liga": "Primeira Liga (Portugal)",
        "prefijo": "POR",
        "equipos": ["Porto", "Benfica", "Sporting Lisboa"]
    },
    {
        "liga": "Ligue 1 (Francia)",
        "prefijo": "FRA",
        "equipos": ["Paris Saint Germain"]
    },
    {
        "liga": "Brasileirao (Brasil)",
        "prefijo": "BRA",
        "equipos": ["Atletico Mineiro", "Botafogo", "Corinthians", "Cruzeiro", "Flamengo", 
                    "Fluminense", "Gremio", "Internacional", "Palmeiras", "Santos", "Sao Paulo"]
    },
    {
        "liga": "Liga Uruguaya",
        "prefijo": "URU",
        "equipos": ["Nacional", "Peñarol"]
    },
    {
        "liga": "Selecciones CONMEBOL",
        "prefijo": "CON",
        "equipos": ["Argentina", "Brasil", "Ecuador", "Colombia", "Uruguay", 
                    "Paraguay", "Bolivia", "Venezuela", "Peru", "Chile"]
    },
    {
        "liga": "Selecciones UEFA / Mundo",
        "prefijo": "EUR",
        "equipos": ["Portugal", "Croacia", "Francia", "Italia", "Belgica", 
                    "Alemania", "Holanda", "España", "Inglaterra", "Japon", "Mexico", "Estados Unidos"]
    }
]

def get_or_create_category(nombre_modelo, nombre_buscar):
    """Gestión inteligente de categorías para no duplicar"""
    if nombre_modelo == 'General':
        cat = Categoria.query.filter_by(nombre=nombre_buscar).first()
        if not cat:
            cat = Categoria(nombre=nombre_buscar)
            db.session.add(cat)
            db.session.commit()
    else:
        cat = CategoriaEspecifica.query.filter_by(nombre=nombre_buscar).first()
        if not cat:
            cat = CategoriaEspecifica(nombre=nombre_buscar)
            db.session.add(cat)
            db.session.commit()
    return cat

def cargar_todo():
    print("🚀 INICIANDO CARGA TOTAL DE BASE DE DATOS...")
    print("   (Esto creará 4 productos por equipo: Titular/Alt para Adulto y Niño)")
    
    # 1. Categorías Base
    cat_adulto = get_or_create_category('General', 'Camisetas Adulto')
    cat_nino = get_or_create_category('General', 'Camisetas Niños')
    
    total_equipos = 0
    total_productos = 0

    # 2. Recorrer Ligas
    for data in DATOS_LIGAS:
        nombre_liga = data['liga']
        prefijo = data['prefijo']
        equipos = data['equipos']
        
        print(f"\n📂 Liga: {nombre_liga} ({len(equipos)} equipos)")
        cat_liga = get_or_create_category('Especifica', nombre_liga)
        
        # 3. Recorrer Equipos
        for equipo in equipos:
            # Definimos las 4 variantes de PRODUCTO (No de talle, sino de modelo)
            # 1. Titular Adulto
            # 2. Alternativa Adulto
            # 3. Titular Niño
            # 4. Alternativa Niño
            
            configuraciones = [
                {"tipo": "Titular", "cat": cat_adulto, "talles": TALLES_ADULTO, "precio": PRECIO_ADULTO, "suffix": "", "sku_suf": "TIT", "aud": "A"},
                {"tipo": "Alternativa", "cat": cat_adulto, "talles": TALLES_ADULTO, "precio": PRECIO_ADULTO, "suffix": "", "sku_suf": "ALT", "aud": "A"},
                {"tipo": "Titular", "cat": cat_nino, "talles": TALLES_NINO, "precio": PRECIO_NINO, "suffix": " (Niños)", "sku_suf": "TIT", "aud": "K"},
                {"tipo": "Alternativa", "cat": cat_nino, "talles": TALLES_NINO, "precio": PRECIO_NINO, "suffix": " (Niños)", "sku_suf": "ALT", "aud": "K"},
            ]

            for config in configuraciones:
                nombre_prod = f"Camiseta {equipo} {config['tipo']} 24/25{config['suffix']}"
                
                # Crear Producto
                prod = Producto(
                    nombre=nombre_prod,
                    descripcion=f"Camiseta oficial {equipo} - Modelo {config['tipo']}",
                    precio=config['precio'],
                    id_categoria=config['cat'].id_categoria,
                    id_categoria_especifica=cat_liga.id_categoria_especifica
                )
                db.session.add(prod)
                db.session.flush() # Necesitamos ID
                
                # Crear Variantes de Talle
                for talle in config['talles']:
                    # SKU INTELIGENTE: BN-105-XL-TIT (B Nacional, ID 105, XL, Titular)
                    sku = f"{prefijo}-{prod.id_producto}-{talle}-{config['sku_suf']}"
                    if config['aud'] == 'K': sku += "-K" # Diferenciador extra para niños
                    
                    var = ProductoVariante(
                        id_producto=prod.id_producto,
                        talla=talle,
                        codigo_sku=sku,
                        color=config['tipo']
                    )
                    db.session.add(var)
                    db.session.flush()
                    
                    # Inventario en 0
                    inv = Inventario(id_variante=var.id_variante, stock_actual=STOCK_INICIAL, stock_minimo=2)
                    db.session.add(inv)
                
                total_productos += 1
            
            total_equipos += 1
            print(".", end="", flush=True) # Barra de progreso visual

    db.session.commit()
    print(f"\n\n✨ FINALIZADO CON ÉXITO")
    print(f"🏆 Equipos procesados: {total_equipos}")
    print(f"👕 Productos creados: {total_productos}")
    print(f"🔢 Variantes (SKUs) generadas: {total_productos * 5} aprox.")

if __name__ == '__main__':
    with app.app_context():
        print("🛠️ Creando tablas en la base de datos...")
        db.create_all()  # <--- ESTA ES LA CLAVE
        print("✅ Tablas creadas. Iniciando carga...")