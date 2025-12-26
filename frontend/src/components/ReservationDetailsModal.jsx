import { X, ShoppingBag } from 'lucide-react';

const ReservationDetailsModal = ({ isOpen, onClose, reserva }) => {
    if (!isOpen || !reserva) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg flex items-center">
                        <ShoppingBag className="mr-2 text-purple-400" size={20} />
                        Reserva #{reserva.id}
                    </h3>
                    <button onClick={onClose} className="hover:bg-gray-700 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Datos del Cliente */}
                    <div className="flex justify-between mb-6 text-sm text-gray-600 border-b pb-4">
                        <div>
                            <p className="uppercase font-bold text-xs text-gray-400">Cliente</p>
                            <p className="font-bold text-gray-800 text-lg">{reserva.cliente}</p>
                            <p className="flex items-center gap-1 mt-1">📞 {reserva.telefono || 'Sin teléfono'}</p>
                        </div>
                        <div className="text-right">
                            <p className="uppercase font-bold text-xs text-gray-400">Fecha Reserva</p>
                            <p className="font-mono text-gray-800">{reserva.fecha}</p>
                            <p className={`text-xs font-bold mt-1 ${reserva.is_vencida ? 'text-red-500' : 'text-green-600'}`}>
                                Vence: {reserva.vencimiento}
                            </p>
                        </div>
                    </div>

                    {/* Tabla de Productos */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden mb-6">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-500 font-bold uppercase text-xs border-b">
                                <tr>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3">Talle</th>
                                    <th className="p-3 text-right">Cant.</th>
                                    <th className="p-3 text-right">Precio (Hist.)</th>
                                    <th className="p-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {reserva.items.map((item, idx) => (
                                    <tr key={idx} className="bg-white">
                                        <td className="p-3 font-medium text-gray-800">{item.producto}</td>
                                        <td className="p-3 text-gray-600">{item.talle}</td>
                                        <td className="p-3 text-right font-bold">{item.cantidad}</td>
                                        <td className="p-3 text-right text-gray-500">$ {item.precio.toLocaleString()}</td>
                                        <td className="p-3 text-right font-bold text-gray-800">$ {(item.precio * item.cantidad).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totales */}
                    <div className="flex flex-col sm:flex-row justify-end gap-6 text-right pt-2">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">Total Original</p>
                            <p className="text-xl font-bold text-gray-800">$ {reserva.total.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-green-600 uppercase font-bold">Seña Pagada</p>
                            <p className="text-xl font-bold text-green-600">$ {reserva.sena.toLocaleString()}</p>
                        </div>
                        <div className="bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                            <p className="text-xs text-red-500 uppercase font-bold">Saldo Pendiente</p>
                            <p className="text-2xl font-black text-red-600">$ {reserva.saldo.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* Footer con Acciones */}
                <div className="bg-gray-50 p-4 border-t flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium">
                        Cerrar
                    </button>
                    {reserva.estado === 'pendiente' && (
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm">
                            Imprimir Comprobante
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReservationDetailsModal;