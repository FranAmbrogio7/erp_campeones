import React, { useMemo } from 'react';
import logoImg from '../assets/logo.png';

const StockPrintTemplate = React.forwardRef(({ items, title, observaciones }, ref) => {

    // --- LÓGICA DE AGRUPAMIENTO ---
    // Transformamos la lista plana de variantes en una lista de Productos con sus talles anidados
    const groupedProducts = useMemo(() => {
        const groups = {};

        items.forEach(item => {
            // Usamos el nombre como clave para agrupar (puedes usar ID de producto si lo tienes disponible)
            const key = item.nombre;

            if (!groups[key]) {
                groups[key] = {
                    nombre: item.nombre,
                    // Tomamos el SKU base (quitando el talle si fuese necesario, o dejamos el primero)
                    sku_base: item.sku.split('-')[0],
                    total_stock: 0,
                    variantes: []
                };
            }

            groups[key].variantes.push({
                talle: item.talle,
                stock: item.stock_actual,
                sku: item.sku
            });
            groups[key].total_stock += item.stock_actual;
        });

        // Convertimos el objeto en array y ordenamos las variantes (opcional)
        return Object.values(groups).map(prod => {
            // Ordenar talles si es posible (alfabético simple por ahora)
            prod.variantes.sort((a, b) => {
                const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
                return order.indexOf(a.talle) - order.indexOf(b.talle);
            });
            return prod;
        });
    }, [items]);

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans max-w-[210mm] mx-auto min-h-screen">

            {/* HEADER */}
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-4">
                    {/* Logo pequeño */}
                    <img src={logoImg} alt="Logo" className="h-12 w-12 object-contain rounded-full border border-gray-200" />
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-wide text-slate-800">Reporte de Stock</h1>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Campeones Indumentaria</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Fecha de Emisión</p>
                    <p className="text-sm font-mono font-bold">{new Date().toLocaleDateString('es-AR')}</p>
                </div>
            </div>

            {/* BARRA TÍTULO */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 mb-4 flex justify-between items-center">
                <div>
                    <h2 className="text-sm font-bold uppercase text-slate-700">{title || "Listado de Disponibilidad"}</h2>
                    {observaciones && <p className="text-[10px] text-gray-500 italic">{observaciones}</p>}
                </div>
                <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Prendas</span>
                    <span className="text-lg font-black text-slate-800 leading-none">
                        {groupedProducts.reduce((acc, p) => acc + p.total_stock, 0)}
                    </span>
                </div>
            </div>

            {/* LISTADO AGRUPADO (ESTILO TARJETAS COMPACTAS) */}
            <div className="space-y-3">
                {groupedProducts.map((product, index) => (
                    <div key={index} className="border border-gray-300 rounded-lg p-2 break-inside-avoid shadow-sm">

                        {/* Título del Producto */}
                        <div className="flex justify-between items-start mb-2 border-b border-gray-100 pb-1">
                            <h3 className="font-bold text-sm text-slate-800 leading-tight w-3/4">
                                {product.nombre}
                            </h3>
                            <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 rounded">
                                SKU: {product.sku_base}
                            </span>
                        </div>

                        {/* Grid de Talles (Estilo Pastillas) */}
                        <div className="flex flex-wrap gap-2">
                            {product.variantes.map((v, vIdx) => (
                                <div key={vIdx} className={`
                                    flex items-center border rounded overflow-hidden text-xs
                                    ${v.stock > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-100 bg-red-50'}
                                `}>
                                    {/* Lado Izquierdo: Talle */}
                                    <div className={`
                                        px-2 py-1 font-bold 
                                        ${v.stock > 0 ? 'text-emerald-800 bg-emerald-100' : 'text-red-800 bg-red-100'}
                                    `}>
                                        {v.talle}
                                    </div>

                                    {/* Lado Derecho: Cantidad */}
                                    <div className={`
                                        px-2 py-1 font-mono font-bold min-w-[30px] text-center
                                        ${v.stock > 0 ? 'text-emerald-700' : 'text-red-400'}
                                    `}>
                                        {v.stock}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* FOOTER */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
                <p className="text-[8px] text-gray-400 uppercase tracking-widest">Sistema de Gestión Interno • Documento de Control</p>
            </div>
        </div>
    );
});

export default StockPrintTemplate;