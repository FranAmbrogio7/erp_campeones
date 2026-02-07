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
    const [reservaToPay, setReservaToPay] = useState(null); // La reserva que se está cobrando
    const [selectedMethodId, setSelectedMethodId] = useState('');
    // ------------------------------------

    // Estados para el Modal de Detalle
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

    // 1. CARGAR DATOS (Reservas y Medios de Pago)
    const fetchReservas = async () => {
        try {
            const res = await axios.get('/api/sales/reservas', { headers: { Authorization: `Bearer ${token}` } });
            setReservas(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (token) {
            fetchReservas();
            // Cargar métodos de pago para el modal
            api.get('/sales/payment-methods').then(res => setPaymentMethods(res.data)).catch(console.error);
        }
    }, [token]);


    // 2. ABRIR MODAL DE COBRO
    const openPayModal = (reserva) => {
        setReservaToPay(reserva);
        setSelectedMethodId(''); // Reiniciar selección
        setIsPayModalOpen(true);
    };

    // 3. CONFIRMAR RETIRO (Enviando el pago)
    const handleConfirmRetiro = async (e) => {
        e.preventDefault();
        if (!reservaToPay) return;

        // Si hay saldo, el pago es obligatorio
        if (reservaToPay.saldo > 0 && !selectedMethodId) {
            return toast.error("Selecciona un método de pago");
        }

        const toastId = toast.loading("Procesando retiro...");
        try {
            await axios.post(`/api/sales/reservas/${reservaToPay.id}/retirar`,
                { id_metodo_pago: selectedMethodId }, // <--- AQUÍ ENVIAMOS EL DATO QUE FALTABA
                { headers: { Authorization: `Bearer ${token}` } }
            );

            toast.success("Reserva retirada y venta registrada", { id: toastId });
            setIsPayModalOpen(false);
            setReservaToPay(null);
            fetchReservas(); // Recargar lista
        } catch (e) {
            toast.error(e.response?.data?.msg || "Error al retirar", { id: toastId });
        }
    };

    const handleCancelar = async (id) => {
        if (!window.confirm("¿Cancelar reserva? El stock volverá al inventario.")) return;
        try {
            await axios.post(`/api/sales/reservas/${id}/cancelar`, {}, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Reserva cancelada");
            fetchReservas();
        } catch (e) { toast.error("Error cancelando"); }
    };

    const handleViewDetail = (reserva) => {
        setSelectedReserva(reserva);
        setIsDetailOpen(true);
    };

    // Filtro visual
    const filtered = reservas.filter(r =>
        r.cliente.toLowerCase().includes(filter.toLowerCase()) ||
        (r.telefono && r.telefono.includes(filter))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
            <Toaster position="top-center" />

            {/* TICKET OCULTO */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}><Ticket saleData={ticketData} /></div>
            </div>

            {/* MODAL DE DETALLE (Existente) */}
            <ReservationDetailsModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                reserva={selectedReserva}
            />

            {/* --- NUEVO: MODAL DE COBRO DE SALDO --- */}
            {isPayModalOpen && reservaToPay && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center">
                                <DollarSign className="mr-2" /> Cobrar Saldo
                            </h3>
                            <button onClick={() => setIsPayModalOpen(false)} className="hover:bg-green-700 p-1 rounded-full"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleConfirmRetiro} className="p-6">
                            <div className="mb-6 text-center">
                                <p className="text-gray-500 text-sm uppercase font-bold mb-1">Total a Pagar</p>
                                <p className="text-4xl font-black text-gray-800">$ {reservaToPay.saldo.toLocaleString()}</p>
                                <p className="text-xs text-gray-400 mt-2">Cliente: {reservaToPay.cliente}</p>
                            </div>

                            {reservaToPay.saldo > 0 ? (
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Selecciona Medio de Pago</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {paymentMethods.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setSelectedMethodId(m.id)}
                                                className={`p-3 rounded-xl border-2 flex flex-col items-center transition-all ${selectedMethodId === m.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-100 hover:border-gray-300 text-gray-500'}`}
                                            >
                                                {m.nombre.toLowerCase().includes('tarjeta') ? <CreditCard size={20} /> : <Banknote size={20} />}
                                                <span className="text-xs font-bold mt-1">{m.nombre}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-green-50 p-3 rounded-lg text-center text-green-700 font-bold mb-6">
                                    ¡Saldo cubierto! Solo confirmar retiro.
                                </div>
                            )}

                            <button type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-transform active:scale-95 shadow-lg">
                                CONFIRMAR RETIRO
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* CABECERA */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <CalendarClock className="mr-3 text-purple-600" /> Reservas
                    </h1>
                    <p className="text-gray-500 text-sm">Gestiona señas, pedidos apartados y saldos pendientes.</p>
                </div>
                <div className="relative w-full md:w-auto">
                    <input
                        placeholder="Buscar cliente o teléfono..."
                        className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-72 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
                        value={filter} onChange={e => setFilter(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            {/* TABLA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs border-b">
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
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(r => (
                                <tr key={r.id} className="hover:bg-purple-50/20 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800">{r.cliente}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                            <Phone size={12} className="text-gray-400" /> {r.telefono || '-'}
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${r.estado === 'pendiente' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                r.estado === 'retirada' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    'bg-gray-100 text-gray-500 border-gray-200'
                                                }`}>
                                                {r.estado}
                                            </span>

                                            {r.estado === 'pendiente' && r.is_vencida && (
                                                <span className="flex items-center text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 animate-pulse">
                                                    <AlertTriangle size={10} className="mr-1" /> VENCIDA
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            Vence: {r.vencimiento}
                                        </div>
                                    </td>

                                    <td className="p-4 text-right font-medium text-gray-600">$ {r.total.toLocaleString()}</td>
                                    <td className="p-4 text-right text-green-600 font-medium">$ {r.sena.toLocaleString()}</td>
                                    <td className="p-4 text-right">
                                        {r.saldo > 0 ? (
                                            <span className="font-black text-red-600 bg-red-50 px-2 py-1 rounded">
                                                $ {r.saldo.toLocaleString()}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 font-medium">-</span>
                                        )}
                                    </td>

                                    {/* BOTÓN VER DETALLE */}
                                    <td className="p-4 text-center">
                                        <button onClick={() => handleViewDetail(r)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full transition-all" title="Ver artículos reservados"><Eye size={20} /></button>
                                    </td>

                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleReprint(r)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="Reimprimir Comprobante"><Printer size={18} /></button>

                                            {r.estado === 'pendiente' ? (
                                                <>
                                                    <button onClick={() => handleCancelar(r.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Cancelar y devolver stock"><XCircle size={18} /></button>

                                                    {/* BOTÓN RETIRAR AHORA ABRE MODAL */}
                                                    <button
                                                        onClick={() => openPayModal(r)}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-95"
                                                        title="Cobrar saldo y entregar"
                                                    >
                                                        <DollarSign size={14} /> RETIRAR
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-gray-300 italic text-xs flex items-center justify-end"><CheckCircle size={14} className="mr-1" /> Completada</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && <div className="p-10 text-center text-gray-400">No se encontraron reservas.</div>}
            </div>
        </div>
    );
};

export default ReservationsPage;