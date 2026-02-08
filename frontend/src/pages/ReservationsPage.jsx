import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    CalendarClock, Search, CheckCircle, XCircle, DollarSign,
    Phone, Eye, Printer, AlertTriangle, X, CreditCard, Banknote
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import ReservationDetailsModal from '../components/ReservationDetailsModal';
import Ticket from '../components/Ticket';

const ReservationsPage = () => {
    const { token } = useAuth();
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
        if (token) {
            fetchReservas();
            api.get('/sales/payment-methods').then(res => setPaymentMethods(res.data)).catch(console.error);
        }
    }, [token]);

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

    const handleViewDetail = (reserva) => {
        setSelectedReserva(reserva);
        setIsDetailOpen(true);
    };

    const filtered = reservas.filter(r =>
        r.cliente.toLowerCase().includes(filter.toLowerCase()) ||
        (r.telefono && r.telefono.includes(filter))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 relative bg-gray-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
            <Toaster position="top-center" />
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}><Ticket saleData={ticketData} /></div>
            </div>

            <ReservationDetailsModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} reserva={selectedReserva} />

            {isPayModalOpen && reservaToPay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-colors">
                        <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center"><DollarSign className="mr-2" /> Cobrar Saldo</h3>
                            <button onClick={() => setIsPayModalOpen(false)} className="hover:bg-green-700 p-1 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleConfirmRetiro} className="p-6">
                            <div className="mb-6 text-center">
                                <p className="text-gray-500 dark:text-gray-400 text-sm uppercase font-bold mb-1">Total a Pagar</p>
                                <p className="text-4xl font-black text-gray-800 dark:text-white">$ {reservaToPay.saldo.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-2">Cliente: {reservaToPay.cliente}</p>
                            </div>

                            {reservaToPay.saldo > 0 ? (
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Selecciona Medio de Pago</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {paymentMethods.map(m => (
                                            <button key={m.id} type="button" onClick={() => setSelectedMethodId(m.id)} className={`p-3 rounded-xl border-2 flex flex-col items-center transition-all ${selectedMethodId === m.id ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'border-gray-100 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 text-gray-500 dark:text-gray-400'}`}>
                                                {m.nombre.toLowerCase().includes('tarjeta') ? <CreditCard size={20} /> : <Banknote size={20} />}
                                                <span className="text-xs font-bold mt-1">{m.nombre}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center text-green-700 dark:text-green-400 font-bold mb-6">
                                    ¡Saldo cubierto! Solo confirmar retiro.
                                </div>
                            )}

                            <button type="submit" className="w-full py-3 bg-slate-900 dark:bg-slate-700 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-slate-600 transition-transform active:scale-95 shadow-lg">CONFIRMAR RETIRO</button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                        <CalendarClock className="mr-3 text-purple-600 dark:text-purple-400" /> Reservas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Gestiona señas, pedidos apartados y saldos pendientes.</p>
                </div>
                <div className="relative w-full md:w-auto">
                    <input placeholder="Buscar cliente o teléfono..." className="pl-10 pr-4 py-2 border dark:border-slate-700 rounded-lg w-full md:w-72 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm bg-white dark:bg-slate-800 text-gray-800 dark:text-white transition-colors" value={filter} onChange={e => setFilter(e.target.value)} />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 font-bold uppercase text-xs border-b dark:border-slate-700">
                            <tr>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Estado / Vencimiento</th>
                                <th className="p-4 text-right">Total</th>
                                <th className="p-4 text-right">Seña</th>
                                <th className="p-4 text-right">Saldo</th>
                                <th className="p-4 text-center">Detalle</th>
                                <th className="p-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {filtered.map(r => (
                                <tr key={r.id} className="hover:bg-purple-50/20 dark:hover:bg-purple-900/10 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800 dark:text-white">{r.cliente}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={12} className="text-gray-400" /> {r.telefono || '-'}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${r.estado === 'pendiente' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' : r.estado === 'retirada' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-slate-600'}`}>{r.estado}</span>
                                            {r.estado === 'pendiente' && r.is_vencida && <span className="flex items-center text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-100 dark:border-red-800 animate-pulse"><AlertTriangle size={10} className="mr-1" /> VENCIDA</span>}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Vence: {r.vencimiento}</div>
                                    </td>
                                    <td className="p-4 text-right font-medium text-gray-600 dark:text-gray-300">$ {r.total.toLocaleString()}</td>
                                    <td className="p-4 text-right text-green-600 dark:text-green-400 font-medium">$ {r.sena.toLocaleString()}</td>
                                    <td className="p-4 text-right">{r.saldo > 0 ? <span className="font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">$ {r.saldo.toLocaleString()}</span> : <span className="text-gray-400 font-medium">-</span>}</td>
                                    <td className="p-4 text-center"><button onClick={() => handleViewDetail(r)} className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all" title="Ver artículos"><Eye size={20} /></button></td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleReprint(r)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Reimprimir"><Printer size={18} /></button>
                                            {r.estado === 'pendiente' ? (
                                                <>
                                                    <button onClick={() => handleCancelar(r.id)} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Cancelar"><XCircle size={18} /></button>
                                                    <button onClick={() => openPayModal(r)} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-95" title="Cobrar"><DollarSign size={14} /> RETIRAR</button>
                                                </>
                                            ) : (
                                                <span className="text-gray-300 dark:text-gray-600 italic text-xs flex items-center justify-end"><CheckCircle size={14} className="mr-1" /> Completada</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && <div className="p-10 text-center text-gray-400 dark:text-gray-500">No se encontraron reservas.</div>}
            </div>
        </div>
    );
};

export default ReservationsPage;