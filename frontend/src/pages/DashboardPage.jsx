import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ShoppingCart, Package, BarChart3, Printer, Lock, Unlock,
    ArrowRight, AlertCircle, TrendingUp, Clock, Globe, ExternalLink
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
        return () => clearInterval(timer); // Limpieza al salir
    }, []);

    // Formateo de Hora y Fecha
    const formattedTime = currentTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = currentTime.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    if (loading) return (
        <div className="flex h-full items-center justify-center text-gray-400">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mr-3"></div>
            Cargando sistema...
        </div>
    );

    const cajaAbierta = data.financial.caja_status === 'abierta';

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">

            {/* 1. HEADER: BIENVENIDA + RELOJ + RESUMEN */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight flex items-center">
                        Hola, {user?.nombre || 'Campeón'} 👋
                    </h1>

                    {/* RELOJ EN TIEMPO REAL */}
                    <div className="flex items-center text-gray-500 mt-1 font-medium text-sm">
                        <Clock size={16} className="mr-2 text-blue-600" />
                        <span className="capitalize">{formattedDate}</span>
                        <span className="mx-2">|</span>
                        <span className="font-mono text-gray-800 font-bold bg-gray-100 px-2 rounded">{formattedTime}</span>
                    </div>
                </div>

                {/* WIDGET FINANCIERO */}
                <div className="mt-4 md:mt-0 flex items-center bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
                    <div className="px-6 border-r border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase">Ventas Hoy</p>
                        <p className="text-xl font-black text-gray-800">$ {data.financial.hoy.toLocaleString()}</p>
                    </div>
                    <div className="px-6">
                        <p className="text-xs font-bold text-gray-400 uppercase">Mes Actual</p>
                        <p className="text-xl font-black text-blue-600">$ {data.financial.mes.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* 2. ACCESOS RÁPIDOS (GRID CENTRAL) */}
            <div>
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Centro de Control</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                    {/* PTO VENTA (Gigante) */}
                    <Link to="/caja" className="col-span-2 bg-gradient-to-br from-slate-800 to-black text-white p-6 rounded-3xl shadow-xl hover:shadow-2xl hover:scale-[1.01] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                        <div className="relative z-10">
                            <div className="bg-white/10 w-fit p-3 rounded-2xl backdrop-blur-sm mb-4">
                                <ShoppingCart size={32} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold">Punto de Venta</h3>
                            <p className="text-slate-300 text-sm mt-1 group-hover:text-white transition-colors">Iniciar nueva operación</p>
                        </div>
                        <ShoppingCart className="absolute -right-6 -bottom-6 text-white/5 rotate-12 transition-transform group-hover:rotate-0" size={180} />
                    </Link>

                    {/* INVENTARIO */}
                    <Link to="/inventario" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                        <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                            <Package size={24} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Inventario</h3>
                        <p className="text-xs text-gray-400 mt-1">Gestionar stock</p>
                    </Link>

                    {/* CAJA */}
                    <Link to="/caja-control" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all group relative overflow-hidden">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${cajaAbierta ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {cajaAbierta ? <Unlock size={24} /> : <Lock size={24} />}
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Caja</h3>
                        <p className={`text-xs font-bold mt-1 ${cajaAbierta ? 'text-green-600' : 'text-red-500'}`}>
                            {cajaAbierta ? 'Abierta' : 'Cerrada'}
                        </p>
                    </Link>

                    {/* --- NUEVO: IR A TIENDA NUBE --- */}
                    <a
                        href="https://campeones4.mitiendanube.com/admin/v2/dashboard/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group cursor-pointer"
                    >
                        <div className="bg-sky-50 w-12 h-12 rounded-xl flex items-center justify-center text-sky-600 mb-4 group-hover:scale-110 transition-transform">
                            <Globe size={24} />
                        </div>
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-lg">Panel Admin Tienda</h3>
                            <ExternalLink size={14} className="text-gray-300 group-hover:text-sky-500" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Administrar Tienda</p>
                    </a>

                    <a
                        href="https://www.campeonesindumentaria.com.ar/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-400 transition-all group cursor-pointer"
                    >
                        <div className="bg-sky-50 w-12 h-12 rounded-xl flex items-center justify-center text-sky-600 mb-4 group-hover:scale-110 transition-transform">
                            <Globe size={24} />
                        </div>
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 text-lg">Ver Tienda</h3>
                            <ExternalLink size={14} className="text-gray-300 group-hover:text-sky-500" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Ir a la web online</p>
                    </a>


                    {/* ETIQUETAS */}
                    <Link to="/etiquetas" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
                        <div className="bg-orange-50 w-12 h-12 rounded-xl flex items-center justify-center text-orange-600 mb-4 group-hover:scale-110 transition-transform">
                            <Printer size={24} />
                        </div>
                        <h3 className="font-bold text-gray-800 text-lg">Etiquetas</h3>
                        <p className="text-xs text-gray-400 mt-1">Imprimir códigos</p>
                    </Link>

                    {/* REPORTES (Ancho doble para cerrar la grilla visualmente o simple segun preferencia, lo dejo simple para mantener estructura) */}
                    <Link to="/etiquetas" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all group">
                        <div className="relative z-10">
                            <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                                <BarChart3 size={24} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Reportes y Estadísticas</h3>
                            <p className="text-xs text-gray-400 mt-1">Análisis detallado de ventas</p>
                        </div>
                        <TrendingUp className="text-indigo-50 absolute right-4 top-1/2 -translate-y-1/2 scale-150 opacity-50 group-hover:scale-125 transition-transform" size={100} />
                    </Link>

                </div>
            </div>

            {/* 3. ALERTAS Y STOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Alertas */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <AlertCircle size={20} className="text-orange-500 mr-2" />
                            Atención Requerida
                        </h3>
                        {data.low_stock.length > 0 && (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                {data.low_stock.length} bajo stock
                            </span>
                        )}
                    </div>

                    {data.low_stock.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-gray-400 font-medium">Todo en orden. Stock saludable. ✅</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {data.low_stock.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-orange-100 text-orange-600 font-bold text-xs mr-3 shadow-sm">
                                            {item.stock}u
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                            <p className="text-xs text-gray-500">Talle: {item.talle}</p>
                                        </div>
                                    </div>
                                    <Link to="/compras" className="text-xs font-bold text-blue-600 hover:underline">Reponer</Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Resumen Diario */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden flex flex-col justify-center">
                    <h3 className="font-bold text-lg mb-6 relative z-10">Resumen Rápido</h3>

                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <span className="text-slate-400 text-sm">Tickets Hoy</span>
                            <span className="text-2xl font-black text-green-400">{data.financial.tickets}</span>
                        </div>

                        <div className="pt-2">
                            <Link to="/caja-control" className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold flex justify-center items-center hover:bg-gray-200 transition-colors shadow-lg">
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