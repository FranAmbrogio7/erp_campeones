import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
    ShoppingCart, DollarSign, AlertTriangle, TrendingUp, Lock, Unlock,
    ArrowRight, Calendar, Package, Activity
} from 'lucide-react';
import { api } from '../context/AuthContext';


const DashboardPage = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

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
    }, [api]);

    if (loading) return <div className="p-10 animate-pulse text-gray-500">Analizando negocio...</div>;

    return (
        <div className="space-y-6">

            {/* 1. HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hola, {user?.nombre}</h1>
                    <p className="text-gray-500 text-sm">Resumen de operaciones en tiempo real.</p>
                </div>
                <div className="hidden md:flex items-center bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                    <div className={`w-3 h-3 rounded-full mr-2 ${data.financial.caja_status === 'abierta' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-xs font-bold text-gray-600 uppercase">
                        Caja {data.financial.caja_status}
                    </span>
                </div>
            </div>

            {/* 2. KPI CARDS (Financiero) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Ventas Hoy */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ventas Hoy</p>
                        <h3 className="text-3xl font-black text-gray-800">$ {data.financial.hoy.toLocaleString()}</h3>
                        <p className="text-xs text-green-600 font-bold mt-1 flex items-center">
                            <ShoppingCart size={12} className="mr-1" /> {data.financial.tickets} operaciones
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-full text-green-600"><DollarSign size={32} /></div>
                </div>

                {/* Acumulado Mes */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Acumulado Mes</p>
                        <h3 className="text-3xl font-black text-gray-800">$ {data.financial.mes.toLocaleString()}</h3>
                        <p className="text-xs text-blue-600 font-bold mt-1">
                            {new Date().toLocaleString('es-ES', { month: 'long' })}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-full text-blue-600"><Calendar size={32} /></div>
                </div>

                {/* Accesos Rápidos */}
                <div className="grid grid-rows-2 gap-3">
                    <Link to="/caja" className="bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-200">
                        <ShoppingCart size={18} className="mr-2" /> NUEVA VENTA
                    </Link>
                    <Link to="/caja-control" className="bg-white text-gray-700 border border-gray-200 rounded-xl flex items-center justify-center font-bold hover:bg-gray-50 transition-colors">
                        {data.financial.caja_status === 'abierta' ? <Lock size={18} className="mr-2 text-red-500" /> : <Unlock size={18} className="mr-2 text-green-500" />}
                        {data.financial.caja_status === 'abierta' ? 'CERRAR CAJA' : 'ABRIR CAJA'}
                    </Link>
                </div>
            </div>

            {/* 3. SECCIÓN INFERIOR DIVIDIDA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* TABLA DE STOCK CRÍTICO (2/3 de ancho) */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <AlertTriangle className="mr-2 text-orange-500" size={20} /> Alertas de Stock Bajo
                        </h3>
                        <Link to="/inventario" className="text-xs font-bold text-blue-600 hover:underline">Ver Inventario Completo</Link>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {data.low_stock.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <Package size={48} className="mx-auto mb-2 opacity-20" />
                                <p>¡Excelente! No hay productos con stock crítico.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase">
                                    <tr>
                                        <th className="p-4">Producto</th>
                                        <th className="p-4">Talle</th>
                                        <th className="p-4">Estado</th>
                                        <th className="p-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {data.low_stock.map((item) => (
                                        <tr key={`${item.id}-${item.talle}`} className="hover:bg-orange-50/50 transition-colors">
                                            <td className="p-4 font-bold text-gray-700">{item.nombre}</td>
                                            <td className="p-4">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                                                    {item.talle}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${item.stock === 0 ? 'bg-red-500' : 'bg-orange-400'}`}
                                                            style={{ width: `${(item.stock / item.minimo) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className={`text-xs font-bold ${item.stock === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                                                        {item.stock} u.
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <Link to="/compras" className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold transition-colors">
                                                    Reponer
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* ACTIVIDAD RECIENTE (1/3 de ancho) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
                    <div className="p-5 border-b border-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center">
                            <Activity className="mr-2 text-purple-500" size={20} /> Últimos Movimientos
                        </h3>
                    </div>
                    <div className="flex-1 p-4">
                        {data.recent_activity.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">Sin actividad hoy.</p>
                        ) : (
                            <div className="space-y-4">
                                {data.recent_activity.map((act, i) => (
                                    <div key={i} className="flex justify-between items-center pb-3 border-b border-dashed border-gray-100 last:border-0">
                                        <div className="flex items-center">
                                            <div className="w-2 h-2 rounded-full bg-green-400 mr-3"></div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-700">Venta Registrada</p>
                                                <p className="text-xs text-gray-400">{act.metodo}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-gray-800">$ {act.total.toLocaleString()}</p>
                                            <p className="text-xs text-gray-400">{act.hora}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Link to="/ventas" className="block text-center text-xs font-bold text-blue-600 mt-4 hover:underline">
                            Ver Historial Completo
                        </Link>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DashboardPage;