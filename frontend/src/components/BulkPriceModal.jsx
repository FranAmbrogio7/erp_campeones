import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, TrendingUp, AlertTriangle, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const BulkPriceModal = ({ isOpen, onClose, onUpdate, categories, specificCategories }) => {
    const { token } = useAuth();

    const [targetType, setTargetType] = useState('all'); // all, category, specific_category
    const [targetId, setTargetId] = useState('');

    const [action, setAction] = useState('percent_inc'); // percent_inc, fixed_inc, set_value
    const [value, setValue] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if ((targetType !== 'all' && !targetId) || !value) {
            toast.error("Completa todos los campos");
            return;
        }

        if (!window.confirm("⚠️ ¿Estás seguro? Esta acción modificará los precios de MUCHOS productos y no se puede deshacer.")) return;

        const loadingToast = toast.loading("Actualizando precios...");

        try {
            const res = await axios.post('/api/products/bulk-update-price', {
                target_type: targetType,
                target_id: targetId,
                action: action,
                value: parseFloat(value)
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success(res.data.msg, { id: loadingToast });
            onUpdate(); // Recargar tabla
            onClose();
            // Reset fields
            setValue('');
            setTargetType('all');
        } catch (error) {
            toast.error("Error al actualizar", { id: loadingToast });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-blue-50">
                    <h3 className="font-bold text-xl text-blue-900 flex items-center">
                        <TrendingUp className="mr-2" /> Actualización Masiva
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-red-500" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* 1. SELECCIONAR OBJETIVO */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">1. ¿Qué productos actualizar?</label>
                        <select className="w-full border p-2 rounded mb-3" value={targetType} onChange={e => setTargetType(e.target.value)}>
                            <option value="all">TODOS LOS PRODUCTOS</option>
                            <option value="category">Por Categoría General (Ej: Niños)</option>
                            <option value="specific_category">Por Liga / Específica</option>
                        </select>

                        {targetType === 'category' && (
                            <select className="w-full border p-2 rounded bg-blue-50 border-blue-200 animate-fade-in" required value={targetId} onChange={e => setTargetId(e.target.value)}>
                                <option value="">Selecciona Categoría...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}

                        {targetType === 'specific_category' && (
                            <select className="w-full border p-2 rounded bg-blue-50 border-blue-200 animate-fade-in" required value={targetId} onChange={e => setTargetId(e.target.value)}>
                                <option value="">Selecciona Liga...</option>
                                {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        )}
                    </div>

                    {/* 2. DEFINIR ACCIÓN */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">2. ¿Qué cambio aplicar?</label>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <button type="button" onClick={() => setAction('percent_inc')} className={`p-2 text-xs font-bold rounded border ${action === 'percent_inc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>% Aumentar Porcentaje</button>
                            <button type="button" onClick={() => setAction('fixed_inc')} className={`p-2 text-xs font-bold rounded border ${action === 'fixed_inc' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>$ Aumentar Monto Fijo</button>
                            <button type="button" onClick={() => setAction('set_value')} className={`p-2 text-xs font-bold rounded border ${action === 'set_value' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>= Fijar Nuevo Precio</button>
                        </div>

                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500 font-bold">{action === 'percent_inc' ? '%' : '$'}</span>
                            <input type="number" required step="0.01" className="w-full pl-8 p-2 border rounded font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={value} onChange={e => setValue(e.target.value)} placeholder="0" />
                        </div>
                    </div>

                    {/* AVISO */}
                    <div className="bg-yellow-50 p-3 rounded border border-yellow-200 flex items-start">
                        <AlertTriangle className="text-yellow-600 mr-2 shrink-0" size={18} />
                        <p className="text-xs text-yellow-800 leading-tight">
                            Ejemplo: Si eliges "% Aumentar" y pones "10", una camiseta de $10.000 pasará a valer $11.000.
                        </p>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center">
                        <Save className="mr-2" size={18} /> Aplicar Cambios
                    </button>

                </form>
            </div>
        </div>
    );
};

export default BulkPriceModal;