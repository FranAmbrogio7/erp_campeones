import { useState, useEffect } from 'react';
import { X, User, Phone, DollarSign, CalendarClock, CreditCard } from 'lucide-react';

const ReservationModal = ({ isOpen, onClose, onConfirm, total, processing, paymentMethods }) => {
    const [formData, setFormData] = useState({
        cliente: '',
        telefono: '',
        sena: '',
        metodo_pago_id: '' // Nuevo campo
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({ cliente: '', telefono: '', sena: '', metodo_pago_id: '' });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const senaValue = parseFloat(formData.sena) || 0;
    const saldoRestante = total - senaValue;

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validación
        if (senaValue > 0 && !formData.metodo_pago_id) {
            alert("Por favor selecciona un medio de pago para la seña.");
            return;
        }

        onConfirm({
            cliente: formData.cliente,
            telefono: formData.telefono,
            sena: senaValue,
            metodo_pago_id: formData.metodo_pago_id
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-purple-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center">
                        <CalendarClock className="mr-2" /> Nueva Reserva
                    </h3>
                    <button onClick={onClose} className="hover:bg-purple-700 p-1 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente *</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                required autoFocus
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Nombre del cliente"
                                value={formData.cliente}
                                onChange={e => setFormData({ ...formData, cliente: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="Ej: 351..."
                                value={formData.telefono}
                                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <span className="text-xs text-gray-500 block">Total Compra</span>
                            <span className="text-xl font-bold text-gray-800">$ {total.toLocaleString()}</span>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 text-green-600">Seña / Entrega</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-2.5 text-green-600" size={18} />
                                <input
                                    type="number" min="0" max={total}
                                    className="w-full pl-10 pr-4 py-2 border-2 border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-green-700"
                                    placeholder="0"
                                    value={formData.sena}
                                    onChange={e => setFormData({ ...formData, sena: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SELECTOR DE MEDIO DE PAGO (Solo visible si hay seña) */}
                    {senaValue > 0 && (
                        <div className="animate-fade-in-down">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medio de Pago Seña *</label>
                            <div className="relative">
                                <CreditCard className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                <select
                                    required
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.metodo_pago_id}
                                    onChange={e => setFormData({ ...formData, metodo_pago_id: e.target.value })}
                                >
                                    <option value="">Seleccionar...</option>
                                    {paymentMethods.map(m => (
                                        <option key={m.id} value={m.id}>{m.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-center">
                        <span className="text-xs text-red-500 font-bold uppercase">Saldo Restante</span>
                        <div className="text-2xl font-black text-red-600">$ {saldoRestante.toLocaleString()}</div>
                    </div>

                    <button
                        type="submit"
                        disabled={processing || !formData.cliente}
                        className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg disabled:opacity-50 mt-4"
                    >
                        {processing ? 'Guardando...' : 'Confirmar Reserva'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ReservationModal;