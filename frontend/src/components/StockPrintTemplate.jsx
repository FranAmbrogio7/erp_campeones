import React from 'react';
import logoImg from '../assets/logo.png'; // Tu logo

const StockPrintTemplate = React.forwardRef(({ items, title, observaciones }, ref) => {
    return (
        <div ref={ref} className="p-6 bg-white text-black font-sans max-w-[210mm] mx-auto min-h-screen">

            {/* HEADER COMPACTO */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-2 mb-3">
                <div className="flex items-center gap-3">
                    <img src={logoImg} alt="Logo" className="h-10 w-10 object-contain rounded-full border border-gray-200" />
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-wider leading-none">Reporte de Stock</h1>
                        <p className="text-[10px] text-gray-500">Campeones Indumentaria</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-600">EMISIÓN</p>
                    <p className="text-sm font-mono leading-none">{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    <p className="text-[9px] text-gray-400">{new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>

            {/* BARRA DE TÍTULO Y CONTADOR */}
            <div className="mb-2 bg-gray-50 px-2 py-1.5 rounded border border-gray-200 flex justify-between items-baseline">
                <h2 className="font-bold text-xs uppercase text-gray-800">
                    {title || "Listado de Disponibilidad"}
                </h2>
                <span className="text-[10px] text-gray-500 font-bold">{items.length} Ítems</span>
            </div>
            {observaciones && <p className="text-[10px] text-gray-600 mb-2 italic">{observaciones}</p>}

            {/* TABLA ULTRA COMPACTA */}
            <table className="w-full text-xs text-left border-collapse">
                <thead>
                    <tr className="bg-gray-800 text-white uppercase text-[9px]">
                        <th className="py-1 px-2 w-24">SKU</th>
                        <th className="py-1 px-2">Producto</th>
                        <th className="py-1 px-2 text-center w-16">Talle</th>
                        {/* Columna Precio ELIMINADA para ahorrar espacio */}
                        <th className="py-1 px-2 text-center w-16 font-bold bg-gray-700">Cant.</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 border border-gray-200">
                    {items.map((item, index) => (
                        <tr key={index} className="break-inside-avoid">
                            {/* SKU: Fuente mono pequeña */}
                            <td className="py-0.5 px-2 font-mono text-gray-500 text-[9px] align-middle">{item.sku}</td>

                            {/* Nombre: Texto normal, truncado si es eterno */}
                            <td className="py-0.5 px-2 font-bold text-gray-800 align-middle truncate max-w-[300px]">
                                {item.nombre}
                            </td>

                            {/* Talle: Centrado */}
                            <td className="py-0.5 px-2 text-center align-middle">
                                <span className="font-bold text-gray-700 text-[10px]">
                                    {item.talle}
                                </span>
                            </td>

                            {/* Stock: Destacado pero compacto */}
                            <td className={`py-0.5 px-2 text-center font-black text-sm border-l border-gray-200 align-middle
                                ${item.stock_actual === 0 ? 'text-gray-300' : 'text-black'}`}>
                                {item.stock_actual}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* FOOTER */}
            <div className="mt-4 pt-2 border-t border-gray-200 text-center text-[9px] text-gray-400">
                <p>Generado por Sistema de Gestión Campeones</p>
            </div>
        </div>
    );
});

export default StockPrintTemplate;