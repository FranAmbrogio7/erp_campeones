import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    CalendarClock, Search, CheckCircle, XCircle, DollarSign,
    Phone, Eye, Printer, AlertTriangle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print'; // <--- 1. Importar librería
import ReservationDetailsModal from '../components/ReservationDetailsModal';
import Ticket from '../components/Ticket'; // <--- 2. Importar Ticket

const ReservationsPage = () => {
    const { token } = useAuth();
    const [reservas, setReservas] = useState([]);
    const [filter, setFilter] = useState('');

    // Estados para el Modal de Detalle
    const [selectedReserva, setSelectedReserva] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // --- LÓGICA DE IMPRESIÓN ---
    const [ticketData, setTicketData] = useState(null);
    const ticketRef = useRef(null);

    const reactToPrintFn = useReactToPrint({
        contentRef: ticketRef, // Versión corregida para React moderno
    });

    const handleReprint = (reserva) => {
        // Adaptamos los datos de la reserva al formato que espera el componente Ticket
        const dataForTicket = {
            id_venta: `RES-${reserva.id}`, // Prefijo para distinguir
            fecha: reserva.fecha || new Date().toLocaleDateString(),
            items: reserva.items || [], // Asumimos que el backend trae los items, si no, saldrá vacío
            total: reserva.total,
            cliente: reserva.cliente,
            metodo: `Seña: $${reserva.sena} (Saldo: $${reserva.saldo})`, // Mostramos el estado del pago
            tipo: 'RESERVA' // Flag opcional si tu Ticket lo soporta
        };

        setTicketData(dataForTicket);

        // Esperamos a que se renderice el ticket oculto
        setTimeout(() => {
            if (reactToPrintFn) reactToPrintFn();
        }, 150);
    };
    // ---------------------------

    const fetchReservas = async () => {
        try {
            const res = await axios.get('/api/sales/reservas', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReservas(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { if (token) fetchReservas(); }, [token]);

    const handleRetirar = async (id, saldo) => {
        if (!window.confirm(`¿Confirmar retiro? Se ingresarán $${saldo.toLocaleString()} a la caja.`)) return;
        try {
            await axios.post(`/api/sales/reservas/${id}/retirar`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("Reserva retirada correctamente");
            fetchReservas();
        } catch (e) { toast.error(e.response?.data?.msg || "Error"); }
    };

    const handleCancelar = async (id) => {
        if (!window.confirm("¿Cancelar reserva? El stock volverá al inventario.")) return;
        try {
            await axios.post(`/api/sales/reservas/${id}/cancelar`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Toaster position="top-center" />

            {/* --- TICKET OCULTO --- */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}>
                    <Ticket saleData={ticketData} />
                </div>
            </div>

            {/* MODAL DE DETALLE */}
            <ReservationDetailsModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                reserva={selectedReserva}
            />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <CalendarClock className="mr-3 text-purple-600" /> Reservas
                    </h1>
                    <p className="text-gray-500 text-sm">Gestiona señas, pedidos apartados y saldos pendientes.</p>
                </div>

                {/* Buscador */}
                <div className="relative w-full md:w-auto">
                    <input
                        placeholder="Buscar cliente o teléfono..."
                        className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-72 focus:ring-2 focus:ring-purple-500 outline-none shadow-sm"
                        value={filter} onChange={e => setFilter(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
            </div>

            {/* Tabla */}
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
                                        <button
                                            onClick={() => handleViewDetail(r)}
                                            className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full transition-all"
                                            title="Ver artículos reservados"
                                        >
                                            <Eye size={20} />
                                        </button>
                                    </td>

                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* --- BOTÓN IMPRIMIR --- */}
                                            <button
                                                onClick={() => handleReprint(r)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                title="Reimprimir Comprobante"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            {/* ---------------------- */}

                                            {r.estado === 'pendiente' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleCancelar(r.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Cancelar y devolver stock"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRetirar(r.id, r.saldo)}
                                                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-95"
                                                        title="Cobrar saldo y entregar"
                                                    >
                                                        <DollarSign size={14} /> RETIRAR
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-gray-300 italic text-xs flex items-center justify-end">
                                                    <CheckCircle size={14} className="mr-1" /> Completada
                                                </span>
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