from app import create_app
from app.extensions import db
from app.products.models import Producto, ProductoVariante, Categoria, CategoriaEspecifica, Inventario

app = create_app()

def cargar_liga_argentina_kids():
    print("🧒🇦🇷 Iniciando carga de Liga Argentina (NIÑOS)...")

    # 1. CONFIGURACIÓN BASE
    PRECIO_FIJO = 12000
    STOCK_INICIAL = 8 # Un poco menos de stock inicial para niños (opcional)
    TALLES_NINO = ["4", "6", "8", "10", "12", "14", "16"]
    
    equipos = [
        "Boca Juniors", "River Plate", "Independiente", "Racing Club", "San Lorenzo",
        "Huracán", "Vélez Sarsfield", "Estudiantes LP", "Gimnasia LP", "Rosario Central",
        "Newells Old Boys", "Talleres de Córdoba", "Belgrano de Córdoba", "Instituto", "Godoy Cruz",
        "Argentinos Juniors", "Lanús", "Banfield", "Defensa y Justicia", "Tigre",
        "Platense", "Unión de Santa Fe", "Atlético Tucumán", "Central Córdoba SdE", "Barracas Central",
        "Sarmiento de Junín", "Independiente Rivadavia", "Deportivo Riestra", 
        "San Martín de San Juan", "Aldosivi", "Estudiantes Rio IV"
    ]

    # 2. OBTENER CATEGORÍAS
    # Buscamos o creamos la categoría "Camisetas Niño"
    cat_gral = Categoria.query.filter_by(nombre="Camisetas Niños").first()
    if not cat_gral:
        cat_gral = Categoria(nombre="Camisetas Niños")
        db.session.add(cat_gral)
        db.session.commit()
        print("   -> Categoría 'Camisetas Niños' creada.")

    # Buscamos la liga (ya debería existir del script anterior, pero por seguridad la buscamos)
    cat_esp = CategoriaEspecifica.query.filter_by(nombre="Liga Profesional Arg").first()
    if not cat_esp:
        cat_esp = CategoriaEspecifica(nombre="Liga Profesional Arg")
        db.session.add(cat_esp)
        db.session.commit()

    # 3. BUCLE DE CARGA
    contador_prod = 0
    
    for equipo in equipos:
        modelos = ["Titular", "Alternativa"]
        
        for modelo in modelos:
            # Nombre distintivo para evitar confusión en el buscador
            nombre_producto = f"Camiseta {equipo} {modelo} 24/25 (Niño)"
            
            if Producto.query.filter_by(nombre=nombre_producto).first():
                print(f"   ⚠️ Salteando {nombre_producto} (Ya existe)")
                continue

            # A. Crear Producto Padre
            nuevo_prod = Producto(
                nombre=nombre_producto,
                descripcion=f"Camiseta oficial {modelo.lower()} de {equipo} para niños. Temporada 24/25.",
                precio=PRECIO_FIJO,
                id_categoria=cat_gral.id_categoria, # ID de Niños
                id_categoria_especifica=cat_esp.id_categoria_especifica
            )
            db.session.add(nuevo_prod)
            db.session.flush()

            # B. Crear Variantes (Talles Numéricos)
            for talle in TALLES_NINO:
                tipo_sku = "TIT" if modelo == "Titular" else "ALT"
                # SKU especial con prefijo 'K' para identificar rápido que es Kids
                sku = f"ARG-K-{nuevo_prod.id_producto}-{talle}-{tipo_sku}"

                nueva_variante = ProductoVariante(
                    id_producto=nuevo_prod.id_producto,
                    talla=talle,
                    codigo_sku=sku,
                    color=modelo
                )
                db.session.add(nueva_variante)
                db.session.flush()

                # C. Inventario
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
    print(f"🚀 Carga de NIÑOS finalizada. Se agregaron {contador_prod} productos nuevos.")
    print(f"📊 Total variantes generadas: {contador_prod * len(TALLES_NINO)}")

if __name__ == '__main__':
    with app.app_context():
        cargar_liga_argentina_kids()