import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ShoppingCart, Package, BarChart3, Printer, Lock, Unlock,
    ArrowRight, TrendingUp, Clock, LayoutDashboard, Store,
    ArrowRightLeft, FileSpreadsheet, CalendarClock, Truck
} from 'lucide-react';

const DashboardPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // --- ESTADO DEL RELOJ ---
    const [currentTime, setCurrentTime] = useState(new Date());

    const [data, setData] = useState({
        financial: { hoy: 0, mes: 0, tickets: 0, caja_status: 'cerrada' },
        // Aunque el backend mande low_stock, ya no lo mostramos visualmente
    });

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/sales/dashboard/stats');
                setData(res.data);
            } catch (error) {
                console.error("Error dashboard", error);
            } finally {
                setLoading(false);
            }
        };
        if (api) fetchDashboard();

        // --- TEMPORIZADOR DEL RELOJ ---
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Formateo de Hora y Fecha
    const formattedTime = currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    if (loading) return (
        <div className="flex h-full items-center justify-center text-gray-400 p-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3"></div>
            Cargando...
        </div>
    );

    const cajaAbierta = data.financial.caja_status === 'abierta';

    return (
        <div className="h-full overflow-y-auto bg-gray-100 p-4 md:p-8 custom-scrollbar pb-24">

            {/* 1. HEADER: DATOS FINANCIEROS Y SALUDO */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 pb-6 mb-6">
                <div className="w-full md:w-auto">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight flex items-center">
                        Hola, {user?.nombre || 'Campeón'} 👋
                    </h1>
                    <div className="flex items-center text-gray-500 mt-1 font-medium text-xs md:text-sm">
                        <Clock size={14} className="mr-2 text-blue-600" />
                        <span className="capitalize">{formattedDate}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="font-mono text-gray-800 font-bold bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{formattedTime}</span>
                    </div>
                </div>

                {/* Widget Financiero */}
                <div className="w-full md:w-auto mt-4 md:mt-0 flex items-center bg-white border border-gray-200 rounded-2xl p-3 shadow-sm divide-x divide-gray-100">
                    <div className="px-4 text-center md:text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Ventas Hoy</p>
                        <p className="text-xl font-black text-gray-800">$ {data.financial.hoy.toLocaleString()}</p>
                    </div>
                    <div className="px-4 text-center md:text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mes Actual</p>
                        <p className="text-xl font-black text-blue-600">$ {data.financial.mes.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* 2. CENTRO DE CONTROL (PRINCIPALES) */}
            <div className="mb-6">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">Accesos Principales</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

                    {/* PTO VENTA (Gigante) */}
                    <Link to="/caja" className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg active:scale-[0.98] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                        <div className="relative z-10">
                            <div className="bg-white/10 w-fit p-3 rounded-2xl backdrop-blur-sm mb-4 border border-white/5">
                                <ShoppingCart size={28} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold">Punto de Venta</h3>
                            <p className="text-slate-400 text-sm mt-1 font-medium">Facturar y cobrar</p>
                        </div>
                        <ShoppingCart className="absolute -right-6 -bottom-6 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-500" size={180} />
                    </Link>

                    {/* BOTONES SECUNDARIOS */}
                    <Link to="/inventario" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                        <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center text-blue-600 mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Package size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Inventario</h3>
                            <p className="text-xs text-gray-400 font-medium">Control de Stock</p>
                        </div>
                    </Link>

                    <Link to="/caja-control" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-colors ${cajaAbierta ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white'}`}>
                            {cajaAbierta ? <Unlock size={22} /> : <Lock size={22} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Caja</h3>
                            <p className={`text-xs font-bold ${cajaAbierta ? 'text-emerald-600' : 'text-red-500'}`}>
                                {cajaAbierta ? 'Actualmente Abierta' : 'Turno Cerrado'}
                            </p>
                        </div>
                    </Link>

                    {/* Links Externos */}
                    <a href="https://campeones4.mitiendanube.com/admin/v2/dashboard/" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                        <div className="bg-sky-50 w-12 h-12 rounded-2xl flex items-center justify-center text-sky-600 mb-2 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                            <LayoutDashboard size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Admin Nube</h3>
                            <p className="text-xs text-gray-400 font-medium">Panel Web</p>
                        </div>
                    </a>

                    <a href="https://www.campeonesindumentaria.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                        <div className="bg-purple-50 w-12 h-12 rounded-2xl flex items-center justify-center text-purple-600 mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Store size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Ver Tienda</h3>
                            <p className="text-xs text-gray-400 font-medium">Sitio Online</p>
                        </div>
                    </a>

                    {/* Utilidades */}
                    <Link to="/etiquetas" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto group">
                        <div className="bg-orange-50 w-12 h-12 rounded-2xl flex items-center justify-center text-orange-600 mb-2 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <Printer size={22} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">Etiquetas</h3>
                            <p className="text-xs text-gray-400 font-medium">Códigos QR</p>
                        </div>
                    </Link>

                    <Link to="/reportes" className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden h-32 md:h-auto group">
                        <div className="relative z-10">
                            <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <BarChart3 size={22} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Reportes</h3>
                                <p className="text-xs text-gray-400 font-medium">Estadísticas</p>
                            </div>
                        </div>
                        <TrendingUp className="text-indigo-50 absolute -right-4 top-6 scale-[2.5] opacity-50 rotate-12 group-hover:text-indigo-100 transition-colors" />
                    </Link>

                </div>
            </div>

            {/* 3. ZONA DE GESTIÓN (REEMPLAZO DE ALERTAS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

                {/* NUEVO: PANEL DE ACCESOS DIRECTOS DE GESTIÓN */}
                <div className="lg:col-span-2">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">Gestión Operativa</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        <Link to="/cambios" className="flex items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <ArrowRightLeft size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Cambios y Devol.</h4>
                                <p className="text-xs text-gray-500">Gestionar devoluciones</p>
                            </div>
                            <div className="ml-auto bg-gray-50 p-2 rounded-full text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </Link>

                        <Link to="/presupuestos" className="flex items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Presupuestos</h4>
                                <p className="text-xs text-gray-500">Crear y guardar</p>
                            </div>
                            <div className="ml-auto bg-gray-50 p-2 rounded-full text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </Link>

                        <Link to="/reservas" className="flex items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <CalendarClock size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Reservas</h4>
                                <p className="text-xs text-gray-500">Ver señas activas</p>
                            </div>
                            <div className="ml-auto bg-gray-50 p-2 rounded-full text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </Link>

                        <Link to="/compras" className="flex items-center p-4 bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                                <Truck size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">Compras</h4>
                                <p className="text-xs text-gray-500">Reponer mercadería</p>
                            </div>
                            <div className="ml-auto bg-gray-50 p-2 rounded-full text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <ArrowRight size={16} />
                            </div>
                        </Link>

                    </div>
                </div>

                {/* RESUMEN RÁPIDO (LATERAL) */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center h-full min-h-[200px] shadow-xl">
                    <h3 className="font-bold text-lg mb-6 relative z-10 flex items-center">
                        Resumen Rápido
                    </h3>

                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <span className="text-slate-400 text-sm font-medium">Tickets Emitidos</span>
                            <span className="text-3xl font-black text-emerald-400">{data.financial.tickets}</span>
                        </div>

                        <div className="pt-2">
                            <Link to="/caja-control" className="w-full bg-white text-slate-900 py-3.5 rounded-xl font-bold flex justify-center items-center hover:bg-slate-200 active:scale-95 transition-all shadow-lg text-sm">
                                Ir al Arqueo <ArrowRight size={16} className="ml-2" />
                            </Link>
                        </div>
                    </div>
                    {/* Fondo decorativo */}
                    <TrendingUp className="absolute -right-4 top-10 text-white/5" size={180} />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;