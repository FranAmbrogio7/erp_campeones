import React from 'react';
import { forwardRef } from 'react';

// Helpers de validación de imágenes
const getImageUrl = (img) => {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return `/api/static/uploads/${img}`;
};

const BudgetPrint = forwardRef(({ data }, ref) => {
    // VALIDACIÓN CRÍTICA: Si no hay datos, no renderizamos nada
    if (!data) {
        return null;
    }

    // Extraemos y validamos todos los datos con valores por defecto seguros
    const cliente = data.cliente || 'Cliente';
    const fecha = data.fecha || new Date().toLocaleDateString('es-AR');
    const id = data.id || '---';

    // Números con validación y conversión segura
    const subtotal = parseFloat(data.subtotal) || 0;
    const total = parseFloat(data.total) || 0;
    const descuento = parseFloat(data.descuento) || 0;

    // Items con validación de array
    const items = Array.isArray(data.items) ? data.items : [];

    // Calculamos el monto del descuento
    const montoDescuento = subtotal - total;

    return (
        <div ref={ref} className="p-8 bg-white text-black w-full">
            {/* ENCABEZADO */}
            <div className="border-b-4 border-gray-800 pb-4 mb-6">
                <h1 className="text-3xl font-black text-gray-900">PRESUPUESTO</h1>
                <div className="flex justify-between mt-3 text-sm">
                    <div>
                        <p className="font-bold">N° {id}</p>
                        <p className="text-gray-600">Fecha: {fecha}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">Cliente:</p>
                        <p className="text-gray-800">{cliente}</p>
                    </div>
                </div>
            </div>

            {/* TABLA DE ITEMS AMPLIADA CON FOTOS Y LINKS */}
            <table className="w-full mb-6 text-sm">
                <thead>
                    <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 font-bold pl-2">Producto y Detalle</th>
                        <th className="text-center py-2 font-bold w-24">Talle</th>
                        <th className="text-center py-2 font-bold w-16">Cant.</th>
                        <th className="text-right py-2 font-bold w-24">Precio</th>
                        <th className="text-right py-2 font-bold w-28">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="text-center py-8 text-gray-500 italic">
                                Presupuesto sin ítems
                            </td>
                        </tr>
                    ) : (
                        items.map((item, idx) => {
                            // Validación segura de cada item
                            const nombre = item.nombre || item.descripcion || item.producto || 'Item';
                            const talle = item.talle || '-';
                            const cantidad = parseInt(item.cantidad) || 1;
                            const precio = parseFloat(item.precio || item.precio_unitario) || 0;
                            const itemSubtotal = parseFloat(item.subtotal) || (precio * cantidad);

                            // Fotos y Links
                            const imagenUrl = getImageUrl(item.imagen);
                            const urlTienda = item.url;

                            return (
                                <tr key={idx} className="border-b border-gray-200 page-break-inside-avoid">
                                    <td className="py-4 flex items-center gap-4">
                                        {/* MINIATURA DEL PRODUCTO */}
                                        {imagenUrl ? (
                                            <img
                                                src={imagenUrl}
                                                alt={nombre}
                                                className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0 shadow-sm"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200 text-gray-400 text-xs shrink-0 text-center px-1">
                                                Sin foto
                                            </div>
                                        )}

                                        {/* TEXTOS Y LINK A TIENDA NUBE */}
                                        <div className="flex flex-col justify-center">
                                            <span className="font-bold text-base text-gray-800">{nombre}</span>
                                            {urlTienda && (
                                                <a
                                                    href={urlTienda}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 text-xs mt-1 hover:underline font-medium"
                                                >
                                                    🔗 Ver en la tienda
                                                </a>
                                            )}
                                        </div>
                                    </td>

                                    <td className="text-center py-4 font-medium text-gray-700">{talle}</td>
                                    <td className="text-center py-4 font-medium text-gray-700">{cantidad}</td>
                                    <td className="text-right py-4 font-medium text-gray-700">${precio.toLocaleString('es-AR')}</td>
                                    <td className="text-right py-4 font-bold text-gray-900 text-base">${itemSubtotal.toLocaleString('es-AR')}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* TOTALES */}
            <div className="border-t-2 border-gray-800 pt-4 mt-6 page-break-inside-avoid">
                <div className="flex justify-end">
                    <div className="w-72">
                        <div className="flex justify-between py-2 text-sm">
                            <span className="font-semibold text-gray-600">Subtotal:</span>
                            <span className="font-medium">${subtotal.toLocaleString('es-AR')}</span>
                        </div>

                        {descuento > 0 && (
                            <div className="flex justify-between py-2 text-sm text-green-600 bg-green-50 px-2 rounded-md">
                                <span className="font-semibold">Descuento ({descuento}%):</span>
                                <span className="font-bold">- ${montoDescuento.toLocaleString('es-AR')}</span>
                            </div>
                        )}

                        <div className="flex justify-between py-4 text-xl font-black border-t-2 border-gray-300 mt-2 text-gray-900">
                            <span>TOTAL:</span>
                            <span>${total.toLocaleString('es-AR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PIE DE PÁGINA */}
            <div className="mt-12 pt-6 border-t border-gray-300 text-xs text-gray-500 text-center page-break-inside-avoid">
                <p className="mb-1 font-bold">Este presupuesto tiene una validez de 10 días desde la fecha de emisión.</p>
                <p>¡Gracias por elegirnos! Podes hacer clic en los enlaces de los productos para ver más detalles en nuestra web.</p>
            </div>
        </div>
    );
});

BudgetPrint.displayName = 'BudgetPrint';

export default BudgetPrint;