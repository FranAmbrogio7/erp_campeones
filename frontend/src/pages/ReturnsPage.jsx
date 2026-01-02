import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ArrowRightLeft, ScanBarcode, Ticket, CheckCircle,
    RefreshCcw, Printer, ArrowLeft, Trash2, Calculator,
    AlertTriangle, Search, X
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CreditNoteTicket from '../components/CreditNoteTicket';

// Sonidos para feedback
const SOUNDS = {
    beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3')
};

const ReturnsPage = () => {
    const { token } = useAuth();

    // Estados
    const [itemsIn, setItemsIn] = useState([]);   // Devolución
    const [itemsOut, setItemsOut] = useState([]); // Cambio
    const [skuIn, setSkuIn] = useState('');
    const [skuOut, setSkuOut] = useState('');
    const [resultNota, setResultNota] = useState(null);

    // Refs para foco automático
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
                SOUNDS[type].volume = 0.4;
                SOUNDS[type].play();
            }
        } catch (e) { console.error(e); }
    };

    // Lógica de Búsqueda
    const findProduct = async (sku) => {
        try {
            const res = await api.get(`/sales/scan/${sku}`);
            return res.data.found ? res.data.product : null;
        } catch (e) { return null; }
    };

    const handleScanIn = async (e) => {
        e.preventDefault();
        if (!skuIn.trim()) return;

        const prod = await findProduct(skuIn);
        if (prod) {
            setItemsIn(prev => [...prev, { ...prod, uid: Date.now() }]); // UID único para borrar
            setSkuIn('');
            playSound('beep');
            toast.success("Producto recibido");
        } else {
            playSound('error');
            toast.error("Producto no encontrado");
        }
    };

    const handleScanOut = async (e) => {
        e.preventDefault();
        if (!skuOut.trim()) return;

        const prod = await findProduct(skuOut);
        if (prod) {
            if (prod.stock_actual <= 0) {
                playSound('error');
                toast.error("Sin stock disponible");
                return;
            }
            setItemsOut(prev => [...prev, { ...prod, uid: Date.now() }]);
            setSkuOut('');
            playSound('beep');
            toast.success("Agregado al cambio");
        } else {
            playSound('error');
            toast.error("Producto no encontrado");
        }
    };

    // Eliminar items
    const removeItemIn = (uid) => setItemsIn(prev => prev.filter(i => i.uid !== uid));
    const removeItemOut = (uid) => setItemsOut(prev => prev.filter(i => i.uid !== uid));

    // Cálculos
    const totalIn = itemsIn.reduce((acc, i) => acc + i.precio, 0);
    const totalOut = itemsOut.reduce((acc, i) => acc + i.precio, 0);
    const balance = totalOut - totalIn; // Positivo: Cliente paga. Negativo: A favor cliente.

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

            // Limpiar si no es nota de crédito (si es NC, esperamos a que el usuario salga)
            if (!res.data.nota_credito) {
                setItemsIn([]);
                setItemsOut([]);
            }

        } catch (e) {
            playSound('error');
            toast.error(e.response?.data?.msg || "Error", { id: toastId });
        }
    };

    // --- VISTA DE NOTA DE CRÉDITO (ÉXITO) ---
    if (resultNota) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-6 animate-fade-in">
                {/* Ticket Oculto */}
                <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                    <div ref={ticketRef}><CreditNoteTicket data={resultNota} /></div>
                </div>

                <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full border border-blue-100">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Ticket size={40} className="text-green-600" />
                    </div>

                    <h2 className="text-3xl font-black text-gray-800 mb-2">Nota de Crédito</h2>
                    <p className="text-gray-500 mb-8">El cambio generó un saldo a favor del cliente.</p>

                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-8 relative overflow-hidden group cursor-pointer hover:border-blue-300 transition-colors">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">CÓDIGO DE CANJE</p>
                        <p className="text-4xl font-mono font-black text-blue-600 tracking-wider group-hover:scale-105 transition-transform">{resultNota.codigo}</p>
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-300 flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-500">Monto</span>
                            <span className="text-2xl font-bold text-gray-800">$ {resultNota.monto.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button onClick={reactToPrintFn} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg flex items-center justify-center">
                            <Printer className="mr-2" /> Imprimir Comprobante
                        </button>
                        <button onClick={() => { setResultNota(null); setItemsIn([]); setItemsOut([]); }} className="w-full bg-white text-gray-600 border border-gray-200 py-3 rounded-xl font-bold hover:bg-gray-50 transition-colors">
                            Volver a Cambios
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

            {/* HEADER */}
            <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center">
                        <RefreshCcw className="mr-3 text-blue-600" /> Centro de Cambios
                    </h1>
                    <p className="text-sm text-gray-500">Escanea los productos que entran y los que salen.</p>
                </div>
                {(itemsIn.length > 0 || itemsOut.length > 0) && (
                    <button
                        onClick={() => { if (window.confirm("¿Borrar todo?")) { setItemsIn([]); setItemsOut([]); } }}
                        className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 transition-colors"
                    >
                        Reiniciar Operación
                    </button>
                )}
            </div>

            {/* GRID PRINCIPAL */}
            <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">

                {/* --- IZQUIERDA: ENTRA (DEVOLUCIÓN) --- */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500"></div>

                    {/* Header Columna */}
                    <div className="p-5 bg-red-50/50 border-b border-red-100">
                        <h3 className="font-bold text-red-800 flex items-center mb-3">
                            <ArrowLeft className="mr-2" size={20} /> Devolución (Entra al Stock)
                        </h3>
                        <form onSubmit={handleScanIn} className="relative">
                            <input
                                ref={inputInRef}
                                value={skuIn} onChange={e => setSkuIn(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-red-100 focus:border-red-400 focus:ring-4 focus:ring-red-50 outline-none transition-all font-mono uppercase font-bold text-gray-700 placeholder-red-200"
                                placeholder="Escanear producto..."
                                autoFocus
                            />
                            <ScanBarcode className="absolute left-3 top-3.5 text-red-300" size={20} />
                            <button type="submit" className="absolute right-3 top-3.5 text-red-300">
                                <ArrowLeft size={20} />
                            </button>

                        </form>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsIn.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-200 opacity-60">
                                <ArrowLeft size={48} className="mb-2" />
                                <p className="font-bold text-sm">Escanea lo que trae el cliente</p>
                            </div>
                        ) : itemsIn.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-red-100 flex justify-between items-center group animate-fade-in-left">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                    <p className="text-xs text-gray-500">{item.talle} | SKU: {item.sku}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemIn(item.uid)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total Footer */}
                    <div className="p-4 border-t border-red-100 bg-white flex justify-between items-center">
                        <span className="text-xs font-bold text-red-400 uppercase">Total Devolución</span>
                        <span className="text-2xl font-black text-red-600">$ {totalIn.toLocaleString()}</span>
                    </div>
                </div>


                {/* --- CENTRO: PANEL DE ACCIÓN Y BALANCE --- */}
                <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">

                    {/* Tarjeta de Cálculo */}
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between flex-1">
                        <div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase mb-4 flex items-center"><Calculator size={14} className="mr-2" /> Resumen Operación</h3>

                            <div className="space-y-2 mb-6 text-sm">
                                <div className="flex justify-between text-slate-300">
                                    <span>Nuevos Productos</span>
                                    <span className="font-bold text-green-400">+ $ {totalOut.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-300">
                                    <span>Devoluciones</span>
                                    <span className="font-bold text-red-400">- $ {totalIn.toLocaleString()}</span>
                                </div>
                                <div className="h-px bg-slate-700 my-2"></div>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Balance Final</p>
                            <p className={`text-4xl font-black tracking-tight mb-2 ${balance < 0 ? 'text-blue-400' : 'text-white'}`}>
                                $ {Math.abs(balance).toLocaleString()}
                            </p>

                            <div className={`py-2 px-3 rounded-lg text-xs font-bold uppercase inline-block w-full ${balance > 0 ? 'bg-green-500 text-slate-900' :
                                balance < 0 ? 'bg-blue-500 text-white' :
                                    'bg-slate-700 text-slate-400'
                                }`}>
                                {balance > 0 ? "Cliente Paga Diferencia" :
                                    balance < 0 ? "A Favor del Cliente (NC)" :
                                        itemsIn.length > 0 ? "Cambio Mano a Mano" : "Esperando..."}
                            </div>
                        </div>
                    </div>

                    {/* Botón Acción */}
                    <button
                        onClick={handleProcess}
                        disabled={itemsIn.length === 0 && itemsOut.length === 0}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 flex items-center justify-center ${itemsIn.length === 0 && itemsOut.length === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                            }`}
                    >
                        CONFIRMAR <CheckCircle size={20} className="ml-2" />
                    </button>
                </div>


                {/* --- DERECHA: SALE (NUEVO) --- */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-green-500"></div>

                    {/* Header Columna */}
                    <div className="p-5 bg-green-50/50 border-b border-green-100">
                        <h3 className="font-bold text-green-800 flex items-center mb-3">
                            Productos Nuevos (Sale Stock) <ArrowRightLeft className="ml-2" size={20} />
                        </h3>
                        <form onSubmit={handleScanOut} className="relative">
                            <input
                                ref={inputOutRef}
                                value={skuOut} onChange={e => setSkuOut(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-green-100 focus:border-green-400 focus:ring-4 focus:ring-green-50 outline-none transition-all font-mono uppercase font-bold text-gray-700 placeholder-green-200"
                                placeholder="Escanear qué se lleva..."
                            />
                            <ScanBarcode className="absolute left-3 top-3.5 text-green-300" size={20} />
                            <button type="submit" className="absolute right-3 top-3.5 text-green-300">
                                <ArrowLeft size={20} />
                            </button>
                        </form>
                    </div>

                    {/* Lista */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/30">
                        {itemsOut.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-green-200 opacity-60">
                                <Ticket size={48} className="mb-2" />
                                <p className="font-bold text-sm">Escanea lo que se lleva nuevo</p>
                            </div>
                        ) : itemsOut.map((item) => (
                            <div key={item.uid} className="bg-white p-3 rounded-xl shadow-sm border border-green-100 flex justify-between items-center group animate-fade-in-right">
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                    <p className="text-xs text-gray-500">{item.talle} | SKU: {item.sku}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm">$ {item.precio.toLocaleString()}</span>
                                    <button onClick={() => removeItemOut(item.uid)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Total Footer */}
                    <div className="p-4 border-t border-green-100 bg-white flex justify-between items-center">
                        <span className="text-xs font-bold text-green-400 uppercase">Total Nuevos</span>
                        <span className="text-2xl font-black text-green-600">$ {totalOut.toLocaleString()}</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReturnsPage;