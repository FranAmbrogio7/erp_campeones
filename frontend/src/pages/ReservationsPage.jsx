import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    CalendarClock, Search, CheckCircle, XCircle, DollarSign,
    Phone, Eye, Printer, AlertTriangle, X, CreditCard, Banknote,
    Trash2, Lock, ArrowRight, Store
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import ReservationDetailsModal from '../components/ReservationDetailsModal';
import Ticket from '../components/Ticket';

const ReservationsPage = () => {
    const { token } = useAuth();
    
    // --- IDENTIDAD DE TERMINAL ---
    const tipoCaja = localStorage.getItem('terminal_tipo_caja') || 'PRINCIPAL';
    const isMerch = tipoCaja === 'MERCHANDISING';

    const [reservas, setReservas] = useState([]);
    const [filter, setFilter] = useState('');

    // --- NUEVO: ESTADOS PARA EL COBRO ---
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [reservaToPay, setReservaToPay] = useState(null);
    const [selectedMethodId, setSelectedMethodId] = useState('');

    const [selectedReserva, setSelectedReserva] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // --- LÓGICA DE IMPRESIÓN ---
    const [ticketData, setTicketData] = useState(null);
    const ticketRef = useRef(null);
    const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });

    const handleReprint = (reserva) => {
        const dataForTicket = {
            id_venta: `RES-${reserva.id}`,
            fecha: reserva.fecha || new Date().toLocaleDateString(),
            items: reserva.items || [],
            total: reserva.total,
            cliente: reserva.cliente,
            metodo: `Seña: $${reserva.sena} (Saldo: $${reserva.saldo})`,
            tipo: 'RESERVA'
        };
        setTicketData(dataForTicket);
        setTimeout(() => { if (reactToPrintFn) reactToPrintFn(); }, 150);
    };

    const fetchReservas = async () => {
        try {
            const res = await axios.get('/api/sales/reservas', { headers: { Authorization: `Bearer ${token}` } });
            setReservas(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        // Solo cargamos los datos si la terminal NO es Merch
        if (token && !isMerch) {
            fetchReservas();
            api.get('/sales/payment-methods').then(res => setPaymentMethods(res.data)).catch(console.error);
        }
    }, [token, isMerch]);

    const openPayModal = (reserva) => {
        setReservaToPay(reserva);
        setSelectedMethodId('');
        setIsPayModalOpen(true);
    };

    const handleConfirmRetiro = async (e) => {
        e.preventDefault();
        if (!reservaToPay) return;
        if (reservaToPay.saldo > 0 && !selectedMethodId) {
            return toast.error("Selecciona un método de pago");
        }

        const toastId = toast.loading("Procesando retiro...");
        try {
            // Se asume que el backend tomará el tipo_caja de la venta de retiro 
            // como la caja abierta. Siendo que solo campeones puede abrir esto, estará bien.
            await axios.post(`/api/sales/reservas/${reservaToPay.id}/retirar`,
                { id_metodo_pago: selectedMethodId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success("Reserva retirada y venta registrada", { id: toastId });
            setIsPayModalOpen(false); setReservaToPay(null); fetchReservas();
        } catch (e) { toast.error(e.response?.data?.msg || "Error al retirar", { id: toastId }); }
    };

    const handleCancelar = async (id) => {
        if (!window.confirm("¿Cancelar reserva? El stock volverá al inventario.")) return;
        try {
            await axios.post(`/api/sales/reservas/${id}/cancelar`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Reserva cancelada"); fetchReservas();
        } catch (e) { toast.error("Error cancelando"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("⚠️ ¿Estás seguro de eliminar esta reserva permanentemente? Esta acción no se puede deshacer.")) return;
        const toastId = toast.loading("Eliminando...");
        try {
            await axios.delete(`/api/sales/reservas/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Reserva eliminada exitosamente", { id: toastId });
            fetchReservas(); 
        } catch (e) {
            toast.error(e.response?.data?.msg || "Error al eliminar la reserva", { id: toastId });
        }
    };

    const handleViewDetail = (reserva) => {
        setSelectedReserva(reserva);
        setIsDetailOpen(true);
    };

    const filtered = reservas.filter(r =>
        r.cliente.toLowerCase().includes(filter.toLowerCase()) ||
        (r.telefono && r.telefono.includes(filter))
    );

    // --- PANTALLA DE BLOQUEO PARA MERCHANDISING ---
    if (isMerch) {
        return (
            <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 transition-colors duration-300 p-4 md:p-6">
                <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/20 shadow-sm transition-colors text-center p-6">
                    <div className="p-6 rounded-full mb-6 border shadow-inner bg-purple-100 dark:bg-purple-900/50 text-purple-500 border-purple-200 dark:border-purple-800">
                        <Lock size={64} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Módulo Exclusivo</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium max-w-md">
                        El sistema de reservas está deshabilitado para la Terminal de Merchandising. Este módulo es de uso exclusivo para artículos de indumentaria.
                    </p>
                    <Link to="/caja-control" className="px-8 py-4 rounded-2xl font-black text-white shadow-lg uppercase tracking-widest transition-all active:scale-95 flex items-center bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 shadow-purple-500/30">
                        Volver a Terminal Merch <ArrowRight size={18} className="ml-2" />
                    </Link>
                </div>
            </div>
        );
    }

    // --- VISTA NORMAL (CAMPEONES) ---
    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 relative bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] transition-colors duration-300">
            <Toaster position="top-center" />
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}><Ticket saleData={ticketData} /></div>
            </div>

            <ReservationDetailsModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} reserva={selectedReserva} />

            {isPayModalOpen && reservaToPay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transition-colors border border-slate-200 dark:border-slate-700">
                        <div className="bg-emerald-500 dark:bg-emerald-600 p-5 text-white flex justify-between items-center shadow-md relative z-10">
                            <h3 className="font-black text-xl flex items-center tracking-tight"><DollarSign className="mr-2" size={24} /> Cobrar Saldo</h3>
                            <button onClick={() => setIsPayModalOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleConfirmRetiro} className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 relative z-0">
                            <div className="mb-8 text-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest mb-2">Total a Pagar</p>
                                <p className="text-5xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">$ {reservaToPay.saldo.toLocaleString()}</p>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-3 bg-slate-100 dark:bg-slate-700/50 inline-block px-3 py-1 rounded-lg uppercase tracking-widest">{reservaToPay.cliente}</p>
                            </div>

                            {reservaToPay.saldo > 0 ? (
                                <div className="mb-8">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Selecciona Medio de Pago</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {paymentMethods.map(m => (
                                            <button key={m.id} type="button" onClick={() => setSelectedMethodId(m.id)} className={`p-4 rounded-2xl border-2 flex flex-col items-center transition-all shadow-sm active:scale-95 ${selectedMethodId === m.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-emerald-500/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-600 dark:text-slate-400'}`}>
                                                {m.nombre.toLowerCase().includes('tarjeta') ? <CreditCard size={24} /> : <Banknote size={24} />}
                                                <span className="text-[10px] font-black uppercase tracking-widest mt-2">{m.nombre}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl text-center text-emerald-700 dark:text-emerald-400 font-bold mb-8 border border-emerald-100 dark:border-emerald-800/50 shadow-inner">
                                    ¡Saldo cubierto! Solo confirmar retiro.
                                </div>
                            )}

                            <button type="submit" className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-2xl transition-transform active:scale-95 shadow-lg shadow-emerald-500/30">CONFIRMAR RETIRO</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center tracking-tight mb-1">
                        <CalendarClock className="mr-3 text-indigo-500" size={28} /> Reservas y Señas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Gestiona pedidos apartados y saldos pendientes.</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                        <input placeholder="Buscar cliente o teléfono..." className="pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl w-full focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white transition-colors font-bold text-sm placeholder-slate-400" value={filter} onChange={e => setFilter(e.target.value)} />
                        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                    </div>

                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner w-full md:w-auto overflow-hidden">
                        <div className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600 w-full whitespace-nowrap">
                            <Store size={14} /> Terminal Campeones
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 pl-6">Cliente</th>
                                <th className="p-4">Estado / Vencimiento</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-right">Seña</th>
                                <th className="p-4 text-right">Saldo</th>
                                <th className="p-4 text-center">Detalle</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filtered.map(r => (
                                <tr key={r.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="font-black text-slate-800 dark:text-white leading-tight">{r.cliente}</div>
                                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mt-1.5"><Phone size={12} className="text-slate-400" /> {r.telefono || 'SIN TELÉFONO'}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border shadow-sm ${r.estado === 'pendiente' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' : r.estado === 'retirada' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>{r.estado}</span>
                                            {r.estado === 'pendiente' && r.is_vencida && <span className="flex items-center text-[9px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md border border-red-200 dark:border-red-800/50 shadow-sm animate-pulse"><AlertTriangle size={12} className="mr-1" /> VENCIDA</span>}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vence: {r.vencimiento}</div>
                                    </td>
                                    <td className="p-4 text-right font-black text-slate-600 dark:text-slate-300 font-mono tracking-tight">$ {r.total.toLocaleString()}</td>
                                    <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight border-l border-dashed border-slate-200 dark:border-slate-700">$ {r.sena.toLocaleString()}</td>
                                    <td className="p-4 text-right">
                                        {r.saldo > 0 
                                        ? <span className="font-black text-red-600 dark:text-red-400 font-mono tracking-tight bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-100 dark:border-red-800/50 shadow-sm">$ {r.saldo.toLocaleString()}</span> 
                                        : <span className="text-slate-300 dark:text-slate-600 font-black font-mono tracking-widest">-</span>}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleViewDetail(r)} className="text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 rounded-xl transition-all border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800/50 shadow-sm" title="Ver artículos"><Eye size={18} /></button>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            <button onClick={() => handleReprint(r)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800/50 shadow-sm" title="Reimprimir Ticket"><Printer size={18} /></button>
                                            
                                            {r.estado === 'pendiente' ? (
                                                <>
                                                    <button onClick={() => handleCancelar(r.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800/50 shadow-sm" title="Cancelar Reserva y Devolver Stock"><XCircle size={18} /></button>
                                                    <button onClick={() => openPayModal(r)} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-lg shadow-md shadow-emerald-500/20 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 ml-1" title="Cobrar Saldo"><DollarSign size={14} /> RETIRAR</button>
                                                </>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px] font-black uppercase tracking-widest flex items-center justify-end mr-3"><CheckCircle size={14} className="mr-1" /> Lista</span>
                                            )}

                                            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                            {/* BOTÓN ELIMINAR */}
                                            <button
                                                onClick={() => handleDelete(r.id)}
                                                className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800/50 shadow-sm"
                                                title="Eliminar registro permanentemente"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && <div className="p-16 text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest">No se encontraron reservas con esos datos.</div>}
            </div>
        </div>
    );
};

export default ReservationsPage;