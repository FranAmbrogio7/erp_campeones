import { useEffect, useState, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ShoppingCart, Package, BarChart3, Printer, Lock, Unlock,
    ArrowRight, TrendingUp, Clock, LayoutDashboard, Store,
    ArrowRightLeft, FileSpreadsheet, CalendarClock, Truck,
    Globe, Tag
} from 'lucide-react';

const DashboardPage = () => {
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(true);

    // --- IDENTIDAD DE VISTA ---
    const [tipoCajaFiltro, setTipoCajaFiltro] = useState('GLOBAL');
    const isMerch = tipoCajaFiltro === 'MERCHANDISING';
    const isCamp = tipoCajaFiltro === 'PRINCIPAL';

    // --- ESTADO DEL RELOJ ---
    const [currentTime, setCurrentTime] = useState(new Date());

    const [data, setData] = useState({
        financial: { hoy: 0, mes: 0, tickets: 0, caja_status: 'cerrada' },
    });

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/sales/dashboard/stats', {
                params: { tipo_caja: tipoCajaFiltro }
            });
            setData(res.data);
        } catch (error) {
            console.error("Error dashboard", error);
        } finally {
            setLoading(false);
        }
    }, [tipoCajaFiltro]);

    useEffect(() => {
        if (token) fetchDashboard();
    }, [token, fetchDashboard]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formattedTime = currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    if (loading) return (
        <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-950 transition-colors">
            <div className={`animate-spin h-10 w-10 border-4 border-t-transparent rounded-full mb-4 ${isMerch ? 'border-purple-500' : isCamp ? 'border-indigo-500' : 'border-blue-500'}`}></div>
            <p className="font-bold text-sm uppercase tracking-widest">Sincronizando métricas...</p>
        </div>
    );

    const cajaAbierta = data.financial.caja_status === 'abierta';

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-gray-50 dark:bg-slate-950 p-4 md:p-6 custom-scrollbar pb-24 transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto">
                
                {/* 1. HEADER: DATOS FINANCIEROS, SALUDO Y SELECTOR */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-gray-200 dark:border-slate-800 pb-6 mb-6 gap-6">
                    <div className="w-full xl:w-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-white tracking-tight flex items-center transition-colors">
                                Hola, {user?.nombre || 'Campeón'}
                            </h1>
                            <div className="flex flex-wrap items-center text-gray-500 dark:text-slate-400 mt-1 font-bold text-xs uppercase tracking-widest transition-colors">
                                <Clock size={14} className={`mr-1.5 ${isMerch ? 'text-purple-500' : isCamp ? 'text-indigo-500' : 'text-blue-500'}`} />
                                <span className="capitalize">{formattedDate}</span>
                                <span className="mx-2 opacity-30">|</span>
                                <span className="font-mono text-gray-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
                                    {formattedTime}
                                </span>
                            </div>
                        </div>

                        {/* SELECTOR DE VISTA (GLOBAL / CAMPEONES / MERCH) */}
                        <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm w-full md:w-auto overflow-x-auto">
                            <button 
                                onClick={() => setTipoCajaFiltro('GLOBAL')}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoCajaFiltro === 'GLOBAL' ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                <Globe size={14} /> Global
                            </button>
                            <button 
                                onClick={() => setTipoCajaFiltro('PRINCIPAL')}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isCamp ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                <Store size={14} /> Campeones
                            </button>
                            <button 
                                onClick={() => setTipoCajaFiltro('MERCHANDISING')}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isMerch ? 'bg-purple-50 dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                <Tag size={14} /> Merch
                            </button>
                        </div>
                    </div>

                    {/* Widget Financiero */}
                    <div className="w-full xl:w-auto flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm divide-x divide-gray-100 dark:divide-slate-700 transition-colors">
                        <div className="px-5 text-center md:text-left">
                            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Ventas Hoy</p>
                            <p className="text-2xl font-black text-gray-800 dark:text-white font-mono tracking-tighter transition-colors">$ {data.financial.hoy.toLocaleString()}</p>
                        </div>
                        <div className="px-5 text-center md:text-left">
                            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Mes Actual</p>
                            <p className={`text-2xl font-black font-mono tracking-tighter transition-colors ${isMerch ? 'text-purple-600 dark:text-purple-400' : isCamp ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-600 dark:text-blue-400'}`}>$ {data.financial.mes.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                {/* 2. CENTRO DE CONTROL (PRINCIPALES) */}
                <div className="mb-6">
                    <h2 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2 transition-colors">Accesos Principales</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

                        {/* PTO VENTA (Gigante) */}
                        <Link to="/caja" className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 text-white p-6 rounded-3xl shadow-lg active:scale-[0.98] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[160px] border border-slate-700">
                            <div className="relative z-10">
                                <div className="bg-white/10 w-fit p-3.5 rounded-2xl backdrop-blur-sm mb-4 border border-white/5 shadow-inner">
                                    <ShoppingCart size={28} className="text-white" />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight">Punto de Venta</h3>
                                <p className="text-slate-400 text-sm mt-1 font-bold">Facturar y cobrar</p>
                            </div>
                            <ShoppingCart className="absolute -right-6 -bottom-6 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-500" size={180} />
                        </Link>

                        {/* Inventario */}
                        <Link to="/inventario" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                            <div className="bg-blue-50 dark:bg-slate-900/50 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-100 dark:border-slate-700">
                                <Package size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Inventario</h3>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Control Stock</p>
                            </div>
                        </Link>

                        {/* Caja */}
                        <Link to="/caja-control" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-colors border ${cajaAbierta ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50 group-hover:bg-emerald-500 group-hover:text-white' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50 group-hover:bg-red-500 group-hover:text-white'}`}>
                                {cajaAbierta ? <Unlock size={22} /> : <Lock size={22} />}
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Caja</h3>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${cajaAbierta ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} transition-colors`}>
                                    {cajaAbierta ? 'Operativa' : 'Cerrada'}
                                </p>
                            </div>
                        </Link>

                        {/* Admin Nube */}
                        <a href="https://campeones4.mitiendanube.com/admin/v2/dashboard/" target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700 active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                            <div className="bg-sky-50 dark:bg-slate-900/50 w-12 h-12 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 mb-2 group-hover:bg-sky-500 group-hover:text-white transition-colors border border-sky-100 dark:border-slate-700">
                                <LayoutDashboard size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Admin Nube</h3>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Panel Web</p>
                            </div>
                        </a>

                        {/* Ver Tienda */}
                        <a href="https://www.campeonesindumentaria.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-fuchsia-300 dark:hover:border-fuchsia-700 active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                            <div className="bg-fuchsia-50 dark:bg-slate-900/50 w-12 h-12 rounded-2xl flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400 mb-2 group-hover:bg-fuchsia-500 group-hover:text-white transition-colors border border-fuchsia-100 dark:border-slate-700">
                                <Store size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Ver Tienda</h3>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Sitio Online</p>
                            </div>
                        </a>

                        {/* Etiquetas */}
                        <Link to="/etiquetas" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                            <div className="bg-orange-50 dark:bg-slate-900/50 w-12 h-12 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-2 group-hover:bg-orange-500 group-hover:text-white transition-colors border border-orange-100 dark:border-slate-700">
                                <Printer size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Etiquetas</h3>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Códigos QR</p>
                            </div>
                        </Link>

                        {/* Reportes */}
                        <Link to="/reportes" className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden h-32 md:h-auto group">
                            <div className="relative z-10">
                                <div className="bg-indigo-50 dark:bg-slate-900/50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2 group-hover:bg-indigo-500 group-hover:text-white transition-colors border border-indigo-100 dark:border-slate-700">
                                    <BarChart3 size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-800 dark:text-white text-lg transition-colors">Reportes</h3>
                                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest transition-colors">Estadísticas</p>
                                </div>
                            </div>
                            <TrendingUp className="text-indigo-50 dark:text-slate-700/30 absolute -right-4 top-6 scale-[2.5] opacity-50 rotate-12 group-hover:text-indigo-100 dark:group-hover:text-indigo-900 transition-colors" />
                        </Link>

                    </div>
                </div>

                {/* 3. ZONA DE GESTIÓN Y RESUMEN */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

                    {/* PANEL DE ACCESOS DIRECTOS DE GESTIÓN */}
                    <div className="lg:col-span-2">
                        <h2 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2 transition-colors">Gestión Operativa</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                            <Link to="/cambios" className="flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group">
                                <div className="w-12 h-12 bg-red-50 dark:bg-slate-900/50 text-red-500 dark:text-red-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-red-100 dark:border-slate-700">
                                    <ArrowRightLeft size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 dark:text-white transition-colors">Cambios y Devol.</h4>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 mt-0.5 transition-colors">Reemplazos</p>
                                </div>
                                <div className="ml-auto bg-gray-50 dark:bg-slate-900 p-2 rounded-full text-gray-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors border border-gray-200 dark:border-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                                    <ArrowRight size={16} />
                                </div>
                            </Link>

                            <Link to="/presupuestos" className="flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group">
                                <div className="w-12 h-12 bg-yellow-50 dark:bg-slate-900/50 text-yellow-600 dark:text-yellow-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-yellow-100 dark:border-slate-700">
                                    <FileSpreadsheet size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 dark:text-white transition-colors">Presupuestos</h4>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 mt-0.5 transition-colors">Cotizaciones</p>
                                </div>
                                <div className="ml-auto bg-gray-50 dark:bg-slate-900 p-2 rounded-full text-gray-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors border border-gray-200 dark:border-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                                    <ArrowRight size={16} />
                                </div>
                            </Link>

                            <Link to="/reservas" className="flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group">
                                <div className="w-12 h-12 bg-purple-50 dark:bg-slate-900/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-purple-100 dark:border-slate-700">
                                    <CalendarClock size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 dark:text-white transition-colors">Reservas</h4>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 mt-0.5 transition-colors">Señas Activas</p>
                                </div>
                                <div className="ml-auto bg-gray-50 dark:bg-slate-900 p-2 rounded-full text-gray-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors border border-gray-200 dark:border-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                                    <ArrowRight size={16} />
                                </div>
                            </Link>

                            <Link to="/compras" className="flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all group">
                                <div className="w-12 h-12 bg-teal-50 dark:bg-slate-900/50 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform border border-teal-100 dark:border-slate-700">
                                    <Truck size={24} />
                                </div>
                                <div>
                                    <h4 className="font-black text-gray-800 dark:text-white transition-colors">Compras</h4>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-slate-400 mt-0.5 transition-colors">Mercadería</p>
                                </div>
                                <div className="ml-auto bg-gray-50 dark:bg-slate-900 p-2 rounded-full text-gray-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors border border-gray-200 dark:border-slate-700 group-hover:border-blue-200 dark:group-hover:border-blue-800/50">
                                    <ArrowRight size={16} />
                                </div>
                            </Link>

                        </div>
                    </div>

                    {/* RESUMEN RÁPIDO (LATERAL) */}
                    <div className="bg-slate-900 dark:bg-slate-800/50 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center h-full min-h-[200px] shadow-xl border border-slate-700 dark:border-slate-800">
                        <h3 className="font-black text-lg mb-6 relative z-10 flex items-center tracking-tight">
                            Resumen Día
                        </h3>

                        <div className="space-y-6 relative z-10">
                            <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Tickets Emitidos</span>
                                <span className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">{data.financial.tickets}</span>
                            </div>

                            <div className="pt-2">
                                <Link to="/caja-control" className="w-full bg-white text-slate-900 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex justify-center items-center hover:bg-slate-200 active:scale-95 transition-all shadow-lg">
                                    Ir al Arqueo <ArrowRight size={16} className="ml-2" />
                                </Link>
                            </div>
                        </div>
                        <TrendingUp className="absolute -right-4 top-10 text-white/5" size={180} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;