import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import BudgetPrint from '../components/BudgetPrint';
import { useReactToPrint } from 'react-to-print'; // <--- IMPORTANTE: Agregado para impresión multi-página
import toast, { Toaster } from 'react-hot-toast';
import {
    ShoppingCart, Trash2, Plus, Minus, Search, Shirt,
    Calculator, User, FileText, Printer, Save, Layers, X,
    History, RotateCcw, Clock, CheckCircle2, ArrowRight,
    ListPlus, AlertTriangle, Send
} from 'lucide-react';

const BudgetPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();

    // --- ESTADOS CON PERSISTENCIA ---
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem('budget_draft_cart');
        return saved ? JSON.parse(saved) : [];
    });

    const [clientName, setClientName] = useState(() => {
        return localStorage.getItem('budget_draft_client') || '';
    });

    const [discountPercent, setDiscountPercent] = useState(() => {
        return parseInt(localStorage.getItem('budget_draft_discount')) || 0;
    });

    // --- ESTADOS DE MODO DE STOCK ---
    const [useRealStock, setUseRealStock] = useState(true);

    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [categories, setCategories] = useState([]);
    const [selectedCat, setSelectedCat] = useState('');

    // --- ESTADOS DE IMPRESIÓN ---
    const [printData, setPrintData] = useState(null);
    const printRef = useRef(null);

    // Función de impresión aislada (Arregla el corte de múltiples páginas)
    const reactToPrintFn = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto_${new Date().toLocaleDateString().replace(/\//g, '-')}`
    });

    useEffect(() => {
        localStorage.setItem('budget_draft_cart', JSON.stringify(cart));
        localStorage.setItem('budget_draft_client', clientName);
        localStorage.setItem('budget_draft_discount', discountPercent);
    }, [cart, clientName, discountPercent]);

    useEffect(() => {
        const loadCats = async () => {
            try {
                const res = await api.get('/products/categories');
                setCategories(res.data);
            } catch (e) { console.error(e); }
        };
        if (token) loadCats();
    }, [token]);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!manualTerm.trim() && !selectedCat) { setManualResults([]); return; }
            try {
                const params = { search: manualTerm, limit: 100 };
                if (selectedCat) params.category_id = selectedCat;
                const res = await api.get('/products', { params });
                setManualResults(res.data.products || []);
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(delay);
    }, [manualTerm, selectedCat]);

    // --- FUNCIÓN MEJORADA: OBTENER IMAGEN ---
    const getImageUrl = (img) => {
        if (!img) return null;
        if (img.startsWith('http')) return img;
        return `/api/static/uploads/${img}`; // <--- Ruta absoluta para asegurar que cargue en el carrito
    };

    // --- LÓGICA: AGREGAR CARRITO CON CONTROL DE STOCK ---
    const addToCart = (prod, v) => {
        const exists = cart.find(i => i.id_variante === v.id_variante);
        const currentQty = exists ? exists.cantidad : 0;

        // Validar Stock
        if (useRealStock && currentQty + 1 > v.stock) {
            toast.error(`Stock físico insuficiente. Solo quedan ${v.stock} u.`);
            return;
        }

        if (exists) {
            setCart(prev => prev.map(i => i.id_variante === v.id_variante ? { ...i, cantidad: i.cantidad + 1 } : i));
        } else {
            setCart(prev => [...prev, {
                id_variante: v.id_variante,
                sku: v.sku || 'GEN',
                nombre: prod.nombre,
                talle: v.talle,
                precio: prod.precio,
                cantidad: 1,
                stock_actual: v.stock,
                imagen: prod.imagen
            }]);
        }
        toast.success(`+1 ${prod.nombre} (${v.talle})`, { duration: 1000 });
    };

    // --- LÓGICA: ACTUALIZAR CANTIDAD CON CONTROL DE STOCK ---
    const updateQty = (idx, delta) => {
        const newCart = [...cart];
        const item = newCart[idx];
        const newQty = Math.max(1, item.cantidad + delta);

        if (useRealStock && delta > 0 && newQty > item.stock_actual) {
            toast.error(`Stock insuficiente. Disponible: ${item.stock_actual}`);
            return;
        }

        newCart[idx].cantidad = newQty;
        setCart(newCart);
    };

    const remove = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));
    const clear = () => { if (window.confirm("¿Borrar todo?")) { setCart([]); setClientName(''); setDiscountPercent(0); } };
    const clearSearch = () => { setManualTerm(''); setManualResults([]); };

    const subtotal = cart.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;

    // --- FUNCION: MUDAR PRESUPUESTO A VENTAS (POS) ---
    const moveToPOS = () => {
        if (cart.length === 0) {
            toast.error("El presupuesto está vacío");
            return;
        }

        const posItems = cart.map(item => ({
            id_variante: item.id_variante,
            sku: item.sku || 'N/A',
            nombre: item.nombre,
            talle: item.talle,
            precio: item.precio,
            cantidad: item.cantidad,
            stock_actual: item.stock_actual || 999,
            subtotal: item.precio * item.cantidad,
            imagen: item.imagen
        }));

        let allCarts = [[], [], [], []];
        try {
            const saved = localStorage.getItem('pos_multi_carts_backup');
            if (saved) allCarts = JSON.parse(saved);
        } catch (e) { console.error("Error leyendo carritos POS", e); }

        let targetSlot = allCarts.findIndex(c => c.length === 0);
        if (targetSlot === -1) targetSlot = 0;

        allCarts[targetSlot] = posItems;
        localStorage.setItem('pos_multi_carts_backup', JSON.stringify(allCarts));

        toast.success(`¡Presupuesto enviado a Ventas (Pestaña ${targetSlot + 1})!`);
        navigate('/pos');
    };

    // --- FUNCIÓN GUARDAR BLINDADA CON IMPRESIÓN REACT-TO-PRINT ---
    const handleSaveBudget = async () => {
        if (!clientName.trim()) { toast.error("Falta nombre del cliente"); return; }
        if (cart.length === 0) { toast.error("El carrito está vacío"); return; }

        const toastId = toast.loading("Guardando presupuesto...");

        try {
            const res = await api.post('/sales/budgets/create', {
                cliente: clientName,
                descuento: discountPercent,
                total: total,
                items: cart
            });

            toast.success("Presupuesto guardado", { id: toastId });

            const serverData = res.data.budget || {};
            const safeData = {
                id: serverData.id || 0,
                fecha: serverData.fecha || new Date().toLocaleDateString('es-AR'),
                cliente: serverData.cliente || clientName,
                subtotal: parseFloat(serverData.subtotal || subtotal) || 0,
                total: parseFloat(serverData.total || total) || 0,
                descuento: parseFloat(serverData.descuento || discountPercent) || 0,
                items: cart.map(item => ({
                    nombre: item.nombre || "Item sin nombre",
                    talle: item.talle || "-",
                    cantidad: item.cantidad || 1,
                    precio: item.precio || 0,
                    precio_unitario: item.precio || 0,
                    subtotal: (item.precio || 0) * (item.cantidad || 1)
                }))
            };

            // Seteamos los datos para el componente de impresión oculto
            setPrintData(safeData);

            // Damos un pequeño margen para que React renderice el PDF oculto antes de invocar la impresora
            setTimeout(() => {
                try {
                    if (reactToPrintFn) reactToPrintFn();
                } catch (printError) {
                    console.error("Error al imprimir:", printError);
                    toast.error("Error al abrir la vista de impresión");
                }
            }, 500);

            // Limpiamos la pantalla
            setTimeout(() => {
                setCart([]);
                setClientName('');
                setDiscountPercent(0);
            }, 1500);

        } catch (e) {
            toast.error("Error al guardar: " + (e.response?.data?.msg || e.message), { id: toastId });
        }
    };

    // --- FUNCIONES DEL HISTORIAL ---
    const loadHistory = async () => {
        setIsHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            const res = await api.get('/sales/budgets/history');
            setHistoryList(res.data);
        } catch (e) {
            toast.error("Error cargando historial");
        }
        finally { setIsLoadingHistory(false); }
    };

    const loadFromHistory = (b) => {
        if (window.confirm("¿Cargar este presupuesto?")) {
            setClientName(b.cliente);
            setDiscountPercent(b.descuento);
            setCart(b.items.map(i => ({
                id_variante: i.id_variante || `old-${Math.random()}`,
                sku: 'GEN',
                nombre: i.nombre,
                talle: i.talle,
                precio: i.precio_unitario || i.precio || 0,
                cantidad: i.cantidad,
                stock_actual: 999,
                imagen: i.imagen || null // Por si el backend lo devuelve
            })));
            setIsHistoryOpen(false);
            toast.success("Cargado");
        }
    };

    // --- NUEVO: BORRAR DEL HISTORIAL ---
    const deleteFromHistory = async (id, e) => {
        e.stopPropagation(); // Evita que se cargue el presupuesto al hacer clic en el basurero
        if (!window.confirm("¿Estás seguro de eliminar permanentemente este presupuesto del historial?")) return;

        try {
            await api.delete(`/sales/budgets/${id}`);
            setHistoryList(prev => prev.filter(b => b.id !== id));
            toast.success("Presupuesto eliminado");
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar el presupuesto");
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            <Toaster position="top-center" />

            {/* COMPONENTE DE IMPRESIÓN OCULTO Y AISLADO */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printData && <BudgetPrint data={printData} />}
                </div>
            </div>

            {/* IZQUIERDA (Buscador) */}
            <div className="w-full lg:w-5/12 xl:w-1/3 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-xl z-20 transition-colors">
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center"><Calculator className="mr-2 text-yellow-500" /> Presupuestador</h1>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setUseRealStock(!useRealStock)}
                                className={`flex items-center text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all border ${useRealStock ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400'}`}
                            >
                                {useRealStock ? <CheckCircle2 size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                                {useRealStock ? "STOCK REAL" : "STOCK LIBRE"}
                            </button>
                            <button onClick={loadHistory} className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-50 dark:bg-slate-800 p-1.5 rounded-lg border dark:border-slate-700" title="Ver Historial"><History size={18} /></button>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-2">
                        <select className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-yellow-400" value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                            <option value="">Todas</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                        <div className="relative flex-1">
                            <input autoFocus className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all" placeholder="Buscar producto..." value={manualTerm} onChange={e => setManualTerm(e.target.value)} />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            {manualTerm && <button onClick={clearSearch} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-950/50 p-2 custom-scrollbar">
                    {manualResults.length === 0 && !manualTerm ? <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-slate-700"><Search size={48} className="mb-2 opacity-50" /><p className="text-xs font-medium">Usa el buscador para agregar ítems</p></div> : manualResults.map(p => (
                        <div key={p.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 mb-2 shadow-sm hover:border-yellow-400 dark:hover:border-yellow-600 transition-all group">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 overflow-hidden border dark:border-slate-600 flex items-center justify-center relative">
                                    {p.imagen ? <img src={getImageUrl(p.imagen)} className="w-full h-full object-cover" alt={p.nombre} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} /> : null}
                                    <Shirt className={`text-gray-300 dark:text-slate-500 w-full h-full p-2 ${p.imagen ? 'hidden' : 'block'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1"><h4 className="font-bold text-gray-800 dark:text-white text-sm truncate">{p.nombre}</h4><span className="text-green-600 dark:text-green-400 font-black text-xs bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">${p.precio}</span></div>
                                    <div className="flex flex-wrap gap-1">{p.variantes.map(v => (<button key={v.id_variante} onClick={() => addToCart(p, v)} className="text-[10px] bg-white dark:bg-slate-700 border dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 hover:border-yellow-400 dark:hover:border-yellow-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded transition-colors font-bold flex items-center gap-1">{v.talle} <span className="opacity-50 text-[9px] border-l pl-1">{v.stock}</span></button>))}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* DERECHA (Carrito) */}
            <div className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-slate-950 transition-colors">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-3xl m-4"><FileText size={64} className="mb-4 opacity-50" /><h3 className="text-lg font-bold">Presupuesto Vacío</h3></div> : <div className="space-y-3">{cart.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4 animate-fade-in-up">
                            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border dark:border-slate-600">
                                {/* ARREGLO IMÁGENES CARRITO */}
                                {item.imagen ? <img src={getImageUrl(item.imagen)} className="w-full h-full object-cover" alt={item.nombre} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} /> : null}
                                <Shirt className={`text-gray-300 dark:text-slate-500 w-full h-full p-2 ${item.imagen ? 'hidden' : 'block'}`} />
                            </div>
                            <div className="flex-1"><div className="flex justify-between"><h4 className="font-bold text-gray-800 dark:text-white text-sm">{item.nombre}</h4><span className="font-bold text-gray-900 dark:text-white">$ {(item.precio * item.cantidad).toLocaleString()}</span></div><div className="flex justify-between items-end mt-1"><span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400 font-mono">Talle: {item.talle}</span><div className="flex items-center bg-gray-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700"><button onClick={() => updateQty(idx, -1)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-l-lg text-gray-500 dark:text-gray-400"><Minus size={14} /></button><span className="px-2 text-sm font-bold text-gray-800 dark:text-white w-8 text-center">{item.cantidad}</span><button onClick={() => updateQty(idx, 1)} className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-r-lg text-gray-500 dark:text-gray-400"><Plus size={14} /></button></div></div></div>
                            <button onClick={() => remove(idx)} className="text-red-300 hover:text-red-500 dark:text-red-900 dark:hover:text-red-400 p-2"><Trash2 size={18} /></button>
                        </div>
                    ))}</div>}
                </div>

                <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 p-6 shadow-2xl z-30 transition-colors">
                    <div className="flex gap-4 mb-6"><div className="flex-1 relative"><User className="absolute left-3 top-3 text-gray-400" size={18} /><input placeholder="Nombre del Cliente..." className="w-full pl-10 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 dark:text-white" value={clientName} onChange={e => setClientName(e.target.value)} /></div><button onClick={clear} className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Borrar todo"><RotateCcw size={20} /></button></div>
                    <div className="mb-4"><div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2"><span>Descuento Global</span><span>{discountPercent}%</span></div><input type="range" min="0" max="100" step="5" value={discountPercent} onChange={e => setDiscountPercent(parseInt(e.target.value))} className="w-full accent-blue-600 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" /></div>
                    <div className="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-100 dark:border-slate-700"><div className="flex justify-between text-gray-600 dark:text-gray-300 text-sm"><span>Subtotal</span><span>$ {subtotal.toLocaleString()}</span></div>{discountPercent > 0 && <div className="flex justify-between text-green-600 dark:text-green-400 font-bold text-sm"><span>Descuento ({discountPercent}%)</span><span>- $ {discountAmount.toLocaleString()}</span></div>}<div className="flex justify-between text-3xl font-black text-slate-800 dark:text-white pt-2 border-t border-gray-200 dark:border-slate-600"><span>Total</span><span>$ {total.toLocaleString()}</span></div></div>

                    {/* BOTONES DE ACCIÓN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <button onClick={handleSaveBudget} disabled={cart.length === 0 || !clientName} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-black dark:hover:bg-blue-700 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group">
                            {cart.length > 0 && clientName ? <><Printer className="mr-2 group-hover:scale-110 transition-transform" /> Guardar e Imprimir</> : "Completa los datos"}
                        </button>

                        <button onClick={moveToPOS} disabled={cart.length === 0} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-bold text-sm shadow-md hover:bg-emerald-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group">
                            <Send className="mr-2 group-hover:translate-x-1 transition-transform" size={18} /> Llevar a Ventas (POS)
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL HISTORIAL (Mejorado con botón de borrar) */}
            {isHistoryOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-end animate-fade-in"
                    onClick={() => setIsHistoryOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950 transition-colors">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center">
                                <History className="mr-2" /> Historial
                            </h3>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="p-2 bg-gray-200 dark:bg-slate-800 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-100 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-100 dark:bg-slate-950 transition-colors custom-scrollbar">
                            {isLoadingHistory ? (
                                <p className="text-center text-gray-400 mt-10 animate-pulse">Cargando...</p>
                            ) : historyList.length === 0 ? (
                                <p className="text-center text-gray-400 mt-10 italic">No hay presupuestos guardados.</p>
                            ) : (
                                historyList.map(b => (
                                    <div
                                        key={b.id}
                                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col"
                                        onClick={() => loadFromHistory(b)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-white">{b.cliente}</p>
                                                <p className="text-xs text-gray-400 flex items-center mt-0.5">
                                                    <Clock size={10} className="mr-1" /> {b.fecha}
                                                </p>
                                            </div>
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                                                $ {(b.total || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-2 border-t border-gray-100 dark:border-slate-700 pt-3">
                                            <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded">
                                                {b.items ? b.items.length : 0} ítems
                                            </span>

                                            <div className="flex items-center gap-2">
                                                {/* BOTÓN ELIMINAR */}
                                                <button
                                                    onClick={(e) => deleteFromHistory(b.id, e)}
                                                    className="text-red-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title="Eliminar presupuesto"
                                                >
                                                    <Trash2 size={16} />
                                                </button>

                                                <button className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Cargar <ArrowRight size={12} className="ml-1" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetPage;