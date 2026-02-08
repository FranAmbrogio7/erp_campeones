import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ArrowRightLeft, Ticket, CheckCircle, RefreshCcw, Printer,
    ArrowLeft, Trash2, Calculator, Search, X, Plus, Shirt,
    PackagePlus, PackageMinus, ArrowRight, FileCheck,
    Banknote, CreditCard, Smartphone, Maximize2 // <--- Agregado Maximize2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CreditNoteTicket from '../components/CreditNoteTicket';

const SOUNDS = {
    beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3'),
    click: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3'),
    success: new Audio('https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3')
};

const ReturnsPage = () => {
    const { token } = useAuth();

    // --- ESTADOS CON LOCALSTORAGE ---
    const [itemsIn, setItemsIn] = useState(() => {
        const saved = localStorage.getItem('returns_in');
        return saved ? JSON.parse(saved) : [];
    });

    const [itemsOut, setItemsOut] = useState(() => {
        const saved = localStorage.getItem('returns_out');
        return saved ? JSON.parse(saved) : [];
    });

    // --- GUARDAR EN LOCALSTORAGE CUANDO CAMBIAN ---
    useEffect(() => {
        localStorage.setItem('returns_in', JSON.stringify(itemsIn));
    }, [itemsIn]);

    useEffect(() => {
        localStorage.setItem('returns_out', JSON.stringify(itemsOut));
    }, [itemsOut]);

    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

    const [termIn, setTermIn] = useState('');
    const [resultsIn, setResultsIn] = useState([]);
    const [termOut, setTermOut] = useState('');
    const [resultsOut, setResultsOut] = useState([]);

    const [transactionResult, setTransactionResult] = useState(null);
    const [zoomImage, setZoomImage] = useState(null); // <--- Estado para Zoom

    const inputInRef = useRef(null);
    const inputOutRef = useRef(null);
    const ticketRef = useRef(null);

    const reactToPrintFn = useReactToPrint({
        contentRef: ticketRef,
        documentTitle: `Nota_Credito_${transactionResult?.nota?.codigo || 'NC'}`,
    });

    const playSound = (type) => {
        try {
            if (SOUNDS[type]) {
                SOUNDS[type].currentTime = 0;
                SOUNDS[type].volume = type === 'click' ? 0.2 : 0.4;
                SOUNDS[type].play();
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const fetchMethods = async () => {
            try {
                const res = await api.get('/sales/payment-methods');
                setPaymentMethods(res.data);
            } catch (e) { console.error("Error cargando pagos", e); }
        };
        if (token) fetchMethods();
    }, [token]);

    // Búsquedas
    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termIn.trim()) { setResultsIn([]); return; }
            try {
                const res = await api.get('/products', { params: { search: termIn, limit: 20 } });
                setResultsIn(res.data.products || []);
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termIn]);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termOut.trim()) { setResultsOut([]); return; }
            try {
                const res = await api.get('/products', { params: { search: termOut, limit: 20 } });
                setResultsOut(res.data.products || []);
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termOut]);

    // --- ACCIONES ---
    const addManualItem = (product, variant, type) => {
        const item = {
            id: product.id, id_variante: variant.id_variante, uid: Date.now() + Math.random(),
            sku: variant.sku, nombre: product.nombre, talle: variant.talle,
            precio: product.precio, stock_actual: variant.stock, imagen: product.imagen
        };

        if (type === 'IN') {
            setItemsIn(prev => [...prev, item]); setTermIn(''); setResultsIn([]);
            inputInRef.current?.focus();
        } else {
            if (item.stock_actual <= 0) { playSound('error'); toast.error("Sin stock físico"); return; }
            setItemsOut(prev => [...prev, item]);
            inputOutRef.current?.focus();
        }
        playSound('click');
    };

    const handleScan = async (e, type) => {
        e.preventDefault();
        const term = type === 'IN' ? termIn : termOut;
        if (!term.trim()) return;

        try {
            const res = await api.get(`/sales/scan/${term}`);
            if (res.data.found) {
                const prod = res.data.product;
                const item = { ...prod, uid: Date.now() };

                if (type === 'IN') {
                    setItemsIn(prev => [...prev, item]); setTermIn(''); setResultsIn([]);
                    toast.success("Devolución escaneada");
                } else {
                    if (prod.stock_actual <= 0) { playSound('error'); toast.error("¡Sin stock!"); return; }
                    setItemsOut(prev => [...prev, item]); setTermOut(''); setResultsOut([]);
                    toast.success("Entrega escaneada");
                }
                playSound('beep');
            }
        } catch (error) { console.error(error); }
    };

    const removeItemIn = (uid) => setItemsIn(prev => prev.filter(i => i.uid !== uid));
    const removeItemOut = (uid) => setItemsOut(prev => prev.filter(i => i.uid !== uid));

    const totalIn = itemsIn.reduce((acc, i) => acc + i.precio, 0);
    const totalOut = itemsOut.reduce((acc, i) => acc + i.precio, 0);
    const balance = totalOut - totalIn;

    const getPaymentIcon = (n) => {
        const name = n.toLowerCase();
        if (name.includes('tarjeta')) return <CreditCard size={16} />;
        if (name.includes('transferencia')) return <Smartphone size={16} />;
        return <Banknote size={16} />;
    };

    const handleProcess = async () => {
        if (itemsIn.length === 0 && itemsOut.length === 0) return;
        if (balance > 0 && !selectedPaymentMethod) { playSound('error'); toast.error("⚠️ Selecciona un Método de Pago."); return; }
        if (!window.confirm("¿Confirmar operación?")) return;

        const toastId = toast.loading("Procesando transacción...");
        try {
            const res = await api.post('/returns/process', {
                items_in: itemsIn,
                items_out: itemsOut,
                metodo_pago_id: balance > 0 ? selectedPaymentMethod.id : null,
                diferencia_pago: balance > 0 ? balance : 0,
                // --- ARREGLO DE HORA: Enviamos fecha local para evitar desfase ---
                fecha_local: new Date().toISOString()
            });

            setTransactionResult({
                nota: res.data.nota_credito || null,
                itemsEntraron: [...itemsIn], itemsSalieron: [...itemsOut],
                balance: balance
            });

            // Limpiar estados y LocalStorage
            setItemsIn([]); setItemsOut([]); setSelectedPaymentMethod(null);
            localStorage.removeItem('returns_in');
            localStorage.removeItem('returns_out');

            playSound('success'); toast.success("¡Movimiento registrado!", { id: toastId });
        } catch (e) { playSound('error'); toast.error(e.response?.data?.msg || "Error", { id: toastId }); }
    };

    // Componente Dropdown interno
    const SearchResultsDropdown = ({ results, type }) => {
        if (results.length === 0) return null;
        return (
            <div className={`absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-xl border rounded-b-xl mt-1 max-h-80 overflow-y-auto z-50 ${type === 'IN' ? 'border-red-200 dark:border-red-900' : 'border-green-200 dark:border-green-900'}`}>
                {results.map(prod => (
                    <div key={prod.id} className="p-3 border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex gap-3 items-start animate-fade-in cursor-pointer group">
                        <div
                            className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded shrink-0 overflow-hidden border dark:border-slate-600 relative"
                            onClick={(e) => { e.stopPropagation(); if (prod.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${prod.imagen}`); }}
                        >
                            {prod.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" /> : <Shirt className="text-gray-300 dark:text-slate-500 w-full h-full p-2" />}
                            {prod.imagen && <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center"><Maximize2 size={12} className="text-white" /></div>}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-700 dark:text-white leading-tight">{prod.nombre}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${type === 'IN' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>${prod.precio}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {prod.variantes.map(v => (
                                    <button key={v.id_variante} onClick={(e) => { e.stopPropagation(); addManualItem(prod, v, type) }} className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${type === 'IN' ? 'border-red-100 dark:border-red-800 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300' : (v.stock > 0 ? 'border-green-100 dark:border-green-800 hover:bg-green-500 hover:text-white text-gray-600 dark:text-gray-300' : 'border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-gray-300 dark:text-slate-500 cursor-not-allowed')}`} disabled={type === 'OUT' && v.stock <= 0}>
                                        <span className="font-bold">{v.talle}</span>
                                        {type === 'OUT' && v.stock <= 0 && <X size={8} />}
                                        {type === 'IN' && <Plus size={8} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        // LAYOUT FIX: Usamos h-[calc(100vh-4rem)] y overflow-hidden para ajustar a la pantalla
        <div className="p-4 h-[calc(100vh-4rem)] flex flex-col max-w-[1600px] mx-auto gap-4 bg-gray-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
            <Toaster position="top-center" />

            {/* MODAL ZOOM */}
            {zoomImage && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-zoom-in" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button>
                </div>
            )}

            {/* MODAL RESULTADO */}
            {transactionResult && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                        <div className="bg-green-600 p-6 text-white text-center shrink-0">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md"><CheckCircle size={32} /></div>
                            <h2 className="text-2xl font-black uppercase tracking-wide">Movimiento Exitoso</h2>
                            <p className="text-green-100 text-sm font-medium">Stock y caja actualizados.</p>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-slate-900">
                            {transactionResult.nota ? (
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm mb-6 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-500"></div>
                                    <div><p className="text-xs font-bold text-gray-400 uppercase">Nota de Crédito</p><p className="text-xl font-black text-gray-800 dark:text-white font-mono">{transactionResult.nota.codigo}</p></div>
                                    <div className="text-right"><p className="text-xs font-bold text-gray-400 uppercase">Saldo a Favor</p><p className="text-xl font-black text-blue-600 dark:text-blue-400">$ {transactionResult.nota.monto.toLocaleString()}</p></div>
                                    <div style={{ display: 'none' }}><div ref={ticketRef}><CreditNoteTicket data={transactionResult.nota} /></div></div>
                                </div>
                            ) : (
                                transactionResult.balance > 0 ? (
                                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800 text-center mb-6">
                                        <p className="text-green-800 dark:text-green-400 font-bold text-lg">✅ Venta registrada por diferencia: ${transactionResult.balance.toLocaleString()}</p>
                                    </div>
                                ) : (
                                    <div className="bg-gray-100 dark:bg-slate-800 p-3 rounded-lg text-center text-gray-500 dark:text-gray-400 text-sm font-bold mb-6">⚖️ Cambio sin diferencia económica</div>
                                )
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-green-100 dark:border-green-900 shadow-sm overflow-hidden">
                                    <div className="bg-green-50 dark:bg-green-900/30 p-2 border-b border-green-100 dark:border-green-800 flex items-center justify-center text-green-700 dark:text-green-400 font-bold text-xs uppercase"><PackagePlus size={14} className="mr-2" /> Ingresó al Stock (+1)</div>
                                    <div className="p-2 space-y-2 max-h-40 overflow-y-auto">{transactionResult.itemsEntraron.map(i => (<div key={i.uid} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700"><div className="w-8 h-8 bg-white dark:bg-slate-600 rounded border dark:border-slate-500 flex items-center justify-center shrink-0">{i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={12} className="text-gray-300 dark:text-slate-400" />}</div><div className="min-w-0"><p className="text-xs font-bold text-gray-700 dark:text-white truncate">{i.nombre}</p><p className="text-[10px] text-gray-500 dark:text-gray-400">Talle: {i.talle}</p></div></div>))}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900 shadow-sm overflow-hidden">
                                    <div className="bg-red-50 dark:bg-red-900/30 p-2 border-b border-red-100 dark:border-red-800 flex items-center justify-center text-red-700 dark:text-red-400 font-bold text-xs uppercase"><PackageMinus size={14} className="mr-2" /> Salió del Stock (-1)</div>
                                    <div className="p-2 space-y-2 max-h-40 overflow-y-auto">{transactionResult.itemsSalieron.map(i => (<div key={i.uid} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700"><div className="w-8 h-8 bg-white dark:bg-slate-600 rounded border dark:border-slate-500 flex items-center justify-center shrink-0">{i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={12} className="text-gray-300 dark:text-slate-400" />}</div><div className="min-w-0"><p className="text-xs font-bold text-gray-700 dark:text-white truncate">{i.nombre}</p><p className="text-[10px] text-gray-500 dark:text-gray-400">Talle: {i.talle}</p></div></div>))}</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex gap-3">
                            {transactionResult.nota && <button onClick={reactToPrintFn} className="flex-1 bg-slate-800 dark:bg-slate-700 text-white py-3 rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center justify-center shadow-lg"><Printer size={18} className="mr-2" /> Imprimir Nota</button>}
                            <button onClick={() => setTransactionResult(null)} className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-white py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600">Cerrar y Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center mb-2 shrink-0">
                <div><h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center"><RefreshCcw className="mr-3 text-blue-600 dark:text-blue-400" /> Centro de Cambios</h1><p className="text-sm text-gray-500 dark:text-gray-400">Gestión de devoluciones y garantías.</p></div>
                {(itemsIn.length > 0 || itemsOut.length > 0) && <button onClick={() => { if (window.confirm("¿Borrar todo?")) { setItemsIn([]); setItemsOut([]); localStorage.removeItem('returns_in'); localStorage.removeItem('returns_out'); setSelectedPaymentMethod(null); } }} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg border border-red-100 dark:border-red-900 transition-colors">Reiniciar</button>}
            </div>

            {/* WORKSPACE - LAYOUT MEJORADO (min-h-0 para que el flex interno scrollee) */}
            <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden min-h-0">

                {/* IZQUIERDA: ENTRA (ROJO) */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-100 dark:border-red-900 overflow-hidden relative z-20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 rounded-t-2xl"></div>
                    <div className="p-4 bg-red-50/50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/30">
                        <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center mb-3 text-sm uppercase tracking-wide"><ArrowLeft className="mr-2" size={18} /> Cliente Entrega (Devolución)</h3>
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'IN')}>
                                <input ref={inputInRef} value={termIn} onChange={e => setTermIn(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-red-100 dark:border-red-900/50 bg-white dark:bg-slate-900 text-gray-700 dark:text-white focus:border-red-400 dark:focus:border-red-500 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20 outline-none transition-all font-bold placeholder-red-300 dark:placeholder-red-800 text-sm" placeholder="Escanear..." autoFocus />
                                <Search className="absolute left-3 top-3 text-red-300 dark:text-red-700" size={16} />
                            </form>
                            <SearchResultsDropdown results={resultsIn} type="IN" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30 dark:bg-slate-900/30 custom-scrollbar">
                        {itemsIn.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-red-200 dark:text-red-900/50 opacity-60"><ArrowLeft size={48} className="mb-2" /><p className="font-bold text-sm">Escanea producto devuelto</p></div> : itemsIn.map((item) => (
                            <div key={item.uid} className="bg-white dark:bg-slate-700 p-3 rounded-xl shadow-sm border border-red-100 dark:border-red-900/30 flex justify-between items-center animate-fade-in-left group">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded border dark:border-slate-500 shrink-0 overflow-hidden cursor-zoom-in relative"
                                        onClick={() => item.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${item.imagen}`)}
                                    >
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={16} className="text-gray-300 dark:text-slate-400 m-auto mt-2" />}
                                        {item.imagen && <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center"><Maximize2 size={12} className="text-white" /></div>}
                                    </div>
                                    <div><p className="font-bold text-gray-800 dark:text-white text-sm leading-tight">{item.nombre}</p><p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-red-50 dark:bg-red-900/30 inline px-1.5 py-0.5 rounded mt-1">Talle: {item.talle}</p></div>
                                </div>
                                <div className="flex items-center gap-3"><span className="font-bold text-red-600 dark:text-red-400 text-sm">$ {item.precio.toLocaleString()}</span><button onClick={() => removeItemIn(item.uid)} className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={16} /></button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t border-red-100 dark:border-red-900/30 bg-white dark:bg-slate-800 flex justify-between items-center rounded-b-2xl"><span className="text-xs font-bold text-red-400 uppercase">Total Devolución</span><span className="text-xl font-black text-red-600 dark:text-red-400">$ {totalIn.toLocaleString()}</span></div>
                </div>

                {/* CENTRO: BALANCE Y PAGOS */}
                <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 z-0 h-full">
                    <div className="bg-slate-900 dark:bg-black text-white p-5 rounded-2xl shadow-xl flex flex-col justify-between flex-1 relative overflow-hidden border border-slate-800 h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Calculator size={100} /></div>

                        {/* Contenido scrolleable del panel central */}
                        <div className="relative z-10 overflow-y-auto flex-1 custom-scrollbar pr-1">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 border-b border-slate-700 pb-2">Balance</h3>
                            <div className="flex justify-between items-end mb-2"><span className="text-sm text-slate-300">Nuevo</span><span className="font-mono font-bold text-green-400 text-lg">+ {totalOut.toLocaleString()}</span></div>
                            <div className="flex justify-between items-end mb-4"><span className="text-sm text-slate-300">Devolución</span><span className="font-mono font-bold text-red-400 text-lg">- {totalIn.toLocaleString()}</span></div>
                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center mb-4">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Diferencia Final</p>
                                <p className={`text-3xl font-black tracking-tighter ${balance < 0 ? 'text-blue-400' : 'text-white'}`}>$ {Math.abs(balance).toLocaleString()}</p>
                                <p className={`text-xs font-bold mt-1 ${balance > 0 ? 'text-green-500' : balance < 0 ? 'text-blue-400' : 'text-slate-500'}`}>{balance > 0 ? "Cliente Paga" : balance < 0 ? "Saldo a Favor" : "Mano a Mano"}</p>
                            </div>
                            {balance > 0 && (
                                <div className="animate-fade-in pb-4">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Método de Pago</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {paymentMethods.map(m => (
                                            <button key={m.id} onClick={() => setSelectedPaymentMethod(m)} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${selectedPaymentMethod?.id === m.id ? 'bg-green-500 border-green-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                                {getPaymentIcon(m.nombre)}<span className="text-[9px] font-bold mt-1 uppercase">{m.nombre.slice(0, 8)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleProcess} disabled={itemsIn.length === 0 && itemsOut.length === 0} className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center relative z-10 mt-4 shrink-0 ${itemsIn.length === 0 && itemsOut.length === 0 ? 'bg-gray-700 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}><FileCheck size={18} className="mr-2" /> CONFIRMAR</button>
                    </div>
                </div>

                {/* DERECHA: SALE (VERDE) */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-green-100 dark:border-green-900 overflow-hidden relative z-20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500 rounded-t-2xl"></div>
                    <div className="p-4 bg-green-50/50 dark:bg-green-900/10 border-b border-green-100 dark:border-green-900/30">
                        <h3 className="font-bold text-green-800 dark:text-green-300 flex items-center mb-3 text-sm uppercase tracking-wide"><ArrowRight className="mr-2" size={18} /> Cliente Lleva (Nuevo)</h3>
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'OUT')}>
                                <input ref={inputOutRef} value={termOut} onChange={e => setTermOut(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-green-100 dark:border-green-900/50 bg-white dark:bg-slate-900 text-gray-700 dark:text-white focus:border-green-400 dark:focus:border-green-500 focus:ring-4 focus:ring-green-50 dark:focus:ring-green-900/20 outline-none transition-all font-bold text-gray-700 placeholder-green-300 dark:placeholder-green-800 text-sm" placeholder="Escanear..." />
                                <Search className="absolute left-3 top-3 text-green-300 dark:text-green-700" size={16} />
                            </form>
                            <SearchResultsDropdown results={resultsOut} type="OUT" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30 dark:bg-slate-900/30 custom-scrollbar">
                        {itemsOut.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-green-200 dark:text-green-900/50 opacity-60"><ArrowRight size={48} className="mb-2" /><p className="font-bold text-sm">Escanea producto nuevo</p></div> : itemsOut.map((item) => (
                            <div key={item.uid} className="bg-white dark:bg-slate-700 p-3 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30 flex justify-between items-center animate-fade-in-right group">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded border dark:border-slate-500 shrink-0 overflow-hidden cursor-zoom-in relative"
                                        onClick={() => item.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${item.imagen}`)}
                                    >
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={16} className="text-gray-300 dark:text-slate-400 m-auto mt-2" />}
                                        {item.imagen && <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center"><Maximize2 size={12} className="text-white" /></div>}
                                    </div>
                                    <div><p className="font-bold text-gray-800 dark:text-white text-sm leading-tight">{item.nombre}</p><p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-green-50 dark:bg-green-900/30 inline px-1.5 py-0.5 rounded mt-1">Talle: {item.talle}</p></div>
                                </div>
                                <div className="flex items-center gap-3"><span className="font-bold text-green-600 dark:text-green-400 text-sm">$ {item.precio.toLocaleString()}</span><button onClick={() => removeItemOut(item.uid)} className="text-gray-300 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"><Trash2 size={16} /></button></div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t border-green-100 dark:border-green-900/30 bg-white dark:bg-slate-800 flex justify-between items-center rounded-b-2xl"><span className="text-xs font-bold text-green-400 uppercase">Total Nuevos</span><span className="text-xl font-black text-green-600 dark:text-green-400">$ {totalOut.toLocaleString()}</span></div>
                </div>
            </div>
        </div>
    );
};

export default ReturnsPage;