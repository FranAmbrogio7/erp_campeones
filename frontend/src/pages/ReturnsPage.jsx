import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ArrowRightLeft, Ticket, CheckCircle, RefreshCcw, Printer,
    ArrowLeft, Trash2, Calculator, Search, X, Plus, Shirt,
    PackagePlus, PackageMinus, ArrowRight, FileCheck
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CreditNoteTicket from '../components/CreditNoteTicket';

// Sonidos
const SOUNDS = {
    beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3'),
    click: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3'),
    success: new Audio('https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3')
};

const ReturnsPage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE ITEMS ---
    const [itemsIn, setItemsIn] = useState([]);   // Devolución (Entra)
    const [itemsOut, setItemsOut] = useState([]); // Cambio (Sale)

    // --- ESTADOS DE BÚSQUEDA ---
    const [termIn, setTermIn] = useState('');
    const [resultsIn, setResultsIn] = useState([]);
    const [isSearchingIn, setIsSearchingIn] = useState(false);

    const [termOut, setTermOut] = useState('');
    const [resultsOut, setResultsOut] = useState([]);
    const [isSearchingOut, setIsSearchingOut] = useState(false);

    // --- ESTADO DEL RESULTADO (MODAL) ---
    const [transactionResult, setTransactionResult] = useState(null);

    // Refs
    const inputInRef = useRef(null);
    const inputOutRef = useRef(null);
    const ticketRef = useRef(null);

    // Impresión
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

    // --- BÚSQUEDAS (IN/OUT) ---
    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termIn.trim()) { setResultsIn([]); return; }
            setIsSearchingIn(true);
            try {
                const res = await api.get('/products', { params: { search: termIn, limit: 10 } });
                setResultsIn(res.data.products || []);
            } catch (e) { console.error(e); } finally { setIsSearchingIn(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termIn]);

    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termOut.trim()) { setResultsOut([]); return; }
            setIsSearchingOut(true);
            try {
                const res = await api.get('/products', { params: { search: termOut, limit: 10 } });
                setResultsOut(res.data.products || []);
            } catch (e) { console.error(e); } finally { setIsSearchingOut(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termOut]);

    // --- ACCIONES AGREGAR ---
    const addManualItem = (product, variant, type) => {
        const item = {
            id: product.id,
            id_variante: variant.id_variante,
            uid: Date.now() + Math.random(),
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            precio: product.precio,
            stock_actual: variant.stock,
            imagen: product.imagen
        };

        if (type === 'IN') {
            setItemsIn(prev => [...prev, item]);
            setTermIn(''); setResultsIn([]);
            inputInRef.current?.focus();
        } else {
            if (item.stock_actual <= 0) {
                playSound('error');
                toast.error("Sin stock físico disponible");
                return;
            }
            setItemsOut(prev => [...prev, item]);
            setTermOut(''); setResultsOut([]);
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
                    setItemsIn(prev => [...prev, item]);
                    setTermIn(''); setResultsIn([]);
                    toast.success("Devolución escaneada");
                } else {
                    if (prod.stock_actual <= 0) {
                        playSound('error');
                        toast.error("¡Sin stock!");
                        return;
                    }
                    setItemsOut(prev => [...prev, item]);
                    setTermOut(''); setResultsOut([]);
                    toast.success("Entrega escaneada");
                }
                playSound('beep');
            }
        } catch (error) { console.error(error); }
    };

    // Cálculos
    const totalIn = itemsIn.reduce((acc, i) => acc + i.precio, 0);
    const totalOut = itemsOut.reduce((acc, i) => acc + i.precio, 0);
    const balance = totalOut - totalIn;

    // --- PROCESAR CAMBIO ---
    const handleProcess = async () => {
        if (itemsIn.length === 0 && itemsOut.length === 0) return;
        if (!window.confirm("¿Confirmar operación de cambio? Esto afectará el stock.")) return;

        const toastId = toast.loading("Procesando stock...");
        try {
            const res = await api.post('/returns/process', {
                items_in: itemsIn,
                items_out: itemsOut
            });

            // Preparamos el resumen para el modal
            const summaryData = {
                nota: res.data.nota_credito || null,
                itemsEntraron: [...itemsIn],
                itemsSalieron: [...itemsOut],
                balance: balance
            };

            setTransactionResult(summaryData);

            // Limpiamos formularios de fondo
            setItemsIn([]);
            setItemsOut([]);

            playSound('success');
            toast.success("¡Cambio registrado correctamente!", { id: toastId });

        } catch (e) {
            playSound('error');
            toast.error(e.response?.data?.msg || "Error", { id: toastId });
        }
    };

    // --- RENDERIZADO DEL DROPDOWN ---
    const SearchResultsDropdown = ({ results, type }) => {
        if (results.length === 0) return null;
        return (
            <div className={`absolute top-full left-0 right-0 bg-white shadow-xl border rounded-b-xl mt-1 max-h-80 overflow-y-auto z-50 ${type === 'IN' ? 'border-red-200' : 'border-green-200'}`}>
                {results.map(prod => (
                    <div key={prod.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 items-start animate-fade-in">
                        <div className="w-10 h-10 bg-gray-100 rounded shrink-0 overflow-hidden border">
                            {prod.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" /> : <Shirt className="text-gray-300 w-full h-full p-2" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-700 leading-tight">{prod.nombre}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${type === 'IN' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>${prod.precio}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {prod.variantes.map(v => (
                                    <button key={v.id_variante} onClick={() => addManualItem(prod, v, type)} className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${type === 'IN' ? 'border-red-100 hover:bg-red-500 hover:text-white text-gray-600' : (v.stock > 0 ? 'border-green-100 hover:bg-green-500 hover:text-white text-gray-600' : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed')}`} disabled={type === 'OUT' && v.stock <= 0}>
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
        <div className="p-4 h-full flex flex-col max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* --- MODAL DE CONFIRMACIÓN DE MOVIMIENTO --- */}
            {transactionResult && (
                <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header Modal */}
                        <div className="bg-green-600 p-6 text-white text-center shrink-0">
                            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                <CheckCircle size={32} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-wide">Movimiento Exitoso</h2>
                            <p className="text-green-100 text-sm font-medium">El stock ha sido actualizado correctamente</p>
                        </div>

                        {/* Body Modal */}
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">

                            {/* Sección Financiera */}
                            {transactionResult.nota ? (
                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm mb-6 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute left-0 top-0 w-1.5 h-full bg-blue-500"></div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Se generó Nota de Crédito</p>
                                        <p className="text-xl font-black text-gray-800 font-mono">{transactionResult.nota.codigo}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-gray-400 uppercase">Saldo a Favor</p>
                                        <p className="text-xl font-black text-blue-600">$ {transactionResult.nota.monto.toLocaleString()}</p>
                                    </div>
                                    {/* Ticket Oculto para impresión */}
                                    <div style={{ display: 'none' }}><div ref={ticketRef}><CreditNoteTicket data={transactionResult.nota} /></div></div>
                                </div>
                            ) : (
                                transactionResult.balance === 0 && (
                                    <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-500 text-sm font-bold mb-6 border border-gray-200">
                                        ⚖️ Cambio mano a mano (Sin diferencia económica)
                                    </div>
                                )
                            )}

                            {/* Sección Stock (Grid) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Columna ENTRÓ */}
                                <div className="bg-white rounded-xl border border-green-100 shadow-sm overflow-hidden">
                                    <div className="bg-green-50 p-2 border-b border-green-100 flex items-center justify-center text-green-700 font-bold text-xs uppercase">
                                        <PackagePlus size={14} className="mr-2" /> Ingresó al Stock (+1)
                                    </div>
                                    <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
                                        {transactionResult.itemsEntraron.map(i => (
                                            <div key={i.uid} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                                                <div className="w-8 h-8 bg-white rounded border flex items-center justify-center shrink-0">
                                                    {i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={12} className="text-gray-300" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-700 truncate">{i.nombre}</p>
                                                    <p className="text-[10px] text-gray-500">Talle: {i.talle}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {transactionResult.itemsEntraron.length === 0 && <p className="text-center text-xs text-gray-300 italic py-4">Nada</p>}
                                    </div>
                                </div>

                                {/* Columna SALIÓ */}
                                <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
                                    <div className="bg-red-50 p-2 border-b border-red-100 flex items-center justify-center text-red-700 font-bold text-xs uppercase">
                                        <PackageMinus size={14} className="mr-2" /> Salió del Stock (-1)
                                    </div>
                                    <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
                                        {transactionResult.itemsSalieron.map(i => (
                                            <div key={i.uid} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                                                <div className="w-8 h-8 bg-white rounded border flex items-center justify-center shrink-0">
                                                    {i.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${i.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={12} className="text-gray-300" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-700 truncate">{i.nombre}</p>
                                                    <p className="text-[10px] text-gray-500">Talle: {i.talle}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {transactionResult.itemsSalieron.length === 0 && <p className="text-center text-xs text-gray-300 italic py-4">Nada</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-white border-t flex gap-3">
                            {transactionResult.nota && (
                                <button onClick={reactToPrintFn} className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 flex items-center justify-center shadow-lg">
                                    <Printer size={18} className="mr-2" /> Imprimir Nota
                                </button>
                            )}
                            <button onClick={() => setTransactionResult(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 border border-gray-200">
                                Cerrar y Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- HEADER PRINCIPAL --- */}
            <div className="flex justify-between items-center mb-2 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center">
                        <RefreshCcw className="mr-3 text-blue-600" /> Centro de Cambios
                    </h1>
                    <p className="text-sm text-gray-500">Gestión de devoluciones y garantías.</p>
                </div>
                {(itemsIn.length > 0 || itemsOut.length > 0) && (
                    <button onClick={() => { if (window.confirm("¿Borrar todo?")) { setItemsIn([]); setItemsOut([]); } }} className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 transition-colors">
                        Reiniciar
                    </button>
                )}
            </div>

            {/* --- WORKSPACE --- */}
            <div className="flex flex-col lg:flex-row gap-4 flex-1 overflow-hidden">

                {/* IZQUIERDA: ENTRA (DEVOLUCIÓN) */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-red-100 overflow-visible relative z-20">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 rounded-t-2xl"></div>
                    <div className="p-4 bg-red-50/50 border-b border-red-100">
                        <h3 className="font-bold text-red-800 flex items-center mb-3 text-sm uppercase tracking-wide">
                            <ArrowLeft className="mr-2" size={18} /> Cliente Entrega (Devolución)
                        </h3>
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'IN')}>
                                <input ref={inputInRef} value={termIn} onChange={e => setTermIn(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-red-100 focus:border-red-400 focus:ring-4 focus:ring-red-50 outline-none transition-all font-bold text-gray-700 placeholder-red-300 text-sm" placeholder="Escanear o buscar..." autoFocus />
                                <Search className="absolute left-3 top-3 text-red-300" size={16} />
                            </form>
                            <SearchResultsDropdown results={resultsIn} type="IN" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsIn.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-200 opacity-60">
                                <ArrowLeft size={48} className="mb-2" />
                                <p className="font-bold text-sm">Escanea producto devuelto</p>
                            </div>
                        ) : itemsIn.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-red-100 flex justify-between items-center animate-fade-in-left">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded border shrink-0 overflow-hidden">
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={16} className="text-gray-300 m-auto mt-2" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm leading-tight">{item.nombre}</p>
                                        <p className="text-[10px] text-gray-500 font-mono bg-red-50 inline px-1.5 py-0.5 rounded mt-1">Talle: {item.talle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600 text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemIn(item.uid)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t border-red-100 bg-white flex justify-between items-center rounded-b-2xl">
                        <span className="text-xs font-bold text-red-400 uppercase">Total Devolución</span>
                        <span className="text-xl font-black text-red-600">$ {totalIn.toLocaleString()}</span>
                    </div>
                </div>

                {/* CENTRO: BALANCE */}
                <div className="w-full lg:w-72 flex flex-col gap-4 shrink-0 z-0">
                    <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex flex-col justify-between flex-1 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5"><Calculator size={100} /></div>

                        <div className="relative z-10">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-6 border-b border-slate-700 pb-2">Balance de Operación</h3>

                            <div className="flex justify-between items-end mb-2">
                                <span className="text-sm text-slate-300">Nuevo</span>
                                <span className="font-mono font-bold text-green-400 text-lg">+ {totalOut.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-sm text-slate-300">Devolución</span>
                                <span className="font-mono font-bold text-red-400 text-lg">- {totalIn.toLocaleString()}</span>
                            </div>

                            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-center">
                                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Diferencia Final</p>
                                <p className={`text-3xl font-black tracking-tighter ${balance < 0 ? 'text-blue-400' : 'text-white'}`}>
                                    $ {Math.abs(balance).toLocaleString()}
                                </p>
                                <p className={`text-xs font-bold mt-1 ${balance > 0 ? 'text-green-500' : balance < 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                                    {balance > 0 ? "Cliente Paga" : balance < 0 ? "Saldo a Favor" : "Mano a Mano"}
                                </p>
                            </div>
                        </div>

                        <button onClick={handleProcess} disabled={itemsIn.length === 0 && itemsOut.length === 0} className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center relative z-10 mt-4 ${itemsIn.length === 0 && itemsOut.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/50'}`}>
                            <FileCheck size={18} className="mr-2" /> CONFIRMAR CAMBIO
                        </button>
                    </div>
                </div>

                {/* DERECHA: SALE (NUEVO) */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-green-100 overflow-visible relative z-20">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-500 rounded-t-2xl"></div>
                    <div className="p-4 bg-green-50/50 border-b border-green-100">
                        <h3 className="font-bold text-green-800 flex items-center mb-3 text-sm uppercase tracking-wide">
                            <ArrowRight className="mr-2" size={18} /> Cliente Lleva (Nuevo)
                        </h3>
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'OUT')}>
                                <input ref={inputOutRef} value={termOut} onChange={e => setTermOut(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-green-100 focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all font-bold text-gray-700 placeholder-green-300 text-sm" placeholder="Escanear o buscar..." />
                                <Search className="absolute left-3 top-3 text-green-300" size={16} />
                            </form>
                            <SearchResultsDropdown results={resultsOut} type="OUT" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsOut.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-green-200 opacity-60">
                                <ArrowRight size={48} className="mb-2" />
                                <p className="font-bold text-sm">Escanea producto nuevo</p>
                            </div>
                        ) : itemsOut.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-green-100 flex justify-between items-center animate-fade-in-right">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-100 rounded border shrink-0 overflow-hidden">
                                        {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={16} className="text-gray-300 m-auto mt-2" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-sm leading-tight">{item.nombre}</p>
                                        <p className="text-[10px] text-gray-500 font-mono bg-green-50 inline px-1.5 py-0.5 rounded mt-1">Talle: {item.talle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-green-600 text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemOut(item.uid)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-3 border-t border-green-100 bg-white flex justify-between items-center rounded-b-2xl">
                        <span className="text-xs font-bold text-green-400 uppercase">Total Nuevos</span>
                        <span className="text-xl font-black text-green-600">$ {totalOut.toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReturnsPage;