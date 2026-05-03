import { useEffect, useState, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    BarChart3, DollarSign,
    CreditCard, TrendingUp, Award, Search, Maximize2,
    TrendingDown, Plus, Trash2, Wallet, X, Globe, Store, Tag
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import ProductStatsModal from '../components/ProductStatsModal';

const StatsPage = () => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);

    // --- IDENTIDAD DE VISTA ---
    const [tipoCajaFiltro, setTipoCajaFiltro] = useState('GLOBAL');
    const isMerch = tipoCajaFiltro === 'MERCHANDISING';
    const isCamp = tipoCajaFiltro === 'PRINCIPAL';

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

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.post('/sales/stats/period', {
                start_date: dateRange.start,
                end_date: dateRange.end,
                tipo_caja: tipoCajaFiltro // NUEVO: Filtro
            }, { headers: { Authorization: `Bearer ${token}` } });

            setData(res.data);
        } catch (e) {
            console.error(e);
            toast.error("Error cargando estadísticas");
        } finally {
            setLoading(false);
        }
    }, [dateRange.start, dateRange.end, tipoCajaFiltro, token]);

    const openProductDetails = async () => {
        setLoadingDetails(true);
        try {
            const res = await api.post('/sales/stats/products-detail', {
                start_date: dateRange.start,
                end_date: dateRange.end,
                tipo_caja: tipoCajaFiltro // NUEVO: Filtro
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
            fetchStats(); 
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

    useEffect(() => { 
        if (token) fetchStats(); 
    }, [token, fetchStats]);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] transition-colors duration-300">
            <Toaster position="top-center" />

            <ProductStatsModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                data={detailedProducts}
                dateRange={dateRange}
            />

            {/* HEADER, FILTROS Y SELECTOR */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors">
                
                <div className="w-full xl:w-auto">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center tracking-tight mb-3">
                        <BarChart3 className={`mr-3 ${isMerch ? 'text-purple-500' : isCamp ? 'text-indigo-500' : 'text-blue-500'}`} size={28} /> 
                        Reportes Financieros
                    </h1>
                    
                    {/* SELECTOR DE VISTA */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner w-full sm:w-auto overflow-x-auto">
                        <button 
                            onClick={() => setTipoCajaFiltro('GLOBAL')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tipoCajaFiltro === 'GLOBAL' ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Globe size={14} /> Global
                        </button>
                        <button 
                            onClick={() => setTipoCajaFiltro('PRINCIPAL')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isCamp ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Store size={14} /> Campeones
                        </button>
                        <button 
                            onClick={() => setTipoCajaFiltro('MERCHANDISING')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isMerch ? 'bg-purple-50 dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm border border-purple-100 dark:border-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Tag size={14} /> Merch
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-end">
                    {/* FECHAS */}
                    <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors w-full sm:w-auto">
                        <div className="flex flex-col px-2 flex-1 sm:flex-none border-r border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Desde</span>
                            <input type="date" className="bg-transparent text-slate-800 dark:text-white font-bold text-sm outline-none cursor-pointer"
                                value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                        </div>
                        <div className="flex flex-col px-2 flex-1 sm:flex-none">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Hasta</span>
                            <input type="date" className="bg-transparent text-slate-800 dark:text-white font-bold text-sm outline-none cursor-pointer"
                                value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                        </div>
                        <button onClick={fetchStats} className={`px-4 rounded-lg text-white font-bold transition-all active:scale-95 shadow-sm ${isMerch ? 'bg-purple-500 hover:bg-purple-600' : isCamp ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                            <Search size={18} />
                        </button>
                    </div>

                    {/* BOTÓN NUEVO GASTO */}
                    <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center shadow-sm transition-all active:scale-95 w-full sm:w-auto shrink-0 h-[46px]">
                        <Plus size={16} className="mr-1.5" /> Gasto
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-20 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm flex flex-col items-center justify-center min-h-[400px]">
                    <div className={`animate-spin h-10 w-10 border-4 border-t-transparent rounded-full mb-4 ${isMerch ? 'border-purple-500' : isCamp ? 'border-indigo-500' : 'border-blue-500'}`}></div>
                    Procesando métricas...
                </div>
            ) : (
                <>
                    {/* 1. KPIs PRINCIPALES (FILA SUPERIOR) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {/* INGRESOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between transition-colors relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500"></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ingresos Totales</p>
                                <h2 className="text-4xl font-black text-slate-800 dark:text-white mt-2 tracking-tighter font-mono">$ {data.summary.ingresos.toLocaleString()}</h2>
                            </div>
                            <div className="mt-5 flex items-center text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 w-fit px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                <DollarSign size={14} className="mr-1" /> Ventas Brutas
                            </div>
                        </div>

                        {/* GASTOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between transition-colors relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-1.5 h-full bg-red-500"></div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Gastos Operativos (Global)</p>
                                <h2 className="text-4xl font-black text-slate-800 dark:text-white mt-2 tracking-tighter font-mono">$ {data.summary.gastos.toLocaleString()}</h2>
                            </div>
                            <div className="mt-5 flex items-center text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/20 w-fit px-2.5 py-1.5 rounded-lg border border-red-100 dark:border-red-800/50">
                                <TrendingDown size={14} className="mr-1" /> Costos Fijos / Var
                            </div>
                        </div>

                        {/* GANANCIA NETA */}
                        <div className={`p-6 rounded-2xl shadow-md border flex flex-col justify-between transition-colors relative overflow-hidden ${isMerch ? 'bg-gradient-to-br from-purple-800 to-fuchsia-900 border-purple-700 text-white' : isCamp ? 'bg-gradient-to-br from-indigo-800 to-blue-900 border-indigo-700 text-white' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-white'}`}>
                            <div className="relative z-10">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Ganancia Neta Calculada</p>
                                <h2 className={`text-4xl font-black mt-2 tracking-tighter font-mono ${data.summary.ganancia_neta >= 0 ? 'text-white' : 'text-red-300'}`}>
                                    $ {data.summary.ganancia_neta.toLocaleString()}
                                </h2>
                            </div>
                            <div className="mt-5 flex items-center text-[10px] font-black uppercase tracking-widest bg-white/10 backdrop-blur-md w-fit px-2.5 py-1.5 rounded-lg border border-white/20 relative z-10">
                                <Wallet size={14} className="mr-1" /> Resultado Período
                            </div>
                            <Wallet className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 rotate-12 z-0" />
                        </div>
                    </div>

                    {/* SEGUNDA FILA: MÉTRICAS DE VENTA */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tickets Emitidos</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white font-mono">{data.summary.tickets}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ticket Promedio</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white font-mono">$ {data.summary.promedio.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center transition-colors">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Margen (Aprox)</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-white font-mono">
                                {data.summary.ingresos > 0 ? ((data.summary.ganancia_neta / data.summary.ingresos) * 100).toFixed(1) : 0}%
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

                        {/* 2. MEDIOS DE PAGO */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                            <h3 className="font-black text-slate-800 dark:text-white mb-6 flex items-center tracking-tight">
                                <CreditCard className="mr-3 text-slate-400 dark:text-slate-500" size={24} /> Ingresos por Medio de Pago
                            </h3>
                            <div className="space-y-5">
                                {data.by_method.map((m, i) => {
                                    const percent = data.summary.ingresos > 0 ? (m.total / data.summary.ingresos) * 100 : 0;
                                    return (
                                        <div key={i} className="group">
                                            <div className="flex justify-between items-end mb-2">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">{m.nombre}</span>
                                                <span className="text-slate-800 dark:text-white font-black font-mono tracking-tight">$ {m.total.toLocaleString()}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                                                <div className={`h-full rounded-full transition-all duration-1000 ${isMerch ? 'bg-purple-500' : isCamp ? 'bg-indigo-500' : 'bg-blue-500'}`} style={{ width: `${percent}%` }}></div>
                                            </div>
                                            <p className="text-[10px] text-right font-bold text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-widest">{m.count} transacciones ({percent.toFixed(1)}%)</p>
                                        </div>
                                    )
                                })}
                                {data.by_method.length === 0 && <p className="text-slate-400 dark:text-slate-500 text-center font-bold text-xs uppercase tracking-widest py-4">Sin datos de cobro</p>}
                            </div>
                        </div>

                        {/* 3. PRODUCTOS ESTRELLA */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col transition-colors">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-black text-slate-800 dark:text-white flex items-center tracking-tight">
                                    <Award className="mr-3 text-amber-500" size={24} /> Top Productos
                                </h3>
                                <button
                                    onClick={openProductDetails}
                                    disabled={loadingDetails}
                                    className={`text-[10px] font-black uppercase tracking-widest flex items-center px-3 py-1.5 rounded-lg transition-colors border ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100' : isCamp ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100'}`}
                                >
                                    {loadingDetails ? 'Cargando...' : <><Maximize2 size={14} className="mr-1.5" /> Ver Lista Completa</>}
                                </button>
                            </div>

                            <div className="overflow-x-auto flex-1 custom-scrollbar">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest sticky top-0">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Producto</th>
                                            <th className="p-3 text-center">Cant.</th>
                                            <th className="p-3 text-right">Recaudado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {data.top_products.map((p, index) => (
                                            <tr key={index} className={`transition-colors group ${isMerch ? 'hover:bg-purple-50/50 dark:hover:bg-slate-800/50' : isCamp ? 'hover:bg-indigo-50/50 dark:hover:bg-slate-800/50' : 'hover:bg-blue-50/50 dark:hover:bg-slate-800/50'}`}>
                                                <td className="p-3">
                                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shadow-sm border ${index === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : index === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600' : index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>{index + 1}</span>
                                                </td>
                                                <td className="p-3 font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px] leading-tight" title={p.nombre}>{p.nombre}</td>
                                                <td className="p-3 text-center font-bold dark:text-slate-400">{p.unidades}</td>
                                                <td className="p-3 text-right font-black text-slate-800 dark:text-white font-mono tracking-tight">$ {p.recaudado.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {data.top_products.length === 0 && <p className="text-slate-400 text-center font-bold text-xs uppercase tracking-widest mt-12">Sin ventas registradas.</p>}
                            </div>
                        </div>
                    </div>

                    {/* 4. LISTADO DE GASTOS */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
                        <h3 className="font-black text-slate-800 dark:text-white mb-6 flex items-center tracking-tight">
                            <TrendingDown className="mr-3 text-red-500" size={24} /> Detalle de Gastos y Salidas
                        </h3>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                    <tr>
                                        <th className="p-4 pl-6">Fecha</th>
                                        <th className="p-4">Categoría</th>
                                        <th className="p-4">Descripción</th>
                                        <th className="p-4 text-right">Monto</th>
                                        <th className="p-4 text-center pr-6">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {data.gastos_list.length === 0 ? (
                                        <tr><td colSpan="5" className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No hay gastos registrados en este período.</td></tr>
                                    ) : (
                                        data.gastos_list.map((g) => (
                                            <tr key={g.id} className="hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors group">
                                                <td className="p-4 pl-6 font-mono font-bold text-slate-500 dark:text-slate-400 text-xs">{g.fecha}</td>
                                                <td className="p-4">
                                                    <span className="bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-sm">{g.categoria}</span>
                                                </td>
                                                <td className="p-4 text-slate-700 dark:text-slate-300 font-bold">{g.descripcion}</td>
                                                <td className="p-4 text-right font-black text-red-600 dark:text-red-400 font-mono tracking-tight">- $ {g.monto.toLocaleString()}</td>
                                                <td className="p-4 text-center pr-6">
                                                    <button onClick={() => handleDeleteExpense(g.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={16} /></button>
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
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden transition-colors border border-slate-200 dark:border-slate-700">
                        <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/50 flex justify-between items-center">
                            <h3 className="text-xl font-black text-red-800 dark:text-red-400 flex items-center tracking-tight">
                                <TrendingDown className="mr-3 text-red-500" size={24} /> Registrar Gasto
                            </h3>
                            <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddExpense} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fecha</label>
                                <input type="date" required value={newExpense.fecha} onChange={e => setNewExpense({ ...newExpense, fecha: e.target.value })} className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:border-red-500 font-bold text-sm text-slate-700 dark:text-white transition-all shadow-inner cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoría</label>
                                <select value={newExpense.categoria} onChange={e => setNewExpense({ ...newExpense, categoria: e.target.value })} className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:border-red-500 font-bold text-sm text-slate-700 dark:text-white transition-all shadow-sm cursor-pointer">
                                    <option value="Mercadería">Compras / Mercadería</option>
                                    <option value="Alquiler">Alquiler</option>
                                    <option value="Sueldos">Sueldos</option>
                                    <option value="Servicios">Servicios (Luz, Gas, Internet)</option>
                                    <option value="Impuestos">Impuestos</option>
                                    <option value="Varios">Varios / Otros</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción Corta</label>
                                <input type="text" placeholder="Ej: Pago proveedor..." required value={newExpense.descripcion} onChange={e => setNewExpense({ ...newExpense, descripcion: e.target.value })} className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:border-red-500 font-bold text-sm text-slate-700 dark:text-white placeholder-slate-300 transition-all shadow-inner" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Monto de Salida</label>
                                <div className="relative">
                                    <span className="absolute left-5 top-4 font-black text-red-500 text-xl">$</span>
                                    <input type="number" placeholder="0.00" required min="0" step="0.01" value={newExpense.monto} onChange={e => setNewExpense({ ...newExpense, monto: e.target.value })} className="w-full pl-10 p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:border-red-500 font-black text-2xl text-slate-800 dark:text-white transition-all shadow-inner" />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-4 text-slate-600 dark:text-slate-300 font-black text-[11px] uppercase tracking-widest bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg shadow-red-500/30 transition-transform active:scale-95">CONFIRMAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatsPage;