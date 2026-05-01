import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, TrendingUp, AlertTriangle, Save, ChevronDown, CheckCircle2 } from 'lucide-react';
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

        if (!window.confirm("⚠️ ¿Estás seguro? Esta acción modificará los precios de MUCHOS productos en tu inventario y no se puede deshacer.")) return;

        const loadingToast = toast.loading("Actualizando precios masivamente...");

        try {
            const res = await axios.post('/api/products/bulk-update-price', {
                target_type: targetType,
                target_id: targetId,
                action: action,
                value: parseFloat(value)
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success(res.data.msg || "Precios actualizados con éxito", { id: loadingToast });
            onUpdate(); // Recargar tabla
            onClose();
            // Reset fields
            setValue('');
            setTargetType('all');
        } catch (error) {
            toast.error("Error al actualizar precios", { id: loadingToast });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 transform transition-all scale-100">

                {/* --- HEADER --- */}
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20">
                    <h3 className="font-black text-2xl text-emerald-800 dark:text-emerald-400 flex items-center tracking-tight">
                        <TrendingUp className="mr-3" size={28} /> Actualización Masiva
                    </h3>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-900/50">

                    {/* 1. SELECCIONAR OBJETIVO */}
                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <label className="flex items-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 w-5 h-5 rounded-full flex items-center justify-center mr-2">1</span> 
                            ¿Qué productos actualizar?
                        </label>
                        
                        <div className="relative mb-3">
                            <select 
                                className="w-full border-2 border-slate-200 dark:border-slate-700 p-3 pr-10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-all appearance-none cursor-pointer" 
                                value={targetType} 
                                onChange={e => { setTargetType(e.target.value); setTargetId(''); }}
                            >
                                <option value="all">👉 TODOS LOS PRODUCTOS</option>
                                <option value="category">👉 Solo una Categoría General (Ej: Niños)</option>
                                <option value="specific_category">👉 Solo una Liga / Torneo Específico</option>
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {targetType === 'category' && (
                            <div className="relative animate-fade-in-down mt-3">
                                <select className="w-full border-2 border-emerald-200 dark:border-emerald-800/50 p-3 pr-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer" required value={targetId} onChange={e => setTargetId(e.target.value)}>
                                    <option value="">Selecciona la Categoría...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-3.5 text-emerald-500/50 pointer-events-none" />
                            </div>
                        )}

                        {targetType === 'specific_category' && (
                            <div className="relative animate-fade-in-down mt-3">
                                <select className="w-full border-2 border-emerald-200 dark:border-emerald-800/50 p-3 pr-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-400 font-bold outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer" required value={targetId} onChange={e => setTargetId(e.target.value)}>
                                    <option value="">Selecciona la Liga / Torneo...</option>
                                    {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={18} className="absolute right-4 top-3.5 text-emerald-500/50 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    {/* 2. DEFINIR ACCIÓN */}
                    <div className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <label className="flex items-center text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 w-5 h-5 rounded-full flex items-center justify-center mr-2">2</span> 
                            ¿Qué cambio aplicar?
                        </label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <button type="button" onClick={() => setAction('percent_inc')} className={`px-2 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center ${action === 'percent_inc' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-300'}`}>
                                {action === 'percent_inc' && <CheckCircle2 size={14} className="mr-1.5" />}
                                % Aumentar
                            </button>
                            <button type="button" onClick={() => setAction('fixed_inc')} className={`px-2 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center ${action === 'fixed_inc' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-300'}`}>
                                {action === 'fixed_inc' && <CheckCircle2 size={14} className="mr-1.5" />}
                                $ Sumar Fijo
                            </button>
                            <button type="button" onClick={() => setAction('set_value')} className={`px-2 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl border-2 transition-all active:scale-95 flex items-center justify-center ${action === 'set_value' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-300'}`}>
                                {action === 'set_value' && <CheckCircle2 size={14} className="mr-1.5" />}
                                = Fijar Precio
                            </button>
                        </div>

                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-slate-400 font-black text-lg">
                                {action === 'percent_inc' ? '%' : '$'}
                            </span>
                            <input 
                                type="number" 
                                required step="0.01" min="0" autoFocus
                                className="w-full pl-10 p-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 font-black text-2xl text-slate-800 dark:text-white focus:border-emerald-500 dark:focus:border-emerald-500 outline-none transition-all placeholder-slate-300 dark:placeholder-slate-700"
                                value={value} 
                                onChange={e => setValue(e.target.value)} 
                                placeholder="0" 
                            />
                        </div>
                    </div>

                    {/* --- AVISO --- */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 flex items-start shadow-sm">
                        <AlertTriangle className="text-amber-500 mr-3 shrink-0 mt-0.5" size={20} />
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-400 leading-relaxed">
                            <strong className="block mb-1 text-sm">¿Cómo funciona?</strong>
                            Si eliges <b>"% Aumentar"</b> e ingresas el número <b>10</b>, un producto que vale <span className="font-mono">$10.000</span> pasará a valer automáticamente <span className="font-mono">$11.000</span>.
                        </p>
                    </div>

                    <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.99] flex items-center justify-center tracking-wide">
                        <Save className="mr-2" size={22} /> APLICAR CAMBIOS
                    </button>

                </form>
            </div>
        </div>
    );
};

export default BulkPriceModal;