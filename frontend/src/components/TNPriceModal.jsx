import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { X, Cloud, TrendingUp, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TNPriceModal = ({ isOpen, onClose }) => {
    const [margen, setMargen] = useState(1.26);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setIsFetching(true);
            api.get('/products/tiendanube/margen')
               .then(res => setMargen(res.data.margen))
               .catch(() => toast.error("Error leyendo margen"))
               .finally(() => setIsFetching(false));
        }
    }, [isOpen]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const toastId = toast.loading("Iniciando tarea de servidor...");
        try {
            await api.post('/products/tiendanube/margen', { margen: parseFloat(margen) });
            toast.success("¡Tarea en segundo plano iniciada!", { id: toastId, duration: 4000 });
            onClose(); // Cerramos el modal para que el usuario pueda seguir trabajando
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error al iniciar", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-blue-600 p-5 flex justify-between items-center text-white">
                    <h3 className="font-black text-lg flex items-center"><Cloud className="mr-2" /> Precios Tienda Nube</h3>
                    <button onClick={onClose} className="hover:text-blue-200 transition-colors"><X size={20}/></button>
                </div>
                
                <div className="p-6">
                    {isFetching ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : (
                        <form onSubmit={handleSave}>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Cambia el multiplicador. El proceso se ejecutará en <b>segundo plano</b> y verás una barra de progreso flotante mientras sigues trabajando.
                            </p>

                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center">
                                <TrendingUp size={14} className="mr-1" /> Multiplicador (Ej: 1.26)
                            </label>
                            
                            <input 
                                type="number" step="0.01" min="1" required autoFocus
                                value={margen} onChange={e => setMargen(e.target.value)}
                                className="w-full p-4 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl font-black text-2xl text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 text-center mb-6 transition-all"
                            />
                            
                            <button type="submit" disabled={isLoading} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center disabled:opacity-50">
                                {isLoading ? <Loader2 className="animate-spin" /> : "Actualizar Masivamente"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TNPriceModal;