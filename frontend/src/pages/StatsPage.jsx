import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    BarChart3, Calendar, DollarSign, Users,
    CreditCard, TrendingUp, Award, Search, Maximize2,
    TrendingDown, Plus, Trash2, Wallet, X
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import ProductStatsModal from '../components/ProductStatsModal';

const StatsPage = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);

    // Fechas por defecto
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [dateRange, setDateRange] = useState({ start: firstDay, end: today });

    const [data, setData] = useState({
        summary: { ingresos: 0, tickets: 0, promedio: 0, gastos: 0, ganancia_neta: 0 },
        by_method: [],
        top_products: [],
        gastos_list: []
    });

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [detailedProducts, setDetailedProducts] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Estados para GASTOS
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [newExpense, setNewExpense] = useState({
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'Mercadería',
        descripcion: '',
        monto: ''
    });

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.post('/sales/stats/period', {
                start_date: dateRange.start,
                end_date: dateRange.end
            }, { headers: { Authorization: `Bearer ${token}` } });

            setData(res.data);
        } catch (e) {
            console.error(e);
            toast.error("Error cargando estadísticas");
        } finally {
            setLoading(false);
        }
    };

    const openProductDetails = async () => {
        setLoadingDetails(true);
        try {
            const res = await api.post('/sales/stats/products-detail', {
                start_date: dateRange.start,
                end_date: dateRange.end
            }, { headers: { Authorization: `Bearer ${token}` } });

            setDetailedProducts(res.data);
            setIsProductModalOpen(true);
        } catch (e) {
            toast.error("Error al cargar detalles de productos");
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpense.monto || !newExpense.descripcion) return toast.error("Completa los datos");

        try {
            await api.post('/sales/expenses', newExpense);
            toast.success("Gasto registrado");
            setIsExpenseModalOpen(false);
            setNewExpense({ fecha: new Date().toISOString().split('T')[0], categoria: 'Mercadería', descripcion: '', monto: '' });
            fetchStats(); // Recargar datos
        } catch (error) {
            toast.error("Error al guardar gasto");
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm("¿Borrar este gasto?")) return;
        try {
            await api.delete(`/sales/expenses/${id}`);
            toast.success("Gasto eliminado");
            fetchStats();
        } catch (error) {
            toast.error("Error al borrar");
        }
    };

    useEffect(() => { fetchStats(); }, [token]);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 bg-gray-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
            <Toaster position="top-center" />

            <ProductStatsModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                data={detailedProducts}
                dateRange={dateRange}
            />

            {/* HEADER Y FILTROS */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 dark:border-slate-800 pb-6 transition-colors">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
                        <BarChart3 className="mr-2 text-blue-600 dark:text-blue-400" /> Reportes Financieros
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Control de Ingresos, Egresos y Ganancias.</p>
                </div>

                <div className="flex gap-2 items-center">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex gap-2 items-center transition-colors">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 ml-1 uppercase">Desde</span>
                            <input type="date" className="border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-white rounded-lg p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 ml-1 uppercase">Hasta</span>
                            <input type="date" className="border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-white rounded-lg p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                        </div>
                        <button onClick={fetchStats} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors ml-2 shadow-md">
                            <Search size={20} />
                        </button>
                    </div>

                    {/* BOTÓN NUEVO GASTO */}
                    <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold flex items-center shadow-lg transition-all h-[62px]">
                        <Plus size={20} className="mr-2" /> Registrar Gasto
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center text-gray-400 dark:text-gray-600 animate-pulse">Calculando balance...</div>
            ) : (
                <>
                    {/* 1. KPIs PRINCIPALES (FILA SUPERIOR) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* INGRESOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-8 border-green-500 dark:border-green-600 flex flex-col justify-between transition-colors">
                            <div>
                                <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase">Ingresos Totales</p>
                                <h2 className="text-4xl font-black text-gray-800 dark:text-white mt-2">$ {data.summary.ingresos.toLocaleString()}</h2>
                            </div>
                            <div className="mt-4 flex items-center text-green-600 dark:text-green-400 text-sm font-bold">
                                <DollarSign size={16} className="mr-1" /> Ventas brutas
                            </div>
                        </div>

                        {/* GASTOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-8 border-red-500 dark:border-red-600 flex flex-col justify-between transition-colors">
                            <div>
                                <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase">Gastos Operativos</p>
                                <h2 className="text-4xl font-black text-gray-800 dark:text-white mt-2">$ {data.summary.gastos.toLocaleString()}</h2>
                            </div>
                            <div className="mt-4 flex items-center text-red-600 dark:text-red-400 text-sm font-bold">
                                <TrendingDown size={16} className="mr-1" /> Costos fijos y variables
                            </div>
                        </div>

                        {/* GANANCIA NETA */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border-l-8 border-blue-600 dark:border-blue-500 flex flex-col justify-between transition-colors relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase">Ganancia Neta</p>
                                <h2 className={`text-4xl font-black mt-2 ${data.summary.ganancia_neta >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                                    $ {data.summary.ganancia_neta.toLocaleString()}
                                </h2>
                            </div>
                            <div className="mt-4 flex items-center text-gray-500 dark:text-gray-400 text-sm font-bold relative z-10">
                                <Wallet size={16} className="mr-1" /> Resultado final del período
                            </div>
                            {/* Fondo decorativo */}
                            <Wallet className="absolute right-[-20px] bottom-[-20px] text-blue-50 dark:text-blue-900/20 w-32 h-32 opacity-50 z-0" />
                        </div>
                    </div>

                    {/* SEGUNDA FILA: MÉTRICAS DE VENTA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-gray-400 uppercase">Tickets Emitidos</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.summary.tickets}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-gray-400 uppercase">Ticket Promedio</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">$ {data.summary.promedio.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-gray-400 uppercase">Margen (Aprox)</p>
                            <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                {data.summary.ingresos > 0 ? ((data.summary.ganancia_neta / data.summary.ingresos) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* 2. MEDIOS DE PAGO */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
                            <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center">
                                <CreditCard className="mr-2 text-slate-500 dark:text-slate-400" /> Ingresos por Medio de Pago
                            </h3>
                            <div className="space-y-4">
                                {data.by_method.map((m, i) => {
                                    const percent = data.summary.ingresos > 0 ? (m.total / data.summary.ingresos) * 100 : 0;
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-bold text-gray-700 dark:text-gray-300">{m.nombre}</span>
                                                <span className="text-gray-500 dark:text-gray-400 font-mono">$ {m.total.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                                <div className="bg-blue-500 dark:bg-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <p className="text-[10px] text-right text-gray-400 dark:text-slate-500 mt-1">{m.count} transacciones ({percent.toFixed(1)}%)</p>
                                        </div>
                                    )
                                })}
                                {data.by_method.length === 0 && <p className="text-gray-400 dark:text-gray-600 text-center">Sin datos</p>}
                            </div>
                        </div>

                        {/* 3. PRODUCTOS ESTRELLA */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 h-full flex flex-col transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-800 dark:text-white flex items-center">
                                    <Award className="mr-2 text-yellow-500" /> Top Productos
                                </h3>
                                <button
                                    onClick={openProductDetails}
                                    disabled={loadingDetails}
                                    className="text-xs flex items-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold transition-colors disabled:opacity-50"
                                >
                                    {loadingDetails ? 'Cargando...' : <><Maximize2 size={14} className="mr-1" /> Ver Todo / Filtrar</>}
                                </button>
                            </div>

                            <div className="overflow-hidden flex-1">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                        <tr>
                                            <th className="p-3 rounded-l-lg">#</th>
                                            <th className="p-3">Producto</th>
                                            <th className="p-3 text-right">Cant.</th>
                                            <th className="p-3 text-right rounded-r-lg">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                                        {data.top_products.map((p, index) => (
                                            <tr key={index} className="hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10 transition-colors">
                                                <td className="p-3">
                                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : index === 1 ? 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300' : index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400' : 'text-gray-400'}`}>{index + 1}</span>
                                                </td>
                                                <td className="p-3 font-medium text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={p.nombre}>{p.nombre}</td>
                                                <td className="p-3 text-right dark:text-gray-300">{p.unidades}</td>
                                                <td className="p-3 text-right font-black text-gray-800 dark:text-white">$ {p.recaudado.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {data.top_products.length === 0 && <p className="text-gray-400 text-center mt-10">Sin ventas en este período.</p>}
                            </div>
                        </div>
                    </div>

                    {/* 4. LISTADO DE GASTOS (NUEVO) */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
                        <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                            <TrendingDown className="mr-2 text-red-500" /> Detalle de Gastos y Salidas
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                    <tr>
                                        <th className="p-4 rounded-l-lg">Fecha</th>
                                        <th className="p-4">Categoría</th>
                                        <th className="p-4">Descripción</th>
                                        <th className="p-4 text-right">Monto</th>
                                        <th className="p-4 text-center rounded-r-lg">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {data.gastos_list.length === 0 ? (
                                        <tr><td colSpan="5" className="p-8 text-center text-gray-400">No hay gastos registrados en este período.</td></tr>
                                    ) : (
                                        data.gastos_list.map((g) => (
                                            <tr key={g.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                                                <td className="p-4 font-mono text-gray-500 dark:text-gray-400">{g.fecha}</td>
                                                <td className="p-4"><span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-bold text-gray-600 dark:text-gray-300">{g.categoria}</span></td>
                                                <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">{g.descripcion}</td>
                                                <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">- $ {g.monto.toLocaleString()}</td>
                                                <td className="p-4 text-center">
                                                    <button onClick={() => handleDeleteExpense(g.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* MODAL REGISTRAR GASTO */}
            {isExpenseModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center">
                                <TrendingDown className="mr-2 text-red-500" /> Registrar Gasto
                            </h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Fecha</label>
                                <input type="date" required value={newExpense.fecha} onChange={e => setNewExpense({ ...newExpense, fecha: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-400 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Categoría</label>
                                <select value={newExpense.categoria} onChange={e => setNewExpense({ ...newExpense, categoria: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-400 dark:text-white">
                                    <option value="Mercadería">Compras / Mercadería</option>
                                    <option value="Alquiler">Alquiler</option>
                                    <option value="Sueldos">Sueldos</option>
                                    <option value="Servicios">Servicios (Luz, Gas, Internet)</option>
                                    <option value="Impuestos">Impuestos</option>
                                    <option value="Varios">Varios / Otros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descripción</label>
                                <input type="text" placeholder="Ej: Pago proveedor remeras..." required value={newExpense.descripcion} onChange={e => setNewExpense({ ...newExpense, descripcion: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-400 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Monto ($)</label>
                                <input type="number" placeholder="0.00" required min="0" step="0.01" value={newExpense.monto} onChange={e => setNewExpense({ ...newExpense, monto: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-gray-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-red-400 font-bold text-xl dark:text-white" />
                            </div>
                            <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all mt-4">GUARDAR GASTO</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage;