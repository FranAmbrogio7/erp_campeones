import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ShoppingCart, Package, BarChart3, Printer, Lock, Unlock,
    ArrowRight, AlertCircle, TrendingUp, Clock, Globe, ExternalLink,
    LayoutDashboard, Store
} from 'lucide-react';

const DashboardPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    // --- ESTADO DEL RELOJ ---
    const [currentTime, setCurrentTime] = useState(new Date());

    const [data, setData] = useState({
        financial: { hoy: 0, mes: 0, tickets: 0, caja_status: 'cerrada' },
        low_stock: [],
        recent_activity: []
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
        // Padding lateral reducido en móvil (px-4) y aumentado en PC (md:px-0)
        // Padding inferior extra (pb-24) para scroll en móviles
        <div className="h-full overflow-y-auto bg-gray-100 p-4 md:p-8 custom-scrollbar">
            {/* 1. HEADER: ADAPTABLE */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-4 md:pb-6">
                <div className="w-full md:w-auto">
                    {/* Título un poco más chico en móvil para que no ocupe tanto */}
                    <h1 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight flex items-center">
                        Hola, {user?.nombre || 'Campeón'} 👋
                    </h1>

                    <div className="flex items-center text-gray-500 mt-1 font-medium text-xs md:text-sm">
                        <Clock size={14} className="mr-2 text-blue-600" />
                        <span className="capitalize">{formattedDate}</span>
                        <span className="mx-2">|</span>
                        <span className="font-mono text-gray-800 font-bold bg-gray-100 px-2 rounded">{formattedTime}</span>
                    </div>
                </div>

                {/* WIDGET FINANCIERO: FULL WIDTH EN MÓVIL */}
                <div className="w-full md:w-auto mt-4 md:mt-0 flex items-center justify-between md:justify-start bg-white border border-gray-200 rounded-2xl p-3 md:p-2 shadow-sm">
                    <div className="flex-1 md:flex-none px-2 md:px-6 border-r border-gray-100 text-center md:text-left">
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">Ventas Hoy</p>
                        <p className="text-lg md:text-xl font-black text-gray-800">$ {data.financial.hoy.toLocaleString()}</p>
                    </div>
                    <div className="flex-1 md:flex-none px-2 md:px-6 text-center md:text-left">
                        <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase">Mes Actual</p>
                        <p className="text-lg md:text-xl font-black text-blue-600">$ {data.financial.mes.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* 2. ACCESOS RÁPIDOS (GRID) */}
            <div>
                <h2 className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 md:mb-4">Centro de Control</h2>

                {/* Grid gap reducido en móvil (gap-3) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

                    {/* PTO VENTA (Gigante) - Touch Friendly */}
                    <Link
                        to="/caja"
                        className="col-span-2 bg-gradient-to-br from-slate-800 to-black text-white p-5 md:p-6 rounded-3xl shadow-xl active:scale-[0.98] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[140px] md:min-h-[160px]"
                    >
                        <div className="relative z-10">
                            <div className="bg-white/10 w-fit p-2.5 md:p-3 rounded-2xl backdrop-blur-sm mb-3 md:mb-4">
                                <ShoppingCart size={28} className="text-white" />
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold">Punto de Venta</h3>
                            <p className="text-slate-300 text-xs md:text-sm mt-1">Iniciar nueva operación</p>
                        </div>
                        <ShoppingCart className="absolute -right-6 -bottom-6 text-white/5 rotate-12" size={160} />
                    </Link>

                    {/* BOTONES SECUNDARIOS: Padding ajustado y efecto 'active' */}
                    <Link to="/inventario" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto">
                        <div className="bg-blue-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-blue-600 mb-2">
                            <Package size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm md:text-lg">Inventario</h3>
                            <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Gestionar stock</p>
                        </div>
                    </Link>

                    <Link to="/caja-control" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all relative overflow-hidden flex flex-col justify-between h-32 md:h-auto">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-2 ${cajaAbierta ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {cajaAbierta ? <Unlock size={20} /> : <Lock size={20} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm md:text-lg">Caja</h3>
                            <p className={`text-[10px] md:text-xs font-bold ${cajaAbierta ? 'text-green-600' : 'text-red-500'}`}>
                                {cajaAbierta ? 'Abierta' : 'Cerrada'}
                            </p>
                        </div>
                    </Link>

                    {/* --- BOTONES WEB --- */}
                    <a href="https://campeones4.mitiendanube.com/admin/v2/dashboard/" target="_blank" rel="noopener noreferrer" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto">
                        <div className="bg-sky-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sky-600 mb-2">
                            <LayoutDashboard size={20} />
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 text-sm md:text-lg">Admin Web</h3>
                            </div>
                            <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Tienda Nube</p>
                        </div>
                    </a>

                    <a href="https://www.campeonesindumentaria.com.ar/" target="_blank" rel="noopener noreferrer" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto">
                        <div className="bg-sky-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-sky-600 mb-2">
                            <Store size={20} />
                        </div>
                        <div>
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800 text-sm md:text-lg">Ver Tienda</h3>
                            </div>
                            <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Sitio Online</p>
                        </div>
                    </a>

                    {/* --- UTILIDADES --- */}
                    <Link to="/etiquetas" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between h-32 md:h-auto">
                        <div className="bg-orange-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-orange-600 mb-2">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-sm md:text-lg">Etiquetas</h3>
                            <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Imprimir</p>
                        </div>
                    </Link>

                    <Link to="/reportes" className="bg-white p-4 md:p-6 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-all flex flex-col justify-between relative overflow-hidden h-32 md:h-auto">
                        <div className="relative z-10">
                            <div className="bg-indigo-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-2">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-800 text-sm md:text-lg">Reportes</h3>
                                <p className="text-[10px] md:text-xs text-gray-400 leading-tight">Estadísticas</p>
                            </div>
                        </div>
                        <TrendingUp className="text-indigo-50 absolute -right-2 top-8 scale-150 opacity-50" size={60} />
                    </Link>

                </div>
            </div>

            {/* 3. ALERTAS Y RESUMEN (Stack vertical en móvil) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">

                {/* ALERTAS */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-5 md:p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center text-sm md:text-base">
                            <AlertCircle size={18} className="text-orange-500 mr-2" />
                            Atención Requerida
                        </h3>
                        {data.low_stock.length > 0 && (
                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-[10px] md:text-xs font-bold animate-pulse">
                                {data.low_stock.length} bajo stock
                            </span>
                        )}
                    </div>

                    {data.low_stock.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-400 font-medium text-xs md:text-sm">Todo en orden. Stock saludable. ✅</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.low_stock.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white flex items-center justify-center border border-orange-100 text-orange-600 font-bold text-xs mr-3 shadow-sm shrink-0">
                                            {item.stock}
                                        </div>
                                        <div className="truncate max-w-[120px] md:max-w-none">
                                            <p className="font-bold text-gray-800 text-xs md:text-sm truncate">{item.nombre}</p>
                                            <p className="text-[10px] text-gray-500">T: {item.talle}</p>
                                        </div>
                                    </div>
                                    <Link to="/compras" className="text-xs font-bold text-blue-600 hover:underline shrink-0 ml-2">Reponer</Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RESUMEN RÁPIDO */}
                <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-center">
                    <h3 className="font-bold text-base md:text-lg mb-6 relative z-10">Resumen Rápido</h3>

                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <span className="text-slate-400 text-sm">Tickets Hoy</span>
                            <span className="text-2xl font-black text-green-400">{data.financial.tickets}</span>
                        </div>

                        <div className="pt-2">
                            <Link to="/caja-control" className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold flex justify-center items-center hover:bg-gray-200 active:scale-95 transition-all shadow-lg text-sm md:text-base">
                                Ir al Arqueo <ArrowRight size={16} className="ml-2" />
                            </Link>
                        </div>
                    </div>
                    <TrendingUp className="absolute -right-4 top-10 text-white/5" size={150} />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;