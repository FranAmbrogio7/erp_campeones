import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ArrowRightLeft, Ticket, CheckCircle, RefreshCcw, Printer,
    ArrowLeft, Trash2, Calculator, Search, X, Plus, Shirt,
    PackagePlus, PackageMinus, ArrowRight, FileCheck,
    Banknote, CreditCard, Smartphone, Maximize2, FilterX,
    TrendingUp, TrendingDown, Lock
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

// =========================================================================
// SUB-COMPONENTE: Modal Seleccionador de Variante
// =========================================================================
const VariantSelectionModal = ({ data, onClose, onSelect }) => {
    if (!data) return null;
    const { product, type } = data;

    const groupedVariants = product.variantes.reduce((acc, v) => {
        if (!acc[v.talle]) acc[v.talle] = [];
        const estampaName = (!v.estampa || v.estampa === 'Standard') ? 'Sin Estampa' : v.estampa;
        acc[v.talle].push({ ...v, estampaName });
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                
                <div className={`p-6 border-b flex justify-between items-center shrink-0 ${type === 'IN' ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/50' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/50'}`}>
                    <div>
                        <h3 className={`font-black text-2xl flex items-center tracking-tight ${type === 'IN' ? 'text-red-800 dark:text-red-400' : 'text-emerald-800 dark:text-emerald-400'}`}>
                            <Shirt className={`mr-3 ${type === 'IN' ? 'text-red-500' : 'text-emerald-500'}`} size={28}/> 
                            {type === 'IN' ? 'Recibir Variante' : 'Entregar Variante'}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 font-bold">{product.nombre}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-200 dark:border-slate-700 transition-colors active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-900">
                    <div className="space-y-6">
                        {Object.keys(groupedVariants).map(talle => {
                            const detalles = groupedVariants[talle].sort((a, b) => 
                                a.estampaName === 'Sin Estampa' ? -1 : b.estampaName === 'Sin Estampa' ? 1 : 0
                            );

                            return (
                                <div key={talle} className="bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                                    <h4 className="font-black text-lg text-slate-800 dark:text-white mb-4 flex items-center border-b border-slate-100 dark:border-slate-700 pb-3">
                                        Talle {talle}
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {detalles.map(det => {
                                            const isAvailable = type === 'IN' ? true : det.stock > 0;
                                            
                                            return (
                                                <button
                                                    key={det.id_variante}
                                                    disabled={!isAvailable}
                                                    onClick={() => onSelect(product, det, type)}
                                                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 text-center
                                                        ${isAvailable 
                                                            ? (type === 'IN' 
                                                                ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/20 hover:bg-red-100 hover:border-red-400 dark:hover:bg-red-900/50 cursor-pointer' 
                                                                : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100 hover:border-emerald-400 dark:hover:bg-emerald-900/50 cursor-pointer') 
                                                            : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 opacity-50 cursor-not-allowed grayscale'}`}
                                                >
                                                    <span className={`font-black text-sm mb-1.5 ${isAvailable ? (type === 'IN' ? 'text-red-900 dark:text-red-100' : 'text-emerald-900 dark:text-emerald-100') : 'text-slate-500'}`}>
                                                        {det.estampaName}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${det.stock > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'}`}>
                                                        Stock: {det.stock}
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

// =========================================================================
// PÁGINA PRINCIPAL
// =========================================================================
const ReturnsPage = () => {
    const { token } = useAuth();

    // --- ESTADO DE CAJA ---
    const [isRegisterOpen, setIsRegisterOpen] = useState(null);

    const [itemsIn, setItemsIn] = useState(() => {
        const saved = localStorage.getItem('returns_in');
        return saved ? JSON.parse(saved) : [];
    });

    const [itemsOut, setItemsOut] = useState(() => {
        const saved = localStorage.getItem('returns_out');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => { localStorage.setItem('returns_in', JSON.stringify(itemsIn)); }, [itemsIn]);
    useEffect(() => { localStorage.setItem('returns_out', JSON.stringify(itemsOut)); }, [itemsOut]);

    const [categories, setCategories] = useState([]);
    const [selectedCat, setSelectedCat] = useState('');
    const [sortBy, setSortBy] = useState('mas_vendidos');
    const [activeSearchSide, setActiveSearchSide] = useState(null); 

    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

    const [surchargePercent, setSurchargePercent] = useState(0);
    const [discountPercent, setDiscountPercent] = useState(0);

    const [termIn, setTermIn] = useState('');
    const [resultsIn, setResultsIn] = useState([]);
    const [showDropdownIn, setShowDropdownIn] = useState(false);

    const [termOut, setTermOut] = useState('');
    const [resultsOut, setResultsOut] = useState([]);
    const [showDropdownOut, setShowDropdownOut] = useState(false);

    const [variantModalData, setVariantModalData] = useState(null);
    const [transactionResult, setTransactionResult] = useState(null);
    const [zoomImage, setZoomImage] = useState(null);

    const inputInRef = useRef(null);
    const inputOutRef = useRef(null);
    const containerInRef = useRef(null);
    const containerOutRef = useRef(null);
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
        const fetchInitialData = async () => {
            try {
                const [resStatus, resMethods, resCats] = await Promise.all([
                    api.get('/sales/caja/status'),
                    api.get('/sales/payment-methods'),
                    api.get('/products/categories')
                ]);
                setIsRegisterOpen(resStatus.data.estado === 'abierta');
                setPaymentMethods(resMethods.data);
                setCategories(resCats.data);
            } catch (e) { console.error("Error cargando datos iniciales", e); }
        };
        if (token) fetchInitialData();
    }, [token]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerInRef.current && !containerInRef.current.contains(e.target)) setShowDropdownIn(false);
            if (containerOutRef.current && !containerOutRef.current.contains(e.target)) setShowDropdownOut(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (activeSearchSide === 'IN') {
                if (!termIn.trim() && !selectedCat) { setResultsIn([]); setShowDropdownIn(false); return; }
                try {
                    const res = await api.get('/products', { params: { search: termIn, category_id: selectedCat, sort_by: sortBy, limit: 50 } });
                    setResultsIn(res.data.products || []);
                    setShowDropdownIn(true);
                } catch (e) { console.error(e); }
            } else if (activeSearchSide === 'OUT') {
                if (!termOut.trim() && !selectedCat) { setResultsOut([]); setShowDropdownOut(false); return; }
                try {
                    const res = await api.get('/products', { params: { search: termOut, category_id: selectedCat, sort_by: sortBy, limit: 50 } });
                    setResultsOut(res.data.products || []);
                    setShowDropdownOut(true);
                } catch (e) { console.error(e); }
            }
        }, 300);
        return () => clearTimeout(delay);
    }, [termIn, termOut, selectedCat, sortBy, activeSearchSide]);

    const handleProductSelectClick = (product, type) => {
        if (product.variantes.length === 1) {
            const v = product.variantes[0];
            if (type === 'IN' || (type === 'OUT' && v.stock > 0)) {
                addManualItem(product, v, type);
                if(type === 'IN') setShowDropdownIn(false);
                if(type === 'OUT') setShowDropdownOut(false);
                return;
            }
        }
        setVariantModalData({ product, type });
        if(type === 'IN') setShowDropdownIn(false);
        if(type === 'OUT') setShowDropdownOut(false);
    };

    const addManualItem = (product, variant, type) => {
        const item = {
            id: product.id, id_variante: variant.id_variante, uid: Date.now() + Math.random(),
            sku: variant.sku, nombre: product.nombre, talle: variant.talle, estampa: variant.estampa,
            precio: product.precio, stock_actual: variant.stock, imagen: product.imagen
        };

        if (type === 'IN') {
            setItemsIn(prev => [...prev, item]);
            setVariantModalData(null);
            setTermIn('');
            setTimeout(() => inputInRef.current?.focus(), 100);
        } else {
            if (item.stock_actual <= 0) { playSound('error'); toast.error("Sin stock físico"); return; }
            setItemsOut(prev => [...prev, item]);
            setVariantModalData(null);
            setTermOut('');
            setTimeout(() => inputOutRef.current?.focus(), 100);
        }
        playSound('click');
        toast.success(`Agregado a ${type === 'IN' ? 'Devolución' : 'Nuevo'}`);
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
                    setItemsIn(prev => [...prev, item]); setTermIn(''); setResultsIn([]); setShowDropdownIn(false);
                    toast.success("Devolución escaneada");
                } else {
                    if (prod.stock_actual <= 0) { playSound('error'); toast.error("¡Sin stock!"); return; }
                    setItemsOut(prev => [...prev, item]); setTermOut(''); setResultsOut([]); setShowDropdownOut(false);
                    toast.success("Entrega escaneada");
                }
                playSound('beep');
            }
        } catch (error) { playSound('error'); toast.error("Producto NO encontrado"); }
    };

    const removeItemIn = (uid) => setItemsIn(prev => prev.filter(i => i.uid !== uid));
    const removeItemOut = (uid) => setItemsOut(prev => prev.filter(i => i.uid !== uid));

    // --- CALCULOS MATEMÁTICOS ---
    const totalIn = itemsIn.reduce((acc, i) => acc + i.precio, 0);
    const rawTotalOut = itemsOut.reduce((acc, i) => acc + i.precio, 0);
    
    const surchargeAmount = rawTotalOut * (surchargePercent / 100);
    const discountAmount = rawTotalOut * (discountPercent / 100);
    
    const totalOutAdjusted = rawTotalOut + surchargeAmount - discountAmount;
    const balance = totalOutAdjusted - totalIn;

    const getPaymentIcon = (n) => {
        const name = n.toLowerCase();
        if (name.includes('tarjeta')) return <CreditCard size={18} />;
        if (name.includes('transferencia')) return <Smartphone size={18} />;
        return <Banknote size={18} />;
    };

    const handleProcess = async () => {
        if (itemsIn.length === 0 && itemsOut.length === 0) return;
        if (balance > 0 && !selectedPaymentMethod) { playSound('error'); toast.error("⚠️ Selecciona un Método de Pago."); return; }
        if (!window.confirm("¿Confirmar operación?")) return;

        const toastId = toast.loading("Procesando transacción...");
        try {
            const multiplier = 1 + (surchargePercent / 100) - (discountPercent / 100);
            const itemsOutToSubmit = itemsOut.map(item => ({
                ...item,
                precio: item.precio * multiplier
            }));

            const res = await api.post('/returns/process', {
                items_in: itemsIn,
                items_out: itemsOutToSubmit,
                metodo_pago_id: balance > 0 ? selectedPaymentMethod.id : null,
                diferencia_pago: balance > 0 ? balance : 0,
                fecha_local: new Date().toISOString()
            });

            setTransactionResult({
                nota: res.data.nota_credito || null,
                itemsEntraron: [...itemsIn], itemsSalieron: [...itemsOut],
                balance: balance
            });

            setItemsIn([]); setItemsOut([]); setSelectedPaymentMethod(null); setTermIn(''); setTermOut('');
            setSurchargePercent(0); setDiscountPercent(0);
            localStorage.removeItem('returns_in'); localStorage.removeItem('returns_out');

            playSound('success'); toast.success("¡Movimiento registrado!", { id: toastId });
        } catch (e) { playSound('error'); toast.error(e.response?.data?.msg || "Error", { id: toastId }); }
    };

    const SearchResultsDropdown = ({ results, type, show }) => {
        if (!show || results.length === 0) return null;
        return (
            <div className={`absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-2xl border rounded-b-2xl mt-1 max-h-[50vh] overflow-y-auto z-[100] custom-scrollbar ${type === 'IN' ? 'border-red-200 dark:border-red-900/50' : 'border-emerald-200 dark:border-emerald-900/50'}`}>
                {results.map(prod => {
                    const tallesDisponibles = Array.from(new Set(prod.variantes.filter(v => type === 'IN' || v.stock > 0).map(v => v.talle)));

                    return (
                        <div key={prod.id} className="p-4 border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/80 flex gap-4 cursor-pointer group transition-colors" onClick={() => handleProductSelectClick(prod, type)}>
                            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-xl shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 relative flex items-center justify-center cursor-zoom-in" onClick={(e) => { e.stopPropagation(); if (prod.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${prod.imagen}`); }}>
                                {prod.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" /> : <Shirt className="text-slate-300 dark:text-slate-500 w-full h-full p-2" />}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{prod.nombre}</span>
                                    <span className={`text-xs font-black px-2 py-0.5 rounded-md ${type === 'IN' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>${prod.precio.toLocaleString()}</span>
                                </div>
                                <div className={`mt-2 flex items-center justify-between p-2 rounded-lg border transition-colors ${type === 'IN' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 group-hover:bg-red-100 dark:group-hover:bg-red-900/40' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40'}`}>
                                    <div className="flex flex-wrap gap-1">
                                        {tallesDisponibles.length > 0 ? tallesDisponibles.map(t => (
                                            <span key={t} className={`text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border bg-white dark:bg-slate-800 ${type === 'IN' ? 'text-red-700 dark:text-red-400 border-red-100 dark:border-slate-600' : 'text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-slate-600'}`}>
                                                {t}
                                            </span>
                                        )) : (
                                            <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">SIN STOCK</span>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-black flex items-center ${type === 'IN' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        Elegir Variante <ArrowRight size={12} className="ml-1" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // PROTECCIÓN: SI LA CAJA ESTÁ CERRADA
    if (isRegisterOpen === false) {
        return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-md w-full animate-fade-in-up">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
                        <Lock size={36} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Caja Cerrada</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm font-medium leading-relaxed">
                        Para procesar devoluciones o gestionar saldos a favor necesitas iniciar un turno operativo.
                    </p>
                    <Link to="/caja-control" className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-500/30 transition-all active:scale-95 uppercase tracking-widest text-sm">
                        Ir a Control de Caja
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-5 max-w-[1600px] mx-auto gap-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative font-sans">
            <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', fontWeight: 'bold' } }} />

            {/* MODALES */}
            <VariantSelectionModal data={variantModalData} onClose={() => setVariantModalData(null)} onSelect={addManualItem} />

            {zoomImage && (
                <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-zoom-in" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"><X size={28} /></button>
                </div>
            )}

            {transactionResult && (
                <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-800">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 text-white text-center shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10"></div>
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-5 backdrop-blur-md shadow-inner"><CheckCircle size={40} /></div>
                            <h2 className="text-3xl font-black uppercase tracking-widest mb-1">Operación Exitosa</h2>
                            <p className="text-emerald-100 text-sm font-bold tracking-wide">Stock y caja actualizados en tiempo real.</p>
                        </div>
                        
                        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
                            {transactionResult.nota ? (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/50 shadow-sm mb-6 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute left-0 top-0 w-2 h-full bg-indigo-500"></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nota de Crédito</p><p className="text-2xl font-black text-slate-800 dark:text-white font-mono">{transactionResult.nota.codigo}</p></div>
                                    <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo a Favor</p><p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">$ {transactionResult.nota.monto.toLocaleString()}</p></div>
                                    <div style={{ display: 'none' }}><div ref={ticketRef}><CreditNoteTicket data={transactionResult.nota} /></div></div>
                                </div>
                            ) : (
                                transactionResult.balance > 0 ? (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800/50 text-center mb-6">
                                        <p className="text-emerald-800 dark:text-emerald-400 font-black text-lg">✅ Diferencia Cobrada: ${transactionResult.balance.toLocaleString()}</p>
                                    </div>
                                ) : (
                                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-sm font-bold mb-6 border border-slate-200 dark:border-slate-700">⚖️ Cambio Directo (Sin diferencia económica)</div>
                                )
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-red-100 dark:border-red-900/50 shadow-sm overflow-hidden">
                                    <div className="bg-red-50 dark:bg-red-900/30 p-3 border-b border-red-100 dark:border-red-900/50 flex items-center justify-center text-red-700 dark:text-red-400 font-black text-xs uppercase tracking-widest"><PackagePlus size={16} className="mr-2" /> Ingresó (+1)</div>
                                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">{transactionResult.itemsEntraron.map(i => (<div key={i.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 flex items-center justify-center shrink-0">{i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover rounded-md" /> : <Shirt size={16} className="text-slate-300 dark:text-slate-500" />}</div><div className="min-w-0"><p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{i.nombre}</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Talle: {i.talle}</p></div></div>))}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm overflow-hidden">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-black text-xs uppercase tracking-widest"><PackageMinus size={16} className="mr-2" /> Salió (-1)</div>
                                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">{transactionResult.itemsSalieron.map(i => (<div key={i.uid} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700"><div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-600 flex items-center justify-center shrink-0">{i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover rounded-md" /> : <Shirt size={16} className="text-slate-300 dark:text-slate-500" />}</div><div className="min-w-0"><p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{i.nombre}</p><p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-0.5">Talle: {i.talle}</p></div></div>))}</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-4 shrink-0">
                            {transactionResult.nota && <button onClick={reactToPrintFn} className="flex-1 bg-slate-800 dark:bg-slate-700 text-white py-4 rounded-xl font-black hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center justify-center shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs"><Printer size={18} className="mr-2" /> Imprimir Nota</button>}
                            <button onClick={() => setTransactionResult(null)} className="flex-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-white py-4 rounded-xl font-black hover:bg-slate-50 dark:hover:bg-slate-700 border-2 border-slate-200 dark:border-slate-700 active:scale-95 transition-all uppercase tracking-widest text-xs shadow-sm">Cerrar y Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER SUPERIOR COMPACTO */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
                        <ArrowRightLeft size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Centro de Cambios</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-0.5">Gestión de devoluciones y reemplazos</p>
                    </div>
                </div>
                {(itemsIn.length > 0 || itemsOut.length > 0) && (
                    <button onClick={() => { if (window.confirm("¿Borrar todo el progreso actual?")) { setItemsIn([]); setItemsOut([]); localStorage.removeItem('returns_in'); localStorage.removeItem('returns_out'); setSelectedPaymentMethod(null); setSurchargePercent(0); setDiscountPercent(0); } }} className="text-red-500 dark:text-red-400 hover:text-white bg-red-50 dark:bg-red-900/20 hover:bg-red-500 dark:hover:bg-red-600 font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-xl border border-red-100 dark:border-red-900/50 transition-all active:scale-95 shadow-sm">
                        Reiniciar
                    </button>
                )}
            </div>

            {/* BARRA DE FILTROS GLOBAL */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0 flex flex-col md:flex-row items-center gap-3 transition-colors relative z-30">
                <select
                    className="w-full md:w-48 p-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                >
                    <option value="mas_vendidos">Más Vendidos</option>
                    <option value="recientes">Más Recientes</option>
                    <option value="az">A - Z</option>
                </select>

                <div className="flex items-center gap-2 overflow-x-auto w-full no-scrollbar pb-1 pt-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 shrink-0">Categoría:</span>
                    <button onClick={() => setSelectedCat('')} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap shrink-0 uppercase tracking-wider ${selectedCat === '' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>TODAS</button>
                    {categories.map(c => (
                        <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)} className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap shrink-0 uppercase tracking-wider ${selectedCat === c.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            {c.nombre}
                        </button>
                    ))}
                </div>

                {selectedCat && (
                    <button onClick={() => setSelectedCat('')} className="shrink-0 p-2.5 text-red-500 hover:bg-red-50 dark:bg-red-900/30 rounded-xl transition-colors active:scale-95" title="Limpiar Filtro">
                        <FilterX size={18} />
                    </button>
                )}
            </div>

            {/* WORKSPACE - LAYOUT (Columnas In, Balance, Out) */}
            <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden min-h-0 relative z-20">

                {/* --- IZQUIERDA: ENTRA (ROJO) --- */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-md border border-red-100 dark:border-red-900/50 overflow-hidden relative z-20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>
                    <div className="p-4 md:p-5 bg-red-50/80 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/50 shrink-0">
                        <h3 className="font-black text-red-800 dark:text-red-400 flex items-center mb-4 text-sm uppercase tracking-widest"><ArrowLeft className="mr-2" size={18} /> Devolución</h3>
                        <div className="relative" ref={containerInRef}>
                            <form onSubmit={(e) => handleScan(e, 'IN')}>
                                <input
                                    ref={inputInRef}
                                    value={termIn}
                                    onChange={e => { setTermIn(e.target.value); setShowDropdownIn(true); setActiveSearchSide('IN'); }}
                                    onFocus={() => { setActiveSearchSide('IN'); if (termIn || selectedCat) setShowDropdownIn(true); }}
                                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowDropdownIn(false); inputInRef.current?.blur(); } }}
                                    className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-red-200 dark:border-red-800/50 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:border-red-400 dark:focus:border-red-500 outline-none transition-all font-bold placeholder-red-300 dark:placeholder-slate-500 text-sm shadow-inner"
                                    placeholder="Buscar o escanear... (ESC cerrar)"
                                />
                                <Search className="absolute left-4 top-3.5 text-red-400 dark:text-red-600" size={18} />
                                {termIn && <button type="button" onClick={() => { setTermIn(''); setResultsIn([]); setShowDropdownIn(false); inputInRef.current?.focus(); }} className="absolute right-4 top-3.5 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>}
                            </form>
                            <SearchResultsDropdown results={resultsIn} type="IN" show={showDropdownIn} />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar">
                        {itemsIn.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-200 dark:text-red-900/50 opacity-60">
                                <ArrowLeft size={56} className="mb-3" />
                                <p className="font-black text-sm uppercase tracking-widest">Escanea Devolución</p>
                            </div>
                        ) : itemsIn.map((item) => (
                            <div key={item.uid} className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/50 flex justify-between items-center animate-fade-in-left group hover:border-red-300 dark:hover:border-red-800 transition-all">
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-xl border dark:border-slate-600 shrink-0 overflow-hidden cursor-zoom-in relative" onClick={() => item.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${item.imagen}`)}>
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-slate-300 dark:text-slate-500 m-auto mt-3" />}
                                        {item.imagen && <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center backdrop-blur-[1px]"><Maximize2 size={16} className="text-white" /></div>}
                                    </div>
                                    <div className="min-w-0 pr-4">
                                        <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{item.nombre}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">Talle {item.talle}</span>
                                            {item.estampa && item.estampa !== 'Standard' && <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-sm">{item.estampa}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <button onClick={() => removeItemIn(item.uid)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"><Trash2 size={18} /></button>
                                    <span className="font-black text-red-600 dark:text-red-400 font-mono tracking-tighter text-lg">$ {item.precio.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="p-5 border-t border-red-100 dark:border-red-900/50 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                        <span className="text-[11px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest">Total Devolución</span>
                        <span className="text-2xl font-black text-red-600 dark:text-red-400 font-mono tracking-tighter">$ {totalIn.toLocaleString()}</span>
                    </div>
                </div>

                {/* --- CENTRO: BALANCE Y PAGOS --- */}
                <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 z-0 h-full">
                    <div className="bg-slate-900 dark:bg-black text-white p-6 rounded-3xl shadow-2xl flex flex-col relative overflow-hidden border border-slate-800 h-full">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Calculator size={140} /></div>

                        {/* Contenedor central con scroll */}
                        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-2 block">
                            <h3 className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-4 border-b border-slate-800 pb-3 flex items-center"><ArrowRightLeft size={16} className="mr-2"/> Balance</h3>
                            
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm font-bold text-slate-300 uppercase tracking-wide">Nuevo</span>
                                <span className="font-mono font-black text-emerald-400 text-lg tracking-tighter">+ {rawTotalOut.toLocaleString()}</span>
                            </div>

                            {/* RECARGOS Y DESCUENTOS ESTILO POS */}
                            {(itemsOut.length > 0 || itemsIn.length > 0) && (
                                <div className="grid grid-cols-2 gap-3 mb-4 mt-2">
                                    <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/30">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[9px] font-bold text-orange-400 uppercase flex items-center"><TrendingUp size={10} className="mr-1" /> Recargo</span>
                                            <span className="text-[10px] font-bold text-orange-300">{surchargePercent}%</span>
                                        </div>
                                        <input type="range" min="0" max="50" step="5" value={surchargePercent} onChange={(e) => setSurchargePercent(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 mb-2" />
                                        <div className="flex gap-1 justify-between">
                                            {[0, 10, 20].map(pct => (
                                                <button key={pct} onClick={() => setSurchargePercent(pct)} className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border transition-colors ${surchargePercent === pct ? 'bg-orange-500 text-white border-orange-500' : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-500'}`}>{pct}%</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[9px] font-bold text-emerald-400 uppercase flex items-center"><TrendingDown size={10} className="mr-1" /> Descuento</span>
                                            <span className="text-[10px] font-bold text-emerald-300">{discountPercent}%</span>
                                        </div>
                                        <input type="range" min="0" max="50" step="5" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2" />
                                        <div className="flex gap-1 justify-between">
                                            {[0, 10, 20].map(pct => (
                                                <button key={pct} onClick={() => setDiscountPercent(pct)} className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border transition-colors ${discountPercent === pct ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-500'}`}>{pct}%</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-end mb-4">
                                <span className="text-sm font-bold text-slate-300 uppercase tracking-wide">Devolución</span>
                                <span className="font-mono font-black text-red-400 text-lg tracking-tighter">- {totalIn.toLocaleString()}</span>
                            </div>
                            
                            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 text-center mb-6 shadow-inner">
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Diferencia Final</p>
                                <p className={`text-4xl font-black tracking-tighter font-mono ${balance < 0 ? 'text-indigo-400' : 'text-white'}`}>$ {Math.abs(balance).toLocaleString()}</p>
                                <p className={`text-[11px] font-black uppercase tracking-widest mt-2 px-3 py-1 inline-block rounded-lg ${balance > 0 ? 'bg-emerald-500/20 text-emerald-400' : balance < 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>{balance > 0 ? "Cliente Paga" : balance < 0 ? "Saldo a Favor" : "Mano a Mano"}</p>
                            </div>
                            
                            {balance > 0 && (
                                <div className="animate-fade-in pb-2">
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3 text-center">Método de Pago</p>
                                    <div className="grid grid-cols-3 gap-2.5">
                                        {paymentMethods.map(m => (
                                            <button key={m.id} onClick={() => setSelectedPaymentMethod(m)} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 ${selectedPaymentMethod?.id === m.id ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                                                {getPaymentIcon(m.nombre)}<span className="text-[9px] font-black mt-1.5 uppercase tracking-widest">{m.nombre.slice(0, 8)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botón confirmar anclado abajo */}
                        <button onClick={handleProcess} disabled={itemsIn.length === 0 && itemsOut.length === 0} className={`w-full py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl transition-all active:scale-95 flex items-center justify-center relative z-10 mt-4 shrink-0 ${itemsIn.length === 0 && itemsOut.length === 0 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/30'}`}><FileCheck size={20} className="mr-2" /> CONFIRMAR</button>
                    </div>
                </div>

                {/* --- DERECHA: SALE (VERDE) --- */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-md border border-emerald-100 dark:border-emerald-900/50 overflow-hidden relative z-20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                    <div className="p-4 md:p-5 bg-emerald-50/80 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-900/50 shrink-0">
                        <h3 className="font-black text-emerald-800 dark:text-emerald-400 flex items-center mb-4 text-sm uppercase tracking-widest"><ArrowRight className="mr-2" size={18} /> Cliente Lleva (Nuevo)</h3>
                        <div className="relative" ref={containerOutRef}>
                            <form onSubmit={(e) => handleScan(e, 'OUT')}>
                                <input
                                    ref={inputOutRef}
                                    value={termOut}
                                    onChange={e => { setTermOut(e.target.value); setShowDropdownOut(true); setActiveSearchSide('OUT'); }}
                                    onFocus={() => { setActiveSearchSide('OUT'); if (termOut || selectedCat) setShowDropdownOut(true); }}
                                    onKeyDown={(e) => { if (e.key === 'Escape') { setShowDropdownOut(false); inputOutRef.current?.blur(); } }}
                                    className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-900/20 outline-none transition-all font-bold placeholder-emerald-300 dark:placeholder-slate-500 text-sm shadow-inner"
                                    placeholder="Buscar o escanear nuevo... (ESC cerrar)"
                                />
                                <Search className="absolute left-4 top-3.5 text-emerald-400 dark:text-emerald-600" size={18} />
                                {termOut && <button type="button" onClick={() => { setTermOut(''); setResultsOut([]); setShowDropdownOut(false); inputOutRef.current?.focus(); }} className="absolute right-4 top-3.5 text-slate-400 hover:text-emerald-500 transition-colors"><X size={18} /></button>}
                            </form>
                            <SearchResultsDropdown results={resultsOut} type="OUT" show={showDropdownOut} />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar">
                        {itemsOut.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-emerald-200 dark:text-emerald-900/50 opacity-60">
                                <ArrowRight size={56} className="mb-3" />
                                <p className="font-black text-sm uppercase tracking-widest">Escanea Nuevo Artículo</p>
                            </div>
                        ) : itemsOut.map((item) => (
                            <div key={item.uid} className="bg-white dark:bg-slate-800 p-3 md:p-4 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/50 flex justify-between items-center animate-fade-in-right group hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-xl border dark:border-slate-600 shrink-0 overflow-hidden cursor-zoom-in relative" onClick={() => item.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${item.imagen}`)}>
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-slate-300 dark:text-slate-500 m-auto mt-3" />}
                                        {item.imagen && <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center backdrop-blur-[1px]"><Maximize2 size={16} className="text-white" /></div>}
                                    </div>
                                    <div className="min-w-0 pr-4">
                                        <p className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{item.nombre}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 shadow-sm">Talle {item.talle}</span>
                                            {item.estampa && item.estampa !== 'Standard' && <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-sm">{item.estampa}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <button onClick={() => removeItemOut(item.uid)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"><Trash2 size={18} /></button>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter text-lg">$ {item.precio.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="p-5 border-t border-emerald-100 dark:border-emerald-900/50 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
                        <span className="text-[11px] font-black text-emerald-400 dark:text-emerald-500 uppercase tracking-widest">Total Nuevos</span>
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">$ {rawTotalOut.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnsPage;