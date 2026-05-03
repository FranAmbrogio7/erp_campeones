import { useEffect, useState, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    FileText, Download, Calendar, ChevronDown, ChevronRight,
    Printer, ArrowLeft, Loader2, AlertCircle, CheckCircle2,
    Store, Tag
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CashHistoryPage = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);

    // --- IDENTIDAD DE TERMINAL (Por defecto lee la última usada) ---
    const [tipoCajaFiltro, setTipoCajaFiltro] = useState(() => {
        return localStorage.getItem('terminal_tipo_caja') || 'PRINCIPAL';
    });
    const isMerch = tipoCajaFiltro === 'MERCHANDISING';

    // Datos agrupados y estado de acordeones
    const [groupedSessions, setGroupedSessions] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});

    // --- CARGA DE DATOS ---
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            // Enviamos el tipo de caja al backend para que filtre
            const res = await api.get('/sales/caja/list', {
                params: { tipo_caja: tipoCajaFiltro }
            });

            // Agrupar por Mes/Año (Ej: "11/2025")
            const groups = res.data.reduce((acc, session) => {
                const datePart = session.cierre.split(' ')[0];
                const parts = datePart.split('/');
                const monthKey = `${parts[1]}/${parts[2]}`; // Clave: MM/YYYY

                if (!acc[monthKey]) acc[monthKey] = [];
                acc[monthKey].push(session);
                return acc;
            }, {});

            setGroupedSessions(groups);

            // Expandir automáticamente el mes más reciente (el primero)
            const firstKey = Object.keys(groups)[0];
            if (firstKey) setExpandedMonths({ [firstKey]: true });
            else setExpandedMonths({});

        } catch (error) {
            console.error("Error historial:", error);
            toast.error("No se pudo cargar el historial.");
        } finally {
            setLoading(false);
        }
    }, [tipoCajaFiltro]);

    useEffect(() => {
        if (token) fetchHistory();
    }, [token, fetchHistory]);

    // --- MANEJADORES ---
    const toggleMonth = (month) => {
        setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

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
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-gray-400 dark:text-gray-600 bg-slate-50 dark:bg-slate-950">
            <Loader2 className={`animate-spin mb-4 ${isMerch ? 'text-purple-600' : 'text-indigo-600'}`} size={48} />
            <p className="font-bold tracking-widest uppercase text-sm">Recuperando archivos...</p>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] transition-colors duration-300">
            <Toaster position="top-center" />

            {/* HEADER CON NAVEGACIÓN Y SELECTOR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                    <Link to="/caja" className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                            <FileText className={isMerch ? 'text-purple-500' : 'text-indigo-500'} size={28} /> 
                            Historial de Cierres
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Auditoría y reportes de cajas anteriores</p>
                    </div>
                </div>

                {/* SELECTOR DE TERMINAL */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                    <button 
                        onClick={() => setTipoCajaFiltro('PRINCIPAL')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!isMerch ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Store size={14} /> Campeones
                    </button>
                    <button 
                        onClick={() => setTipoCajaFiltro('MERCHANDISING')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isMerch ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Tag size={14} /> Merch
                    </button>
                </div>
            </div>

            {/* LISTA DE SESIONES */}
            <div className="space-y-4">
                {Object.keys(groupedSessions).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 transition-colors">
                        <FileText size={64} className="mb-4 opacity-30" />
                        <p className="font-bold text-sm uppercase tracking-widest">Aún no hay cierres registrados en esta terminal.</p>
                    </div>
                ) : (
                    Object.keys(groupedSessions).map(monthKey => (
                        <div key={monthKey} className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 ${expandedMonths[monthKey] ? (isMerch ? 'border-purple-300 dark:border-purple-800 shadow-md' : 'border-indigo-300 dark:border-indigo-800 shadow-md') : 'border-slate-200 dark:border-slate-800'}`}>

                            {/* CABECERA DEL MES (ACORDEÓN) */}
                            <div
                                onClick={() => toggleMonth(monthKey)}
                                className={`p-5 flex justify-between items-center cursor-pointer select-none group transition-colors ${isMerch ? 'hover:bg-purple-50 dark:hover:bg-purple-900/10' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl shadow-inner transition-transform group-hover:scale-105 ${isMerch ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'}`}>
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <span className="font-black text-slate-800 dark:text-white block text-lg tracking-tight">Período: {monthKey}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5 block">
                                            {groupedSessions[monthKey].length} Cierres registrados
                                        </span>
                                    </div>
                                </div>
                                <div className={`transition-transform duration-300 ${expandedMonths[monthKey] ? 'rotate-180 text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                    <ChevronDown size={24} />
                                </div>
                            </div>

                            {/* TABLA DE DETALLES */}
                            {expandedMonths[monthKey] && (
                                <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest sticky top-0">
                                            <tr>
                                                <th className="p-4 pl-6">Fecha Cierre</th>
                                                <th className="p-4">Apertura</th>
                                                <th className="p-4 text-right">Ventas Sistema</th>
                                                <th className="p-4 text-center">Auditoría Efectivo</th>
                                                <th className="p-4 text-right pr-6">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {groupedSessions[monthKey].map(session => {
                                                const isPerfect = session.diferencia === 0;
                                                const isSurplus = session.diferencia > 0;

                                                return (
                                                    <tr key={session.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">

                                                        {/* FECHA CIERRE */}
                                                        <td className="p-4 pl-6">
                                                            <div className="font-black text-slate-800 dark:text-white">{session.cierre}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID SESIÓN: #{session.id}</div>
                                                        </td>

                                                        {/* APERTURA */}
                                                        <td className="p-4">
                                                            <div className="text-slate-600 dark:text-slate-300 font-bold text-xs">{session.apertura}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Base Cajón: $ {session.monto_inicial?.toLocaleString()}</div>
                                                        </td>

                                                        {/* VENTAS */}
                                                        <td className="p-4 text-right font-mono font-black text-slate-800 dark:text-white text-base">
                                                            $ {session.ventas.toLocaleString()}
                                                        </td>

                                                        {/* DIFERENCIA */}
                                                        <td className="p-4 text-center">
                                                            <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm border ${
                                                                isPerfect 
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                                isSurplus 
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                                                                'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                                                                }`}>
                                                                {isPerfect && <CheckCircle2 size={14} className="mr-1.5" />}
                                                                {!isPerfect && <AlertCircle size={14} className="mr-1.5" />}

                                                                {isPerfect ? 'Cuadre Perfecto' :
                                                                    isSurplus ? `Sobrante: +$${session.diferencia.toLocaleString()}` :
                                                                    `Faltante: -$${Math.abs(session.diferencia).toLocaleString()}`}
                                                            </div>
                                                        </td>

                                                        {/* BOTONES DE ACCIÓN */}
                                                        <td className="p-4 pr-6">
                                                            <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">

                                                                <button
                                                                    onClick={() => handlePrintPdf(session.id)}
                                                                    className="flex items-center justify-center p-2.5 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white hover:border-slate-800 dark:hover:bg-slate-700 dark:hover:text-white transition-all shadow-sm"
                                                                    title="Ver Reporte PDF"
                                                                >
                                                                    <Printer size={18} />
                                                                </button>

                                                                <a
                                                                    href={`${api.defaults.baseURL}/sales/caja/${session.id}/export`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center justify-center p-2.5 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 dark:hover:bg-emerald-600 dark:hover:text-white transition-all shadow-sm"
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