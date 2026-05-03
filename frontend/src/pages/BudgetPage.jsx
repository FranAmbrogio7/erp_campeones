import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import BudgetPrint from '../components/BudgetPrint';
import { useReactToPrint } from 'react-to-print';
import toast, { Toaster } from 'react-hot-toast';
import {
    ShoppingCart, Trash2, Plus, Minus, Search, Shirt,
    Calculator, User, FileText, Printer, Save, Layers, X,
    History, RotateCcw, Clock, CheckCircle2, ArrowRight,
    ListPlus, AlertTriangle, Send
} from 'lucide-react';

// =========================================================================
// UTILERÍA: Normalizador de Estampas
// =========================================================================
const getRealEstampa = (estampaStr) => {
    if (!estampaStr) return null;
    const clean = estampaStr.toString().trim().toUpperCase();
    if (clean === '' || clean === 'STANDARD' || clean === 'SIN ESTAMPA' || clean === '-' || clean === 'N/A' || clean === 'SIN DORSAL') {
        return null;
    }
    return estampaStr;
};

// =========================================================================
// SUB-COMPONENTE: Modal Seleccionador de Variante
// =========================================================================
const VariantSelectionModal = ({ product, isOpen, onClose, onSelect, useRealStock }) => {
    if (!isOpen || !product) return null;

    // Agrupamos las variantes por Talle
    const groupedVariants = product.variantes.reduce((acc, v) => {
        if (!acc[v.talle]) acc[v.talle] = [];
        const estampaName = getRealEstampa(v.estampa) || 'Sin Estampa';
        acc[v.talle].push({ ...v, estampaName });
        return acc;
    }, {});

    // Si pasamos un talle preseleccionado, solo mostramos ese. Si no, mostramos todos.
    const targetTalles = product.preselectedTalle 
        ? [product.preselectedTalle] 
        : Object.keys(groupedVariants);

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                <div className="bg-yellow-50 dark:bg-slate-900 p-5 border-b border-yellow-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-black text-xl text-yellow-900 dark:text-white flex items-center">
                            <Shirt className="mr-2 text-yellow-500" size={24}/> Seleccionar Estampa
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-slate-400 mt-1 font-medium">{product.nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-200 dark:border-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-slate-800/50">
                    <div className="space-y-6">
                        {targetTalles.map(talle => {
                            const detalles = groupedVariants[talle].sort((a, b) => 
                                a.estampaName === 'Sin Estampa' ? -1 : b.estampaName === 'Sin Estampa' ? 1 : 0
                            );

                            return (
                                <div key={talle} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h4 className="font-black text-lg text-slate-800 dark:text-white mb-3 flex items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                        Talle {talle}
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {detalles.map(det => {
                                            const isClickable = !useRealStock || det.stock > 0;
                                            
                                            return (
                                                <button
                                                    key={det.id_variante}
                                                    disabled={!isClickable}
                                                    onClick={() => onSelect(product, det)}
                                                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 text-center
                                                        ${isClickable 
                                                            ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/20 hover:bg-yellow-100 hover:border-yellow-400 dark:hover:bg-yellow-900/50 cursor-pointer' 
                                                            : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 opacity-50 cursor-not-allowed grayscale'}`}
                                                >
                                                    <span className={`font-bold text-sm mb-1 ${isClickable ? 'text-yellow-900 dark:text-yellow-100' : 'text-slate-500 dark:text-slate-400 line-through'}`}>
                                                        {det.estampaName}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${det.stock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'}`}>
                                                        {det.stock > 0 ? `Stock: ${det.stock}` : 'SIN STOCK'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

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

    // --- ESTADOS DE LA PÁGINA ---
    const [useRealStock, setUseRealStock] = useState(true);
    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [categories, setCategories] = useState([]);

    // --- ESTADOS DE FILTROS Y ZOOM ---
    const [selectedCat, setSelectedCat] = useState('');
    const [sortBy, setSortBy] = useState('mas_vendidos');
    const [zoomImage, setZoomImage] = useState(null);
    const [variantModalProduct, setVariantModalProduct] = useState(null);

    // --- ESTADOS DE IMPRESIÓN ---
    const [printData, setPrintData] = useState(null);
    const printRef = useRef(null);

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
                const params = {
                    search: manualTerm,
                    limit: 100,
                    sort_by: sortBy
                };
                if (selectedCat) params.category_id = selectedCat;
                const res = await api.get('/products', { params });
                setManualResults(res.data.products || []);
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(delay);
    }, [manualTerm, selectedCat, sortBy]);

    const getImageUrl = (img) => {
        if (!img) return null;
        if (img.startsWith('http')) return img;
        return `/api/static/uploads/${img}`;
    };

    // --- NUEVA LÓGICA DIRECTA ---
    const handleSizeClick = (product, talle) => {
        const variantsForSize = product.variantes.filter(v => v.talle === talle);
        const hasOptions = variantsForSize.some(v => getRealEstampa(v.estampa) !== null);

        if (!hasOptions) {
            // Sin estampa real, se agrega directo (buscando el que tenga stock, o el primero)
            const variantToAdd = variantsForSize.find(v => v.stock > 0) || variantsForSize[0];
            addToCart(product, variantToAdd);
        } else {
            // Tiene opciones reales de estampas, abrimos el modal solo para este talle
            setVariantModalProduct({ ...product, preselectedTalle: talle });
        }
    };

    const handleProductSelectClick = (product) => {
        if (product.variantes.length === 1 && (!useRealStock || product.variantes[0].stock > 0)) {
            addToCart(product, product.variantes[0]);
        } else {
            setVariantModalProduct(product); // Abre el modal con TODOS los talles disponibles
        }
    };

    const addToCart = (prod, v) => {
        const exists = cart.find(i => i.id_variante === v.id_variante);
        const currentQty = exists ? exists.cantidad : 0;

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
                estampa: v.estampa,
                precio: prod.precio,
                cantidad: 1,
                stock_actual: v.stock,
                imagen: prod.imagen
            }]);
        }
        
        const estampaReal = getRealEstampa(v.estampa);
        const estampaText = estampaReal ? ` - ${estampaReal}` : '';
        toast.success(`+1 ${prod.nombre} (${v.talle}${estampaText})`, { duration: 1000 });
        
        setVariantModalProduct(null); // Cerrar modal si estaba abierto (Mantiene la búsqueda)
    };

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
            estampa: item.estampa,
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
                items: cart.map(item => {
                    const estampaReal = getRealEstampa(item.estampa);
                    return {
                        nombre: item.nombre || "Item sin nombre",
                        talle: estampaReal ? `${item.talle} - ${estampaReal}` : (item.talle || "-"),
                        cantidad: item.cantidad || 1,
                        precio: item.precio || 0,
                        precio_unitario: item.precio || 0,
                        subtotal: (item.precio || 0) * (item.cantidad || 1)
                    };
                })
            };

            setPrintData(safeData);

            setTimeout(() => {
                try {
                    if (reactToPrintFn) reactToPrintFn();
                } catch (printError) {
                    console.error("Error al imprimir:", printError);
                    toast.error("Error al abrir la vista de impresión");
                }
            }, 500);

            setTimeout(() => {
                setCart([]);
                setClientName('');
                setDiscountPercent(0);
            }, 1500);

        } catch (e) {
            toast.error("Error al guardar: " + (e.response?.data?.msg || e.message), { id: toastId });
        }
    };

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
            setCart(b.items.map(i => {
                // Al recuperar, intentamos separar el talle de la estampa si se guardó combinado
                let talleRec = i.talle;
                let estampaRec = 'Standard';
                if (i.talle && i.talle.includes(' - ')) {
                    const parts = i.talle.split(' - ');
                    talleRec = parts[0];
                    estampaRec = parts[1];
                }
                return {
                    id_variante: i.id_variante || `old-${Math.random()}`,
                    sku: 'GEN',
                    nombre: i.nombre,
                    talle: talleRec,
                    estampa: estampaRec,
                    precio: i.precio_unitario || i.precio || 0,
                    cantidad: i.cantidad,
                    stock_actual: 999,
                    imagen: i.imagen || null
                };
            }));
            setIsHistoryOpen(false);
            toast.success("Cargado");
        }
    };

    const deleteFromHistory = async (id, e) => {
        e.stopPropagation();
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

            {/* COMPONENTE DE IMPRESIÓN OCULTO */}
            <div style={{ display: 'none' }}>
                <div ref={printRef}>
                    {printData && <BudgetPrint data={printData} />}
                </div>
            </div>

            {/* MODAL SELECTOR DE VARIANTE */}
            <VariantSelectionModal 
                product={variantModalProduct} 
                isOpen={!!variantModalProduct} 
                onClose={() => setVariantModalProduct(null)} 
                onSelect={addToCart}
                useRealStock={useRealStock}
            />

            {/* IZQUIERDA (Buscador y Resultados) */}
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

                    {/* BARRA DE BÚSQUEDA Y FILTROS */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-2">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <select className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-yellow-400 p-2 cursor-pointer" value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                                <option value="">Todas</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <select className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs font-bold text-gray-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-yellow-400 p-2 cursor-pointer" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="mas_vendidos">Más Vendidos</option>
                                <option value="recientes">Más Recientes</option>
                                <option value="az">A - Z</option>
                            </select>
                        </div>
                        <div className="relative flex-1">
                            <input autoFocus className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-yellow-400 transition-all" placeholder="Buscar producto..." value={manualTerm} onChange={e => setManualTerm(e.target.value)} />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            {manualTerm && <button onClick={clearSearch} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-950/50 p-2 custom-scrollbar">
                    {manualResults.length === 0 && !manualTerm ? <div className="h-full flex flex-col items-center justify-center text-gray-300 dark:text-slate-700"><Search size={48} className="mb-2 opacity-50" /><p className="text-xs font-medium">Usa el buscador para agregar ítems</p></div> : manualResults.map(p => {
                        const tallesUnicos = Array.from(new Set(p.variantes.map(v => v.talle)));

                        return (
                            <div key={p.id} className="bg-white dark:bg-slate-800 p-4 border-b border-gray-200 dark:border-slate-700 shadow-sm hover:border-yellow-400 dark:hover:border-yellow-600 hover:bg-yellow-50/50 dark:hover:bg-slate-700/50 transition-all cursor-pointer group" onClick={() => handleProductSelectClick(p)}>
                                <div className="flex gap-4">
                                    <div
                                        className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-xl shrink-0 overflow-hidden border dark:border-slate-600 flex items-center justify-center relative cursor-zoom-in group/img"
                                        onClick={(e) => { if (p.imagen) { e.stopPropagation(); setZoomImage(getImageUrl(p.imagen)); } }}
                                        title="Ampliar imagen"
                                    >
                                        {p.imagen ? <img src={getImageUrl(p.imagen)} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" alt={p.nombre} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} /> : null}
                                        <Shirt className={`text-gray-300 dark:text-slate-500 w-full h-full p-3 ${p.imagen ? 'hidden' : 'block'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-black text-gray-800 dark:text-white text-base truncate pr-2">{p.nombre}</h4>
                                            <span className="text-yellow-600 dark:text-yellow-400 font-black text-lg">${p.precio}</span>
                                        </div>

                                        {/* BOTONES DE TALLES AMPLIOS DIRECTOS */}
                                        <div className="mt-1 flex flex-wrap gap-2">
                                            {tallesUnicos.length > 0 ? tallesUnicos.map(t => {
                                                const variantsForSize = p.variantes.filter(v => v.talle === t);
                                                const hasStock = variantsForSize.some(v => v.stock > 0);
                                                const isClickable = !useRealStock || hasStock;
                                                
                                                return (
                                                    <button 
                                                        key={t} 
                                                        disabled={!isClickable}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            handleSizeClick(p, t);
                                                        }}
                                                        className={`text-sm font-black px-4 py-2 rounded-xl shadow-sm border-2 transition-all active:scale-95 ${
                                                            isClickable 
                                                            ? 'bg-white dark:bg-slate-800 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-slate-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/50 hover:border-yellow-400'
                                                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 line-through opacity-70 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {t}
                                                    </button>
                                                );
                                            }) : (
                                                <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">SIN VARIANTE</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* DERECHA (Carrito) */}
            <div className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-slate-950 transition-colors">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 border-2 border-dashed border-gray-300 dark:border-slate-800 rounded-3xl m-4"><FileText size={64} className="mb-4 opacity-50" /><h3 className="text-lg font-bold">Presupuesto Vacío</h3></div> : <div className="space-y-3">{cart.map((item, idx) => {
                        const estampaReal = getRealEstampa(item.estampa);
                        return (
                            <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4 animate-fade-in-up transition-colors">
                                <div
                                    className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border dark:border-slate-600 relative cursor-zoom-in group/img"
                                    onClick={(e) => { if (item.imagen) { e.stopPropagation(); setZoomImage(getImageUrl(item.imagen)); } }}
                                    title="Ampliar imagen"
                                >
                                    {item.imagen ? <img src={getImageUrl(item.imagen)} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" alt={item.nombre} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} /> : null}
                                    <Shirt className={`text-gray-300 dark:text-slate-500 w-full h-full p-2 ${item.imagen ? 'hidden' : 'block'}`} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h4 className="font-bold text-gray-800 dark:text-white text-sm">{item.nombre}</h4>
                                        <span className="font-bold text-gray-900 dark:text-white">$ {(item.precio * item.cantidad).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end mt-1">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-[10px] bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Talle: {item.talle}</span>
                                            {estampaReal && <span className="text-[10px] bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{estampaReal}</span>}
                                        </div>
                                        <div className="flex items-center bg-gray-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                                            <button onClick={() => updateQty(idx, -1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-l-lg text-gray-500 dark:text-gray-400"><Minus size={14} /></button>
                                            <span className="px-2 text-sm font-bold text-gray-800 dark:text-white w-8 text-center">{item.cantidad}</span>
                                            <button onClick={() => updateQty(idx, 1)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-r-lg text-gray-500 dark:text-gray-400"><Plus size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => remove(idx)} className="text-red-300 hover:text-red-500 dark:text-red-900 dark:hover:text-red-400 p-2"><Trash2 size={18} /></button>
                            </div>
                        )
                    })}</div>}
                </div>

                <div className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-30 transition-colors">
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 relative">
                            <User className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input placeholder="Nombre del Cliente..." className="w-full pl-10 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold text-gray-800 dark:text-white transition-colors" value={clientName} onChange={e => setClientName(e.target.value)} />
                        </div>
                        <button onClick={clear} className="bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Borrar todo"><RotateCcw size={20} /></button>
                    </div>
                    
                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                            <span>Descuento Global</span>
                            <span className="text-yellow-600 dark:text-yellow-400">{discountPercent}%</span>
                        </div>
                        <input type="range" min="0" max="100" step="5" value={discountPercent} onChange={e => setDiscountPercent(parseInt(e.target.value))} className="w-full accent-yellow-500 h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between text-gray-600 dark:text-gray-300 text-sm font-bold">
                            <span>Subtotal</span>
                            <span>$ {subtotal.toLocaleString()}</span>
                        </div>
                        {discountPercent > 0 && <div className="flex justify-between text-green-600 dark:text-green-400 font-bold text-sm">
                            <span>Descuento ({discountPercent}%)</span>
                            <span>- $ {discountAmount.toLocaleString()}</span>
                        </div>}
                        <div className="flex justify-between items-end pt-3 border-t border-gray-200 dark:border-slate-600">
                            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 tracking-widest mb-1">Total Presupuesto</span>
                            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">$ {total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* BOTONES DE ACCIÓN */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <button onClick={handleSaveBudget} disabled={cart.length === 0 || !clientName} className="w-full bg-slate-800 dark:bg-slate-700 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group">
                            {cart.length > 0 && clientName ? <><Printer size={18} className="mr-2 group-hover:scale-110 transition-transform" /> Guardar e Imprimir</> : "Faltan datos"}
                        </button>

                        <button onClick={moveToPOS} disabled={cart.length === 0} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group">
                            <Send size={18} className="mr-2 group-hover:translate-x-1 transition-transform" /> Llevar a Ventas
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL HISTORIAL */}
            {isHistoryOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-end animate-fade-in"
                    onClick={() => setIsHistoryOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950 transition-colors shrink-0">
                            <h3 className="font-black text-xl text-gray-800 dark:text-white flex items-center tracking-tight">
                                <History className="mr-3 text-blue-500" size={24} /> Historial
                            </h3>
                            <button
                                onClick={() => setIsHistoryOpen(false)}
                                className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50 dark:bg-slate-950/50 transition-colors custom-scrollbar">
                            {isLoadingHistory ? (
                                <p className="text-center text-gray-400 mt-10 animate-pulse font-bold text-sm">Cargando historial...</p>
                            ) : historyList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center mt-20 text-gray-400 dark:text-slate-600">
                                    <History size={48} className="mb-3 opacity-50" />
                                    <p className="text-sm font-bold">No hay presupuestos guardados.</p>
                                </div>
                            ) : (
                                historyList.map(b => (
                                    <div
                                        key={b.id}
                                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group flex flex-col"
                                        onClick={() => loadFromHistory(b)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-white leading-tight">{b.cliente}</p>
                                                <p className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center mt-1 uppercase tracking-wider font-bold">
                                                    <Clock size={10} className="mr-1" /> {b.fecha}
                                                </p>
                                            </div>
                                            <span className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                                $ {(b.total || 0).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-3 border-t border-gray-100 dark:border-slate-700 pt-3">
                                            <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 px-2 py-1 rounded font-bold uppercase tracking-wider">
                                                {b.items ? b.items.length : 0} ítems
                                            </span>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => deleteFromHistory(b.id, e)}
                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                    title="Eliminar presupuesto"
                                                >
                                                    <Trash2 size={16} />
                                                </button>

                                                <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95">
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

            {/* --- MODAL ZOOM DE IMAGEN --- */}
            {zoomImage && (
                <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-zoom-in" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors">
                        <X size={28} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default BudgetPage;