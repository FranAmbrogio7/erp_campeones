import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import BudgetPrint from '../components/BudgetPrint';
import toast, { Toaster } from 'react-hot-toast';
import {
    ShoppingCart, Trash2, Plus, Minus, Search, Shirt,
    Calculator, User, FileText, Printer, Save, Layers, X,
    History, RotateCcw, Clock, CheckCircle2, ArrowRight
} from 'lucide-react';

const BudgetPage = () => {
    const { token } = useAuth();

    // --- ESTADOS CON PERSISTENCIA (LocalStorage) ---
    // Inicializamos leyendo del storage si existe
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

    // Estados volátiles
    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyList, setHistoryList] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Impresión
    const [budgetData, setBudgetData] = useState(null);
    const printRef = useRef();
    const handlePrint = useReactToPrint({ contentRef: printRef });

    // --- EFECTO: GUARDAR EN LOCALSTORAGE AUTOMÁTICAMENTE ---
    useEffect(() => {
        localStorage.setItem('budget_draft_cart', JSON.stringify(cart));
        localStorage.setItem('budget_draft_client', clientName);
        localStorage.setItem('budget_draft_discount', discountPercent);
    }, [cart, clientName, discountPercent]);

    // Cálculos en tiempo real
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;

    // --- BÚSQUEDA INFINITA ---
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!manualTerm.trim()) {
                setManualResults([]);
                return;
            }
            try {
                // Aumentamos el límite a 5000 para traer "todo" lo que coincida
                const res = await api.get('/products', { params: { search: manualTerm, limit: 5000 } });
                setManualResults(res.data.products || []);
            } catch (error) { console.error(error); }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [manualTerm]);

    // --- MANEJO DE TECLADO (UX) ---
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
        if (!product.variantes || product.variantes.length === 0) return toast.error("Sin variantes disponibles");

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
        setManualTerm('');
        setManualResults([]);
        toast.success(`Curva completa agregada (${product.variantes.length} items)`);
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
        if (window.confirm("¿Borrar el borrador actual y empezar de cero?")) {
            setCart([]);
            setClientName('');
            setDiscountPercent(0);
            localStorage.removeItem('budget_draft_cart');
            localStorage.removeItem('budget_draft_client');
            localStorage.removeItem('budget_draft_discount');
            toast("Borrador limpiado");
        }
    };

    // --- GUARDAR NUEVO PRESUPUESTO ---
    const handleSaveBudget = async () => {
        if (cart.length === 0) return toast.error("El carrito está vacío");
        if (!clientName.trim()) return toast.error("Ingresa el nombre del cliente");

        const loadingId = toast.loading("Guardando...");
        try {
            const payload = {
                cliente: clientName,
                descuento: discountPercent,
                items: cart
            };

            const res = await api.post('/sales/presupuestos', payload);

            setBudgetData({
                id: res.data.id,
                cliente: clientName,
                items: cart,
                subtotal: subtotal,
                descuento: discountPercent,
                monto_descuento: discountAmount,
                total: res.data.total
            });

            // Limpiamos el borrador (porque ya se guardó)
            setTimeout(() => {
                handlePrint();
                toast.success("¡Guardado e Imprimiendo!", { id: loadingId });
                // Opcional: ¿Quieres limpiar al guardar o mantenerlo? 
                // Normalmente al guardar un presupuesto final, se limpia para hacer otro.
                setCart([]);
                setClientName('');
                setDiscountPercent(0);
                localStorage.removeItem('budget_draft_cart');
                localStorage.removeItem('budget_draft_client');
                localStorage.removeItem('budget_draft_discount');
            }, 500);

        } catch (error) {
            toast.error("Error al guardar", { id: loadingId });
        }
    };

    // --- HISTORIAL Y RESTAURACIÓN ---
    const fetchHistory = async () => {
        setIsHistoryOpen(true);
        setIsLoadingHistory(true);
        try {
            const res = await api.get('/sales/presupuestos'); // Asumiendo que creaste este endpoint GET
            setHistoryList(res.data || []);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando historial");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const restoreBudget = (budget) => {
        if (cart.length > 0) {
            if (!window.confirm("Tienes un presupuesto en curso. ¿Reemplazarlo con este antiguo?")) return;
        }

        // Mapeamos los datos del backend al formato del frontend
        // Asumimos que budget.items viene con la estructura correcta o la adaptamos
        const restoredItems = budget.items.map(i => ({
            id_variante: i.id_variante || i.sku, // Fallback
            sku: i.sku,
            nombre: i.nombre_producto || i.nombre,
            talle: i.talle,
            precio: parseFloat(i.precio_unitario || i.precio),
            cantidad: i.cantidad,
            subtotal: parseFloat(i.subtotal)
        }));

        setCart(restoredItems);
        setClientName(budget.cliente);
        setDiscountPercent(budget.descuento || 0);

        setIsHistoryOpen(false);
        toast.success(`Presupuesto #${budget.id} cargado`);
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-4 max-w-7xl mx-auto animate-fade-in">
            <Toaster position="top-center" />

            {/* Componente Oculto para Impresión */}
            <div style={{ display: 'none' }}>
                <BudgetPrint ref={printRef} data={budgetData} />
            </div>

            {/* --- MODAL HISTORIAL --- */}
            {isHistoryOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-xl flex items-center text-gray-800">
                                <History className="mr-2 text-blue-600" /> Historial de Presupuestos
                            </h3>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingHistory ? (
                                <div className="text-center py-10 text-gray-400">Cargando...</div>
                            ) : historyList.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">No hay presupuestos guardados.</div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="text-gray-500 uppercase bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="p-3">ID</th>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Cliente</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {historyList.map(b => (
                                            <tr key={b.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="p-3 font-mono text-gray-500">#{b.id}</td>
                                                <td className="p-3">{new Date(b.fecha).toLocaleDateString()}</td>
                                                <td className="p-3 font-bold text-gray-800">{b.cliente}</td>
                                                <td className="p-3 text-right font-bold text-green-600">$ {b.total.toLocaleString()}</td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => restoreBudget(b)}
                                                        className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-blue-200 transition-colors flex items-center justify-center mx-auto"
                                                    >
                                                        <RotateCcw size={14} className="mr-1" /> CARGAR
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
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
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            <FileText className="mr-2 text-blue-600" /> Nuevo Presupuesto
                        </h2>
                        {/* Botón Historial */}
                        <button
                            onClick={fetchHistory}
                            className="text-gray-500 hover:text-blue-600 flex items-center text-sm font-bold bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
                        >
                            <History size={16} className="mr-2" /> Ver Anteriores
                        </button>
                    </div>

                    <div className="relative">
                        <div className="flex items-center border-2 border-blue-200 rounded-lg overflow-hidden focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                            <Search className="ml-3 text-gray-400" />
                            <input
                                autoFocus
                                value={manualTerm}
                                onChange={e => setManualTerm(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar producto (límite infinito)..."
                                className="w-full p-3 outline-none"
                            />
                            {manualResults.length > 0 && (
                                <button onClick={() => { setManualTerm(''); setManualResults([]); }} className="mr-3 text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Resultados Flotantes */}
                        {manualResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-b-lg mt-1 max-h-96 overflow-y-auto">
                                <div className="p-2 bg-blue-50 text-blue-800 text-xs font-bold text-center border-b">
                                    {manualResults.length} resultados encontrados
                                </div>
                                {manualResults.map(p => (
                                    <div key={p.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 animate-fade-in group items-start">
                                        <div className="w-12 h-12 bg-gray-100 rounded shrink-0 flex items-center justify-center overflow-hidden">
                                            {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-gray-300" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-sm text-gray-800">{p.nombre}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-green-600">$ {p.precio}</span>
                                                    <button
                                                        onClick={() => addAllToCart(p)}
                                                        className="flex items-center bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors font-bold uppercase tracking-wide"
                                                    >
                                                        <Layers size={12} className="mr-1" /> Todo
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {p.variantes.map(v => (
                                                    <button
                                                        key={v.id_variante}
                                                        onClick={() => addToCart(p, v)}
                                                        className="text-xs px-2 py-1 rounded border hover:bg-gray-800 hover:text-white border-gray-200 text-gray-600 transition-colors"
                                                    >
                                                        {v.talle}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de Items */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="p-4 bg-gray-50 border-b font-bold text-gray-500 uppercase text-xs flex justify-between items-center">
                        <span>Items en Presupuesto ({cart.length})</span>
                        {cart.length > 0 && (
                            <button onClick={clearDraft} className="text-red-500 hover:text-red-700 flex items-center text-[10px] font-bold bg-red-50 px-2 py-1 rounded">
                                <Trash2 size={12} className="mr-1" /> LIMPIAR BORRADOR
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                <ShoppingCart size={48} className="mb-2 opacity-20" />
                                <p>El borrador está vacío.</p>
                                <p className="text-xs">Los productos que agregues se guardarán automáticamente.</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id_variante} className="flex justify-between items-center bg-white border p-3 rounded-lg shadow-sm hover:border-blue-200 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                        <p className="text-xs text-gray-500">Talle: <b className="text-gray-800">{item.talle}</b> | Unit: ${item.precio}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-gray-100 rounded-lg">
                                            <button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1 hover:bg-gray-200 rounded-l text-gray-600"><Minus size={14} /></button>
                                            <span className="w-8 text-center font-bold text-sm">{item.cantidad}</span>
                                            <button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1 hover:bg-gray-200 rounded-r text-gray-600"><Plus size={14} /></button>
                                        </div>
                                        <span className="font-bold w-20 text-right text-gray-800">${item.subtotal.toLocaleString()}</span>
                                        <button onClick={() => removeFromCart(item.id_variante)} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* DERECHA: Configuración Presupuesto */}
            <div className="w-full md:w-1/3 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                <div className="bg-slate-800 text-white p-4">
                    <h3 className="font-bold text-lg flex items-center"><Calculator className="mr-2" /> Configuración</h3>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    {/* Cliente */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente / Empresa</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                value={clientName}
                                onChange={e => setClientName(e.target.value)}
                                placeholder="Nombre del cliente..."
                                className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700"
                            />
                        </div>
                    </div>

                    {/* Descuento */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex justify-between">
                            <span>Descuento Global</span>
                            <span className="text-blue-600 font-bold">{discountPercent}% OFF</span>
                        </label>
                        <input
                            type="range" min="0" max="50" step="5"
                            value={discountPercent}
                            onChange={e => setDiscountPercent(parseInt(e.target.value))}
                            className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1 font-bold">
                            <span>0%</span><span>25%</span><span>50%</span>
                        </div>
                    </div>

                    <hr className="border-dashed" />

                    {/* Totales */}
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex justify-between text-gray-600 text-sm">
                            <span>Subtotal</span>
                            <span>$ {subtotal.toLocaleString()}</span>
                        </div>
                        {discountPercent > 0 && (
                            <div className="flex justify-between text-green-600 font-bold text-sm">
                                <span>Descuento ({discountPercent}%)</span>
                                <span>- $ {discountAmount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-3xl font-black text-slate-800 pt-2 border-t border-gray-200">
                            <span>Total</span>
                            <span>$ {total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-white border-t">
                    <button
                        onClick={handleSaveBudget}
                        disabled={cart.length === 0 || !clientName}
                        className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {cart.length > 0 && clientName ? (
                            <><Printer className="mr-2 group-hover:scale-110 transition-transform" /> Guardar e Imprimir</>
                        ) : (
                            "Completa los datos..."
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BudgetPage;