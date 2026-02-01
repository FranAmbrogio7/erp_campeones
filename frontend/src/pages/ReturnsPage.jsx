import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ArrowRightLeft, ScanBarcode, Ticket, CheckCircle,
    RefreshCcw, Printer, ArrowLeft, Trash2, Calculator,
    AlertTriangle, Search, X, Plus, Shirt
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CreditNoteTicket from '../components/CreditNoteTicket';

// Sonidos para feedback
const SOUNDS = {
    beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3'),
    click: new Audio('https://cdn.freesound.org/previews/256/256113_3263906-lq.mp3') // Nuevo sonido suave
};

const ReturnsPage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE ITEMS ---
    const [itemsIn, setItemsIn] = useState([]);   // Devolución (Entra)
    const [itemsOut, setItemsOut] = useState([]); // Cambio (Sale)

    // --- ESTADOS DE BÚSQUEDA ---
    // IZQUIERDA (IN)
    const [termIn, setTermIn] = useState('');
    const [resultsIn, setResultsIn] = useState([]);
    const [isSearchingIn, setIsSearchingIn] = useState(false);

    // DERECHA (OUT)
    const [termOut, setTermOut] = useState('');
    const [resultsOut, setResultsOut] = useState([]);
    const [isSearchingOut, setIsSearchingOut] = useState(false);

    const [resultNota, setResultNota] = useState(null);

    // Refs
    const inputInRef = useRef(null);
    const inputOutRef = useRef(null);

    // --- IMPRESIÓN ---
    const ticketRef = useRef(null);
    const reactToPrintFn = useReactToPrint({
        contentRef: ticketRef,
        documentTitle: `Nota_Credito_${resultNota?.codigo || 'NC'}`,
    });

    // Helper Audio
    const playSound = (type) => {
        try {
            if (SOUNDS[type]) {
                SOUNDS[type].currentTime = 0;
                SOUNDS[type].volume = type === 'click' ? 0.2 : 0.4;
                SOUNDS[type].play();
            }
        } catch (e) { console.error(e); }
    };

    // --- LÓGICA DE BÚSQUEDA HÍBRIDA (SCAN + TEXTO) ---

    // 1. Buscador Izquierdo (IN)
    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termIn.trim()) { setResultsIn([]); return; }

            // Si parece un SKU (muy largo o solo números), no buscamos visualmente, esperamos Enter
            // Pero si el usuario quiere buscar manual, escribirá letras.
            setIsSearchingIn(true);
            try {
                // Buscamos productos que coincidan
                const res = await api.get('/products', { params: { search: termIn, limit: 10 } });
                setResultsIn(res.data.products || []);
            } catch (e) { console.error(e); }
            finally { setIsSearchingIn(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termIn]);

    // 2. Buscador Derecho (OUT)
    useEffect(() => {
        const delay = setTimeout(async () => {
            if (!termOut.trim()) { setResultsOut([]); return; }
            setIsSearchingOut(true);
            try {
                const res = await api.get('/products', { params: { search: termOut, limit: 10 } });
                setResultsOut(res.data.products || []);
            } catch (e) { console.error(e); }
            finally { setIsSearchingOut(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [termOut]);


    // --- ACCIONES DE AGREGADO ---

    // A. Agregar por Click Manual (Desde resultados)
    const addManualItem = (product, variant, type) => {
        const item = {
            id: product.id,
            uid: Date.now() + Math.random(), // ID único para la lista visual
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            precio: product.precio,
            stock_actual: variant.stock // Importante para validar OUT
        };

        if (type === 'IN') {
            setItemsIn(prev => [...prev, item]);
            setTermIn(''); // Limpiar buscador
            setResultsIn([]); // Cerrar lista
            playSound('click');
            toast.success("Devolución agregada");
            inputInRef.current?.focus(); // Volver foco al input
        } else {
            // Validación de Stock para Salida
            if (item.stock_actual <= 0) {
                playSound('error');
                toast.error("Sin stock físico disponible");
                return;
            }
            setItemsOut(prev => [...prev, item]);
            setTermOut('');
            setResultsOut([]);
            playSound('click');
            toast.success("Cambio agregado");
            inputOutRef.current?.focus();
        }
    };

    // B. Agregar por Escáner (Enter en el input)
    const handleScan = async (e, type) => {
        e.preventDefault();
        const term = type === 'IN' ? termIn : termOut;
        if (!term.trim()) return;

        try {
            // Usamos el endpoint de scan específico para exactitud
            const res = await api.get(`/sales/scan/${term}`);

            if (res.data.found) {
                const prod = res.data.product;
                const item = { ...prod, uid: Date.now() };

                if (type === 'IN') {
                    setItemsIn(prev => [...prev, item]);
                    setTermIn('');
                    setResultsIn([]); // Importante cerrar sugerencias si escaneó
                    playSound('beep');
                    toast.success("Escaneado: Devolución");
                } else {
                    if (prod.stock_actual <= 0) {
                        playSound('error');
                        toast.error("¡Sin stock!");
                        return;
                    }
                    setItemsOut(prev => [...prev, item]);
                    setTermOut('');
                    setResultsOut([]);
                    playSound('beep');
                    toast.success("Escaneado: Entrega");
                }
            } else {
                // Si no es un escaneo exacto, no hacemos nada (dejamos que el usuario use la lista manual)
                // Opcional: playSound('error'); toast.error("Código no reconocido");
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Eliminar items de la lista
    const removeItemIn = (uid) => setItemsIn(prev => prev.filter(i => i.uid !== uid));
    const removeItemOut = (uid) => setItemsOut(prev => prev.filter(i => i.uid !== uid));

    // Cálculos
    const totalIn = itemsIn.reduce((acc, i) => acc + i.precio, 0);
    const totalOut = itemsOut.reduce((acc, i) => acc + i.precio, 0);
    const balance = totalOut - totalIn;

    // Procesar Cambio
    const handleProcess = async () => {
        if (itemsIn.length === 0 && itemsOut.length === 0) return;
        if (!window.confirm("¿Confirmar operación de cambio? Esto afectará el stock.")) return;

        const toastId = toast.loading("Procesando...");
        try {
            const res = await api.post('/returns/process', {
                items_in: itemsIn,
                items_out: itemsOut
            });

            if (res.data.nota_credito) {
                setResultNota(res.data.nota_credito);
                playSound('beep');
                toast.success("Nota de Crédito Generada", { id: toastId });
            } else {
                playSound('beep');
                toast.success(res.data.msg, { id: toastId });
            }

            if (!res.data.nota_credito) {
                setItemsIn([]);
                setItemsOut([]);
            }

        } catch (e) {
            playSound('error');
            toast.error(e.response?.data?.msg || "Error", { id: toastId });
        }
    };

    // --- RENDER DE RESULTADOS FLOTANTES (REUTILIZABLE) ---
    const SearchResultsDropdown = ({ results, type }) => {
        if (results.length === 0) return null;

        return (
            <div className={`absolute top-full left-0 right-0 bg-white shadow-xl border rounded-b-xl mt-1 max-h-80 overflow-y-auto z-50 ${type === 'IN' ? 'border-red-200' : 'border-green-200'}`}>
                {results.map(prod => (
                    <div key={prod.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 items-start animate-fade-in">
                        {/* Imagen Mini */}
                        <div className="w-10 h-10 bg-gray-100 rounded shrink-0 overflow-hidden">
                            {prod.imagen ? (
                                <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" />
                            ) : <Shirt className="text-gray-300 w-full h-full p-2" />}
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-700 leading-tight">{prod.nombre}</span>
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${type === 'IN' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                    ${prod.precio}
                                </span>
                            </div>

                            {/* BOTONES DE VARIANTES (Aquí está la magia) */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {prod.variantes.map(v => (
                                    <button
                                        key={v.id_variante}
                                        onClick={() => addManualItem(prod, v, type)}
                                        className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1
                                            ${type === 'IN'
                                                ? 'border-red-100 hover:bg-red-500 hover:text-white text-gray-600'
                                                : (v.stock > 0 ? 'border-green-100 hover:bg-green-500 hover:text-white text-gray-600' : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed')
                                            }`}
                                        disabled={type === 'OUT' && v.stock <= 0}
                                        title={type === 'OUT' ? `Stock: ${v.stock}` : ''}
                                    >
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


    // --- VISTA DE NOTA DE CRÉDITO ---
    if (resultNota) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-6 animate-fade-in">
                <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                    <div ref={ticketRef}><CreditNoteTicket data={resultNota} /></div>
                </div>
                <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full border border-blue-100">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Ticket size={40} className="text-green-600" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-800 mb-2">Nota de Crédito</h2>
                    <p className="text-gray-500 mb-8">El cambio generó un saldo a favor.</p>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 relative group cursor-pointer hover:border-blue-300 transition-colors">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">CÓDIGO</p>
                        <p className="text-4xl font-mono font-black text-blue-600 tracking-wider group-hover:scale-105 transition-transform">{resultNota.codigo}</p>
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-300 flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-500">Saldo</span>
                            <span className="text-2xl font-bold text-gray-800">$ {resultNota.monto.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button onClick={reactToPrintFn} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg flex items-center justify-center">
                            <Printer className="mr-2" /> Imprimir Comprobante
                        </button>
                        <button onClick={() => { setResultNota(null); setItemsIn([]); setItemsOut([]); }} className="w-full bg-white text-gray-600 border border-gray-200 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- VISTA PRINCIPAL ---
    return (
        <div className="p-4 h-[calc(100vh-4rem)] flex flex-col max-w-[1600px] mx-auto">
            <Toaster position="top-center" />

            <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center">
                        <RefreshCcw className="mr-3 text-blue-600" /> Centro de Cambios
                    </h1>
                    <p className="text-sm text-gray-500">Escanea o busca los productos para el canje.</p>
                </div>
                {(itemsIn.length > 0 || itemsOut.length > 0) && (
                    <button
                        onClick={() => { if (window.confirm("¿Borrar todo?")) { setItemsIn([]); setItemsOut([]); } }}
                        className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 transition-colors"
                    >
                        Reiniciar
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">

                {/* --- IZQUIERDA: ENTRA (DEVOLUCIÓN) --- */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-red-100 overflow-visible relative z-20">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500 rounded-t-2xl"></div>

                    <div className="p-5 bg-red-50/50 border-b border-red-100">
                        <h3 className="font-bold text-red-800 flex items-center mb-3">
                            <ArrowLeft className="mr-2" size={20} /> Devolución (Cliente Entrega)
                        </h3>

                        {/* INPUT SMART IZQUIERDO */}
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'IN')}>
                                <input
                                    ref={inputInRef}
                                    value={termIn} onChange={e => setTermIn(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-red-100 focus:border-red-400 focus:ring-4 focus:ring-red-50 outline-none transition-all font-bold text-gray-700 placeholder-red-200"
                                    placeholder="Escanear o buscar nombre..."
                                    autoFocus
                                />
                                <Search className="absolute left-3 top-3.5 text-red-300" size={20} />
                                {isSearchingIn && <div className="absolute right-3 top-3.5 animate-spin w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full"></div>}
                            </form>

                            {/* DROPDOWN RESULTADOS IN */}
                            <SearchResultsDropdown results={resultsIn} type="IN" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsIn.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-200 opacity-60">
                                <ArrowLeft size={48} className="mb-2" />
                                <p className="font-bold text-sm">Lista vacía</p>
                            </div>
                        ) : itemsIn.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-red-100 flex justify-between items-center animate-fade-in-left">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                    <p className="text-xs text-gray-500 font-mono bg-red-50 inline px-1 rounded">Talle: {item.talle}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemIn(item.uid)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-red-100 bg-white flex justify-between items-center rounded-b-2xl">
                        <span className="text-xs font-bold text-red-400 uppercase">Total Devolución</span>
                        <span className="text-2xl font-black text-red-600">$ {totalIn.toLocaleString()}</span>
                    </div>
                </div>

                {/* --- CENTRO: BALANCE --- */}
                <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 z-0">
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between flex-1">
                        <div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center"><Calculator size={14} className="mr-2" /> Resumen</h3>
                            <div className="space-y-2 mb-6 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>Nuevos</span>
                                    <span className="font-bold text-green-400">+ $ {totalOut.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Devolución</span>
                                    <span className="font-bold text-red-400">- $ {totalIn.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-slate-700 my-2"></div>
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Diferencia</p>
                            <p className={`text-4xl font-black tracking-tight mb-2 ${balance < 0 ? 'text-blue-400' : 'text-white'}`}>
                                $ {Math.abs(balance).toLocaleString()}
                            </p>
                            <div className={`py-2 px-3 rounded-lg text-xs font-bold uppercase inline-block w-full ${balance > 0 ? 'bg-green-500 text-slate-900' : balance < 0 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                {balance > 0 ? "Cliente Paga" : balance < 0 ? "A Favor Cliente" : "Mano a Mano"}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleProcess}
                        disabled={itemsIn.length === 0 && itemsOut.length === 0}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center ${itemsIn.length === 0 && itemsOut.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}
                    >
                        CONFIRMAR <CheckCircle size={20} className="ml-2" />
                    </button>
                </div>

                {/* --- DERECHA: SALE (NUEVO) --- */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-green-100 overflow-visible relative z-20">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500 rounded-t-2xl"></div>

                    <div className="p-5 bg-green-50/50 border-b border-green-100">
                        <h3 className="font-bold text-green-800 flex items-center mb-3">
                            Productos Nuevos (Cliente Lleva) <ArrowRightLeft className="ml-2" size={20} />
                        </h3>

                        {/* INPUT SMART DERECHO */}
                        <div className="relative">
                            <form onSubmit={(e) => handleScan(e, 'OUT')}>
                                <input
                                    ref={inputOutRef}
                                    value={termOut} onChange={e => setTermOut(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-green-100 focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all font-bold text-gray-700 placeholder-green-200"
                                    placeholder="Escanear o buscar nuevo..."
                                />
                                <Search className="absolute left-3 top-3.5 text-green-300" size={20} />
                                {isSearchingOut && <div className="absolute right-3 top-3.5 animate-spin w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full"></div>}
                            </form>

                            {/* DROPDOWN RESULTADOS OUT */}
                            <SearchResultsDropdown results={resultsOut} type="OUT" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsOut.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-green-200 opacity-60">
                                <Ticket size={48} className="mb-2" />
                                <p className="font-bold text-sm">Lista vacía</p>
                            </div>
                        ) : itemsOut.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-green-100 flex justify-between items-center animate-fade-in-right">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                    <p className="text-xs text-gray-500 font-mono bg-green-50 inline px-1 rounded">Talle: {item.talle}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemOut(item.uid)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-green-100 bg-white flex justify-between items-center rounded-b-2xl">
                        <span className="text-xs font-bold text-green-400 uppercase">Total Nuevos</span>
                        <span className="text-2xl font-black text-green-600">$ {totalOut.toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReturnsPage;