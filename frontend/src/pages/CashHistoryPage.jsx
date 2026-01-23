import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    FileText, Download, Calendar, ChevronDown, ChevronRight,
    Printer, ArrowLeft, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CashHistoryPage = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);

    // Datos agrupados y estado de acordeones
    const [groupedSessions, setGroupedSessions] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get('/sales/caja/list');

                // Agrupar por Mes/Año (Ej: "11/2025")
                const groups = res.data.reduce((acc, session) => {
                    // Formato esperado de API: "DD/MM/YYYY HH:MM"
                    const datePart = session.cierre.split(' ')[0];
                    const parts = datePart.split('/');
                    const monthKey = `${parts[1]}/${parts[2]}`; // Clave: MM/YYYY

                    if (!acc[monthKey]) acc[monthKey] = [];
                    acc[monthKey].push(session);
                    return acc;
                }, {});

                setGroupedSessions(groups);

                // UX: Expandir automáticamente el mes actual (el primero de la lista)
                const firstKey = Object.keys(groups)[0];
                if (firstKey) setExpandedMonths({ [firstKey]: true });

            } catch (error) {
                console.error("Error historial:", error);
                toast.error("No se pudo cargar el historial.");
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchHistory();
    }, [token]);

    // --- MANEJADORES ---
    const toggleMonth = (month) => {
        setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    // Función para imprimir PDF seguro
    const handlePrintPdf = async (sessionId) => {
        const toastId = toast.loading("Generando reporte PDF...");
        try {
            const response = await api.get(`/sales/caja/${sessionId}/pdf`, {
                responseType: 'blob'
            });
            const file = new Blob([response.data], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            window.open(fileURL, '_blank');
            toast.success("Listo para imprimir", { id: toastId });
        } catch (error) {
            console.error(error);
            toast.error("Error al generar PDF", { id: toastId });
        }
    };

    // --- RENDERIZADO ---

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
            <Loader2 className="animate-spin mb-2 text-blue-600" size={32} />
            <p>Recuperando archivos...</p>
        </div>
    );

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 animate-fade-in">
            <Toaster position="top-center" />

            {/* HEADER CON NAVEGACIÓN */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                            <FileText className="text-blue-600" /> Historial de Cierres
                        </h1>
                        <p className="text-gray-500 text-sm">Auditoría y reportes de cajas anteriores</p>
                    </div>
                </div>
            </div>

            {/* LISTA DE SESIONES */}
            <div className="space-y-6">
                {Object.keys(groupedSessions).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
                        <FileText size={48} className="mb-4 opacity-20" />
                        <p className="font-medium">Aún no hay cierres de caja registrados.</p>
                    </div>
                ) : (
                    Object.keys(groupedSessions).map(monthKey => (
                        <div key={monthKey} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">

                            {/* CABECERA DEL MES (ACORDEÓN) */}
                            <div
                                onClick={() => toggleMonth(monthKey)}
                                className="p-5 bg-gray-50/50 flex justify-between items-center cursor-pointer hover:bg-blue-50/30 transition-colors select-none group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                        <Calendar size={20} />
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-700 block text-lg">Período: {monthKey}</span>
                                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                                            {groupedSessions[monthKey].length} Cierres registrados
                                        </span>
                                    </div>
                                </div>
                                <div className="text-gray-400">
                                    {expandedMonths[monthKey] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                            </div>

                            {/* TABLA DE DETALLES */}
                            {expandedMonths[monthKey] && (
                                <div className="overflow-x-auto border-t border-gray-100">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white text-gray-400 font-bold uppercase text-xs sticky top-0">
                                            <tr>
                                                <th className="p-4 pl-6">Fecha Cierre</th>
                                                <th className="p-4">Responsable / Apertura</th>
                                                <th className="p-4 text-right">Ventas Totales</th>
                                                <th className="p-4 text-center">Estado Caja</th>
                                                <th className="p-4 text-right pr-6">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {groupedSessions[monthKey].map(session => {
                                                const isPerfect = session.diferencia === 0;
                                                const isSurplus = session.diferencia > 0;

                                                return (
                                                    <tr key={session.id} className="hover:bg-slate-50 transition-colors group">

                                                        {/* FECHA */}
                                                        <td className="p-4 pl-6">
                                                            <div className="font-bold text-gray-800">{session.cierre}</div>
                                                            <div className="text-xs text-gray-400 font-mono">ID: #{session.id}</div>
                                                        </td>

                                                        {/* APERTURA */}
                                                        <td className="p-4">
                                                            <div className="text-gray-600 font-medium">Inició: {session.apertura}</div>
                                                            <div className="text-xs text-gray-400">Base: $ {session.monto_inicial?.toLocaleString()}</div>
                                                        </td>

                                                        {/* VENTAS */}
                                                        <td className="p-4 text-right font-mono font-bold text-slate-700 text-base">
                                                            $ {session.ventas.toLocaleString()}
                                                        </td>

                                                        {/* DIFERENCIA (Visualmente clara) */}
                                                        <td className="p-4 text-center">
                                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${isPerfect ? 'bg-green-50 text-green-700 border-green-100' :
                                                                    isSurplus ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                        'bg-red-50 text-red-700 border-red-100'
                                                                }`}>
                                                                {isPerfect && <CheckCircle2 size={12} className="mr-1.5" />}
                                                                {!isPerfect && <AlertCircle size={12} className="mr-1.5" />}

                                                                {isPerfect ? 'Perfecta' :
                                                                    isSurplus ? `+ $${session.diferencia.toLocaleString()}` :
                                                                        `- $${Math.abs(session.diferencia).toLocaleString()}`}
                                                            </div>
                                                        </td>

                                                        {/* BOTONES DE ACCIÓN */}
                                                        <td className="p-4 pr-6">
                                                            <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">

                                                                {/* Botón IMPRIMIR PDF */}
                                                                <button
                                                                    onClick={() => handlePrintPdf(session.id)}
                                                                    className="flex items-center justify-center p-2 text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-all shadow-sm"
                                                                    title="Ver Reporte PDF"
                                                                >
                                                                    <Printer size={18} />
                                                                </button>

                                                                {/* Botón DESCARGAR CSV */}
                                                                <a
                                                                    href={`${api.defaults.baseURL}/sales/caja/${session.id}/export`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center justify-center p-2 text-green-600 bg-white border border-gray-200 rounded-lg hover:bg-green-600 hover:text-white hover:border-green-600 transition-all shadow-sm"
                                                                    title="Descargar Excel/CSV"
                                                                >
                                                                    <Download size={18} />
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CashHistoryPage;