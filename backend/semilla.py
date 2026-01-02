from app import create_app
from app.extensions import db
# Importamos los modelos desde tus archivos separados (como acordamos)
from app.products.models import Producto, ProductoVariante, Categoria, CategoriaEspecifica, Inventario

app = create_app()

def cargar_liga_argentina():
    print("🇦🇷 Iniciando carga de la Liga Profesional Argentina...")

    # 1. CONFIGURACIÓN BASE
    PRECIO_FIJO = 16000
    STOCK_INICIAL = 0 # Unidades por talle
    TALLES_ADULTO = ["S", "M", "L", "XL", "XXL"]
    
    # Lista de los 30 equipos
    equipos = [
        "Boca Juniors", "River Plate", "Independiente", "Racing Club", "San Lorenzo",
        "Huracán", "Vélez Sarsfield", "Estudiantes LP", "Gimnasia LP", "Rosario Central",
        "Newells Old Boys", "Talleres de Córdoba", "Belgrano de Córdoba", "Instituto", "Godoy Cruz",
        "Argentinos Juniors", "Lanús", "Banfield", "Defensa y Justicia", "Tigre",
        "Platense", "Unión de Santa Fe", "Atlético Tucumán", "Central Córdoba SdE", "Barracas Central",
        "Sarmiento de Junín", "Independiente Rivadavia", "Deportivo Riestra", 
        "San Martín de San Juan", "Aldosivi"
    ]

    # 2. OBTENER O CREAR CATEGORÍAS NECESARIAS
    # Buscamos la categoría General "Camisetas Adulto"
    cat_gral = Categoria.query.filter_by(nombre="Camisetas Adulto").first()
    if not cat_gral:
        cat_gral = Categoria(nombre="Camisetas Adulto")
        db.session.add(cat_gral)
        db.session.commit()
        print("   -> Categoría 'Camisetas Adulto' creada.")

    # Buscamos la categoría Específica "Liga Profesional Arg"
    cat_esp = CategoriaEspecifica.query.filter_by(nombre="Liga Profesional Arg").first()
    if not cat_esp:
        cat_esp = CategoriaEspecifica(nombre="Liga Profesional Arg")
        db.session.add(cat_esp)
        db.session.commit()
        print("   -> Categoría 'Liga Profesional Arg' creada.")

    # 3. BUCLE DE CARGA DE PRODUCTOS
    contador_prod = 0
    
    for equipo in equipos:
        modelos = ["Titular", "Alternativa"]
        
        for modelo in modelos:
            nombre_producto = f"Camiseta {equipo} {modelo} 24/25"
            
            # Verificar si ya existe para no duplicar
            if Producto.query.filter_by(nombre=nombre_producto).first():
                print(f"   ⚠️ Salteando {nombre_producto} (Ya existe)")
                continue

            # A. Crear Producto Padre
            nuevo_prod = Producto(
                nombre=nombre_producto,
                descripcion=f"Camiseta oficial {modelo.lower()} de {equipo}, temporada 2024/2025. Calidad premium.",
                precio=PRECIO_FIJO,
                id_categoria=cat_gral.id_categoria,
                id_categoria_especifica=cat_esp.id_categoria_especifica
            )
            db.session.add(nuevo_prod)
            db.session.flush() # Obtenemos el ID

            # B. Crear Variantes (Talles)
            for talle in TALLES_ADULTO:
                # Generar SKU único: ARG-ID-TALLE-TIPO (Ej: ARG-105-M-TIT)
                tipo_sku = "TIT" if modelo == "Titular" else "ALT"
                sku = f"ARG-{nuevo_prod.id_producto}-{talle}-{tipo_sku}"

                nueva_variante = ProductoVariante(
                    id_producto=nuevo_prod.id_producto,
                    talla=talle,
                    codigo_sku=sku,
                    color=modelo # Usamos el campo color para guardar si es Titular/Alt
                )
                db.session.add(nueva_variante)
                db.session.flush()

                # C. Crear Inventario
                nuevo_inv = Inventario(
                    id_variante=nueva_variante.id_variante,
                    stock_actual=STOCK_INICIAL,
                    stock_minimo=2
                )
                db.session.add(nuevo_inv)
            
            contador_prod += 1
            print(f"   ✅ {nombre_producto} creado.")

    db.session.commit()
    print("-" * 50)
    print(f"🚀 Carga finalizada. Se agregaron {contador_prod} productos nuevos.")
    print(f"📊 Total variantes generadas: {contador_prod * len(TALLES_ADULTO)}")

if __name__ == '__main__':
    with app.app_context():
        cargar_liga_argentina()