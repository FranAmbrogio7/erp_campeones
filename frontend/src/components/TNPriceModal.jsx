import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { Cloud, X, AlertTriangle, Percent, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TNPriceModal = ({ isOpen, onClose, selectedItems = [], onComplete }) => {
    // --- ESTÁNDAR DE TU NEGOCIO ---
    const MARGEN_ESTANDAR = '1.3';

    const [margin, setMargin] = useState('');
    const [isLoadingMargin, setIsLoadingMargin] = useState(false);

    const isBulkSelected = selectedItems.length > 0;

    useEffect(() => {
        if (isOpen) {
            setIsLoadingMargin(true);

            // Si es selección múltiple, no traemos el margen global, 
            // sugerimos directamente el ESTÁNDAR para que no haya errores.
            if (isBulkSelected) {
                setMargin(MARGEN_ESTANDAR);
                setIsLoadingMargin(false);
            } else {
                // Si es global, sí traemos el último usado para mantener consistencia
                api.get('/products/tiendanube/margen')
                    .then(res => {
                        setMargin(res.data.margen ? res.data.margen.toString() : MARGEN_ESTANDAR);
                    })
                    .catch(() => setMargin(MARGEN_ESTANDAR))
                    .finally(() => setIsLoadingMargin(false));
            }
        } else {
            setMargin('');
        }
    }, [isOpen, isBulkSelected]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validación extra: si el usuario pone algo raro
        const val = parseFloat(margin);
        if (isNaN(val)) return toast.error("Ingresa un número válido");

        const toastId = toast.loading("Iniciando actualización en Tienda Nube...");
        try {
            await api.post('/products/tiendanube/margen', {
                margen: val,
                product_ids: isBulkSelected ? selectedItems : []
            });
            toast.success("Proceso en segundo plano iniciado", { id: toastId });
            if (onComplete) onComplete();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error al actualizar margen", { id: toastId });
        }
    };

    return (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all scale-100 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center tracking-tight">
                        <Cloud className="mr-3 text-sky-500" size={28} /> Margen Nube
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-900 p-2 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className={`p-4 rounded-xl mb-6 border shadow-inner ${isBulkSelected ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50' : 'bg-sky-50 border-sky-100 dark:bg-sky-900/20 dark:border-sky-800/50'}`}>
                    <div className="flex items-start gap-3">
                        <AlertTriangle className={`shrink-0 mt-0.5 ${isBulkSelected ? 'text-indigo-500' : 'text-sky-500'}`} size={18} />
                        <div>
                            <p className={`text-[11px] font-black uppercase tracking-widest ${isBulkSelected ? 'text-indigo-700 dark:text-indigo-400' : 'text-sky-700 dark:text-sky-400'}`}>
                                {isBulkSelected ? 'Aplicar a Selección' : 'Aplicar a Todo el Catálogo'}
                            </p>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                                {isBulkSelected
                                    ? `Actualizarás ${selectedItems.length} productos con este margen.`
                                    : 'Se actualizará el precio de TODOS los productos vinculados.'}
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-8">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between items-center">
                            Multiplicador de Margen
                            {isLoadingMargin && <Loader2 size={12} className="animate-spin text-sky-500" />}
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-4 text-sky-500 font-black text-lg">x</span>
                            <input
                                type="number"
                                required min="0" step="0.01" autoFocus
                                placeholder="Ej: 1.3"
                                value={margin}
                                onChange={e => setMargin(e.target.value)}
                                disabled={isLoadingMargin}
                                className={`w-full pl-12 p-4 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-2xl outline-none focus:border-sky-500 text-sky-600 dark:text-sky-400 transition-all shadow-inner ${isLoadingMargin ? 'opacity-60 cursor-wait' : ''}`}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-2xl transition-all active:scale-95">Cancelar</button>
                        <button type="submit" disabled={isLoadingMargin} className="flex-1 py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-sky-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Aplicar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default TNPriceModal;