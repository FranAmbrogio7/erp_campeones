import React from 'react';
import logoImg from '../assets/logo.png'; // Tu logo

const StockPrintTemplate = React.forwardRef(({ items, title, observaciones }, ref) => {
    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans max-w-[210mm] mx-auto min-h-screen">

            {/* HEADER */}
            <div className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <img src={logoImg} alt="Logo" className="h-16 w-16 object-contain rounded-full border border-gray-200" />
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-wider">Reporte de Stock</h1>
                        <p className="text-sm text-gray-500">Campeones Indumentaria</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-600">FECHA DE EMISIÓN</p>
                    <p className="text-xl font-mono">{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    <p className="text-xs text-gray-400">{new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                </div>
            </div>

            {/* TÍTULO DEL REPORTE */}
            <div className="mb-6 bg-gray-100 p-3 rounded border border-gray-300">
                <h2 className="font-bold text-lg uppercase text-gray-700">
                    {title || "Listado de Disponibilidad"}
                </h2>
                {observaciones && <p className="text-sm text-gray-600 mt-1 italic">{observaciones}</p>}
            </div>

            {/* TABLA DE PRODUCTOS */}
            <table className="w-full text-sm text-left border-collapse">
                <thead>
                    <tr className="bg-gray-800 text-white uppercase text-xs">
                        <th className="p-3 w-32">SKU</th>
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-center w-24">Talle</th>
                        <th className="p-3 text-right w-32">Precio Unit.</th>
                        <th className="p-3 text-center w-24 font-bold bg-gray-700">Stock</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 border border-gray-300">
                    {items.map((item, index) => (
                        <tr key={index} className="break-inside-avoid">
                            <td className="p-3 font-mono text-gray-600 text-xs">{item.sku}</td>
                            <td className="p-3 font-bold">{item.nombre}</td>
                            <td className="p-3 text-center">
                                <span className="border border-gray-400 px-2 py-0.5 rounded text-xs font-bold">
                                    {item.talle}
                                </span>
                            </td>
                            <td className="p-3 text-right text-gray-600">${item.precio.toLocaleString()}</td>
                            <td className={`p-3 text-center font-black text-lg border-l border-gray-300 
                        ${item.stock_actual <= 2 ? 'text-gray-400' : 'text-black'}`}>
                                {item.stock_actual}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* FOOTER */}
            <div className="mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
                <p>Documento interno de control de inventario - Generado por Sistema de Gestión Campeones</p>
            </div>
        </div>
    );
});

export default StockPrintTemplate;