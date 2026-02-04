import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import BudgetPrint from '../components/BudgetPrint';
import toast, { Toaster } from 'react-hot-toast';
import {
    ShoppingCart, Trash2, Plus, Minus, Search, Shirt,
    Calculator, User, FileText, Printer, Layers, X,
    History, RotateCcw, ChevronDown, Filter, Maximize2, AlertTriangle
} from 'lucide-react';

const BudgetPage = () => {
    const { token } = useAuth();

    // --- ESTADOS CON PERSISTENCIA (LocalStorage) ---
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

    // Estados de Búsqueda y Filtros
    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);

    // --- NUEVOS ESTADOS PARA FILTROS ---
    const [categories, setCategories] = useState([]);
    const [specificCats, setSpecificCats] = useState([]);
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');

    // Estados de UI
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [zoomImage, setZoomImage] = useState(null); // Zoom de imagen

    // Estado para impresión
    const [budgetData, setBudgetData] = useState(null);
    const printRef = useRef();

    // --- EFECTO: GUARDAR EN LOCALSTORAGE AUTOMÁTICAMENTE ---
    useEffect(() => {
        localStorage.setItem('budget_draft_cart', JSON.stringify(cart));
        localStorage.setItem('budget_draft_client', clientName);
        localStorage.setItem('budget_draft_discount', discountPercent);
    }, [cart, clientName, discountPercent]);

    // Cálculos
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;

    // --- CARGA INICIAL DE CATEGORÍAS ---
    useEffect(() => {
        const fetchCats = async () => {
            try {
                const [resCats, resSpecs] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);
                setCategories(resCats.data);
                setSpecificCats(resSpecs.data);
            } catch (e) { console.error("Error cargando filtros", e); }
        };
        fetchCats();
    }, []);

    // --- BÚSQUEDA INTELIGENTE CON FILTROS ---
    useEffect(() => {
        // Si está todo vacío, limpiamos resultados
        if (!manualTerm.trim() && !selectedCat && !selectedSpec) {
            setManualResults([]);
            return;
        }

        const delaySearch = setTimeout(async () => {
            try {
                const params = { limit: 50 };
                if (manualTerm) params.search = manualTerm;
                if (selectedCat) params.category_id = selectedCat;
                if (selectedSpec) params.specific_id = selectedSpec;

                const res = await api.get('/products', { params });
                setManualResults(res.data.products || []);
            } catch (error) { console.error(error); }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [manualTerm, selectedCat, selectedSpec]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setManualResults([]);
            e.currentTarget.blur();
        }
    };

    // --- FUNCIONES CARRITO ---
    const addToCart = (product, variant) => {
        setCart(prev => {
            const existing = prev.find(i => i.id_variante === variant.id_variante);
            if (existing) {
                return prev.map(i => i.id_variante === variant.id_variante
                    ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio }
                    : i);
            }
            return [...prev, {
                id_variante: variant.id_variante,
                sku: variant.sku,
                nombre: product.nombre,
                talle: variant.talle,
                precio: product.precio,
                cantidad: 1,
                subtotal: product.precio
            }];
        });
        toast.success(`Agregado: ${variant.talle}`, { duration: 1000 });
    };

    const addAllToCart = (product) => {
        if (!product.variantes || product.variantes.length === 0) return toast.error("Sin variantes");

        setCart(prev => {
            let newCart = [...prev];
            product.variantes.forEach(v => {
                const existingIdx = newCart.findIndex(i => i.id_variante === v.id_variante);
                if (existingIdx >= 0) {
                    const current = newCart[existingIdx];
                    newCart[existingIdx] = {
                        ...current,
                        cantidad: current.cantidad + 1,
                        subtotal: (current.cantidad + 1) * current.precio
                    };
                } else {
                    newCart.push({
                        id_variante: v.id_variante,
                        sku: v.sku,
                        nombre: product.nombre,
                        talle: v.talle,
                        precio: product.precio,
                        cantidad: 1,
                        subtotal: product.precio
                    });
                }
            });
            return newCart;
        });
        toast.success(`Curva completa agregada`);
    };

    const updateQuantity = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id_variante === id) {
                const newQty = Math.max(1, item.cantidad + delta);
                return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id_variante !== id));

    const clearDraft = () => {
        if (window.confirm("¿Borrar borrador?")) {
            setCart([]); setClientName(''); setDiscountPercent(0);
            localStorage.removeItem('budget_draft_cart');
            localStorage.removeItem('budget_draft_client');
            localStorage.removeItem('budget_draft_discount');
            toast("Borrador limpiado");
        }
    };

    // --- PDF ---
    const downloadPdf = async (id) => {
        const loadToast = toast.loading("Generando PDF...");
        try {
            const res = await api.get(`/sales/presupuestos/${id}/pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Presupuesto_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.dismiss(loadToast);
            toast.success("PDF Descargado");
        } catch (e) {
            console.error(e);
            toast.error("Error al descargar PDF", { id: loadToast });
        }
    };

    const handleSaveBudget = async () => {
        if (cart.length === 0) return toast.error("Carrito vacío");
        if (!clientName.trim()) return toast.error("Falta nombre del cliente");

        const loadingId = toast.loading("Guardando...");
        try {
            const payload = { cliente: clientName, descuento: discountPercent, items: cart };
            const res = await api.post('/sales/presupuestos', payload);

            setBudgetData({ ...payload, id: res.data.id, total: res.data.total });

            setTimeout(() => {
                downloadPdf(res.data.id);
                toast.success("¡Guardado!", { id: loadingId });
                setCart([]); setClientName(''); setDiscountPercent(0);
                localStorage.removeItem('budget_draft_cart');
                localStorage.removeItem('budget_draft_client');
                localStorage.removeItem('budget_draft_discount');
            }, 500);

        } catch (error) {
            console.error(error);
            toast.error("Error al guardar", { id: loadingId });
        }
    };

    // --- HISTORIAL ---
    const fetchHistory = async () => {
        setIsHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            const res = await api.get('/sales/presupuestos');
            setHistoryList(res.data || []);
        } catch (error) { toast.error("Error historial"); }
        finally { setIsLoadingHistory(false); }
    };

    const restoreBudget = (budget) => {
        if (cart.length > 0 && !window.confirm("¿Reemplazar borrador actual?")) return;
        const restoredItems = budget.items.map(i => ({
            id_variante: i.id_variante || i.sku,
            sku: i.sku || 'REF',
            nombre: i.nombre || 'Producto Recuperado',
            talle: i.talle || '-',
            precio: parseFloat(i.precio),
            cantidad: i.cantidad,
            subtotal: parseFloat(i.subtotal)
        }));
        setCart(restoredItems);
        setClientName(budget.cliente);
        setDiscountPercent(budget.descuento || 0);
        setIsHistoryOpen(false);
        toast.success(`Presupuesto #${budget.id} restaurado`);
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-4 max-w-7xl mx-auto animate-fade-in">
            <Toaster position="top-center" />
            <div style={{ display: 'none' }}><BudgetPrint ref={printRef} data={budgetData} /></div>

            {/* --- MODAL HISTORIAL --- */}
            {isHistoryOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-xl flex items-center text-gray-800"><History className="mr-2 text-blue-600" /> Historial</h3>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingHistory ? <div className="text-center py-10 text-gray-400">Cargando...</div> : historyList.length === 0 ? <div className="text-center py-10 text-gray-400">Sin historial.</div> : (
                                <table className="w-full text-left text-sm">
                                    <thead className="text-gray-500 uppercase bg-gray-50 sticky top-0"><tr><th className="p-3">ID</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Acciones</th></tr></thead>
                                    <tbody className="divide-y">{historyList.map(b => (<tr key={b.id} className="hover:bg-blue-50 transition-colors"><td className="p-3 font-mono text-gray-500">#{b.id}</td><td className="p-3">{new Date(b.fecha).toLocaleDateString()}</td><td className="p-3 font-bold text-gray-800">{b.cliente}</td><td className="p-3 text-right font-bold text-green-600">$ {b.total.toLocaleString()}</td><td className="p-3 text-center flex justify-center gap-2"><button onClick={() => restoreBudget(b)} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-200 flex items-center"><RotateCcw size={14} className="mr-1" /> EDITAR</button><button onClick={(e) => { e.stopPropagation(); downloadPdf(b.id); }} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200 flex items-center"><Printer size={14} className="mr-1" /> PDF</button></td></tr>))}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* IZQUIERDA: Buscador */}
            <div className="w-full md:w-2/3 flex flex-col gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative z-50">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center"><FileText className="mr-2 text-blue-600" /> Nuevo Presupuesto</h2>
                        <button onClick={fetchHistory} className="text-gray-500 hover:text-blue-600 flex items-center text-sm font-bold bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"><History size={16} className="mr-2" /> Historial</button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* --- FILTROS --- */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)} className="w-full p-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer hover:bg-gray-100 transition-colors">
                                    <option value="">Todas las Categorías</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative flex-1">
                                <select value={selectedSpec} onChange={(e) => setSelectedSpec(e.target.value)} className="w-full p-2 pl-3 pr-8 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 appearance-none focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer hover:bg-gray-100 transition-colors">
                                    <option value="">Todas las Ligas</option>
                                    {specificCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                            {(selectedCat || selectedSpec || manualTerm) && (
                                <button onClick={() => { setSelectedCat(''); setSelectedSpec(''); setManualTerm(''); }} className="bg-red-50 text-red-500 p-2 rounded-lg border border-red-100 hover:bg-red-100" title="Limpiar filtros"><X size={18} /></button>
                            )}
                        </div>

                        {/* INPUT BUSCADOR */}
                        <div className="relative">
                            <div className="flex items-center border-2 border-blue-200 rounded-lg overflow-hidden focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                                <Search className="ml-3 text-gray-400" />
                                <input
                                    autoFocus
                                    value={manualTerm}
                                    onChange={e => setManualTerm(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Buscar producto (ej: Remera Boca XL)..."
                                    className="w-full p-3 outline-none"
                                />
                            </div>

                            {/* RESULTADOS FLOTANTES */}
                            {manualResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-b-lg mt-1 max-h-96 overflow-y-auto z-50">
                                    <div className="p-2 bg-blue-50 text-blue-800 text-xs font-bold text-center border-b">
                                        {manualResults.length} resultados encontrados
                                    </div>
                                    {manualResults.map(p => (
                                        <div key={p.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 animate-fade-in group items-start">
                                            {/* IMAGEN CON ZOOM */}
                                            <div
                                                className="w-12 h-12 bg-gray-100 rounded shrink-0 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img border"
                                                onClick={(e) => { if (p.imagen) { e.stopPropagation(); setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); } }}
                                            >
                                                {p.imagen ? (
                                                    <>
                                                        <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 size={16} className="text-white" /></div>
                                                    </>
                                                ) : <Shirt size={20} className="text-gray-300" />}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-sm text-gray-800">{p.nombre}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-green-600">$ {p.precio}</span>
                                                        <button onClick={() => addAllToCart(p)} className="flex items-center bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-wide"><Layers size={12} className="mr-1" /> Todo</button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 mb-1 flex gap-2">
                                                    {p.categoria && <span className="bg-gray-100 px-1 rounded">{p.categoria}</span>}
                                                    {p.liga && <span className="bg-gray-100 px-1 rounded">{p.liga}</span>}
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {p.variantes.map(v => (
                                                        <button key={v.id_variante} onClick={() => addToCart(p, v)} className="text-xs px-2 py-1 rounded border hover:bg-gray-800 hover:text-white border-gray-200 text-gray-600 transition-colors">{v.talle}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* LISTA DE ITEMS */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 bg-gray-50 border-b font-bold text-gray-500 uppercase text-xs flex justify-between items-center">
                        <span>Items ({cart.length})</span>
                        {cart.length > 0 && <button onClick={clearDraft} className="text-red-500 hover:text-red-700 flex items-center text-[10px] font-bold bg-red-50 px-2 py-1 rounded"><Trash2 size={12} className="mr-1" /> VACIAR</button>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-300"><ShoppingCart size={48} className="mb-2 opacity-20" /><p>Carrito vacío.</p></div> : (
                            cart.map(item => (
                                <div key={item.id_variante} className="flex justify-between items-center bg-white border p-3 rounded-lg shadow-sm hover:border-blue-200 transition-colors">
                                    <div><p className="font-bold text-gray-800 text-sm">{item.nombre}</p><p className="text-xs text-gray-500">Talle: <b className="text-gray-800">{item.talle}</b> | Unit: ${item.precio}</p></div>
                                    <div className="flex items-center gap-4"><div className="flex items-center bg-gray-100 rounded-lg"><button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1 hover:bg-gray-200 rounded-l text-gray-600"><Minus size={14} /></button><span className="w-8 text-center font-bold text-sm">{item.cantidad}</span><button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1 hover:bg-gray-200 rounded-r text-gray-600"><Plus size={14} /></button></div><span className="font-bold w-20 text-right text-gray-800">${item.subtotal.toLocaleString()}</span><button onClick={() => removeFromCart(item.id_variante)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button></div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* DERECHA: Configuración */}
            <div className="w-full md:w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                <div className="bg-slate-800 text-white p-4"><h3 className="font-bold text-lg flex items-center"><Calculator className="mr-2" /> Configuración</h3></div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente / Empresa</label>
                        <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={18} /><input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre del cliente..." className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700" /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between"><span>Descuento Global</span><span className="text-blue-600 font-bold">{discountPercent}% OFF</span></label>
                        <input type="range" min="0" max="50" step="5" value={discountPercent} onChange={e => setDiscountPercent(parseInt(e.target.value))} className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1 font-bold"><span>0%</span><span>25%</span><span>50%</span></div>
                    </div>
                    <hr className="border-dashed" />
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex justify-between text-gray-600 text-sm"><span>Subtotal</span><span>$ {subtotal.toLocaleString()}</span></div>
                        {discountPercent > 0 && <div className="flex justify-between text-green-600 font-bold text-sm"><span>Descuento ({discountPercent}%)</span><span>- $ {discountAmount.toLocaleString()}</span></div>}
                        <div className="flex justify-between text-3xl font-black text-slate-800 pt-2 border-t border-gray-200"><span>Total</span><span>$ {total.toLocaleString()}</span></div>
                    </div>
                </div>
                <div className="p-4 bg-white border-t">
                    <button onClick={handleSaveBudget} disabled={cart.length === 0 || !clientName} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group">{cart.length > 0 && clientName ? <><Printer className="mr-2 group-hover:scale-110 transition-transform" /> Guardar y Descargar PDF</> : "Completa los datos..."}</button>
                </div>
            </div>

            {/* MODAL ZOOM */}
            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 p-2 rounded-full"><X size={40} /></button>
                </div>
            )}
        </div>
    );
};

export default BudgetPage;