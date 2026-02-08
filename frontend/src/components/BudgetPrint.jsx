import React from 'react';
import { forwardRef } from 'react';

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
        <div ref={ref} className="print-only p-8 bg-white text-black">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-only, .print-only * {
                        visibility: visible;
                    }
                    .print-only {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    @page {
                        margin: 1cm;
                    }
                }
            `}</style>

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

            {/* TABLA DE ITEMS */}
            <table className="w-full mb-6 text-sm">
                <thead>
                    <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 font-bold">Producto</th>
                        <th className="text-center py-2 font-bold w-20">Talle</th>
                        <th className="text-center py-2 font-bold w-16">Cant.</th>
                        <th className="text-right py-2 font-bold w-24">Precio</th>
                        <th className="text-right py-2 font-bold w-24">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="text-center py-4 text-gray-500">
                                Sin items
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

                            return (
                                <tr key={idx} className="border-b border-gray-200">
                                    <td className="py-3">{nombre}</td>
                                    <td className="text-center py-3">{talle}</td>
                                    <td className="text-center py-3">{cantidad}</td>
                                    <td className="text-right py-3">${precio.toLocaleString('es-AR')}</td>
                                    <td className="text-right py-3 font-semibold">${itemSubtotal.toLocaleString('es-AR')}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {/* TOTALES */}
            <div className="border-t-2 border-gray-800 pt-4 mt-6">
                <div className="flex justify-end">
                    <div className="w-64">
                        <div className="flex justify-between py-2 text-sm">
                            <span className="font-semibold">Subtotal:</span>
                            <span>${subtotal.toLocaleString('es-AR')}</span>
                        </div>

                        {descuento > 0 && (
                            <div className="flex justify-between py-2 text-sm text-green-600">
                                <span className="font-semibold">Descuento ({descuento}%):</span>
                                <span>- ${montoDescuento.toLocaleString('es-AR')}</span>
                            </div>
                        )}

                        <div className="flex justify-between py-3 text-xl font-black border-t-2 border-gray-300 mt-2">
                            <span>TOTAL:</span>
                            <span>${total.toLocaleString('es-AR')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PIE DE PÁGINA */}
            <div className="mt-12 pt-6 border-t border-gray-300 text-xs text-gray-600">
                <p className="mb-2">Este presupuesto tiene una validez de 10 días desde la fecha de emisión.</p>
                <p>Gracias por su preferencia.</p>
            </div>
        </div>
    );
});

BudgetPrint.displayName = 'BudgetPrint';

export default BudgetPrint;