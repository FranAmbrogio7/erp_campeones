import { useEffect, useState, useMemo } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    Lock, Unlock, Wallet, CreditCard, Smartphone, Receipt,
    Cloud, MinusCircle, AlertTriangle, ArrowUpRight, Store
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CashRegisterPage = () => {
    const { token } = useAuth();

    // Estados Principales
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null);
    const [salesList, setSalesList] = useState([]);

    // Filtros UI
    const [filterMethod, setFilterMethod] = useState('Todos');

    // Inputs Cierre y Gastos
    const [montoInicial, setMontoInicial] = useState('');
    const [montoCierre, setMontoCierre] = useState('');
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseData, setExpenseData] = useState({ monto: '', descripcion: '' });
    const [cierreResult, setCierreResult] = useState(null);

    // --- CARGA DE DATOS ---
    const fetchData = async () => {
        try {
            const resStatus = await api.get('/sales/caja/status');
            setStatus(resStatus.data.estado);
            if (resStatus.data.estado === 'abierta') {
                setSessionData(resStatus.data);
                try {
                    const resSales = await api.get('/sales/history', { params: { current_session: true } });
                    setSalesList(resSales.data.history || []);
                } catch (e) { console.error("Error historial", e); }
            }
        } catch (error) { toast.error("Error conectando con caja"); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (token) fetchData(); }, [token]);

    // --- CÁLCULOS Y MEMOS ---
    const totalLocal = useMemo(() => {
        return salesList
            .filter(v => !v.metodo.toLowerCase().includes('nube') && !v.metodo.toLowerCase().includes('tienda'))
            .reduce((acc, curr) => acc + curr.total, 0);
    }, [salesList]);

    // 1. Filtrado visual de la tabla (qué filas se ven)
    const filteredSales = useMemo(() => {
        if (filterMethod === 'Todos') return salesList;
        return salesList.filter(v => v.metodo.includes(filterMethod));
    }, [salesList, filterMethod]);

    // 2. Cálculo matemático corregido (Suma inteligente de partes)
    const filteredTotal = useMemo(() => {
        // Si no hay filtro, sumamos totales brutos
        if (filterMethod === 'Todos') {
            return salesList.reduce((acc, curr) => acc + curr.total, 0);
        }

        // Si hay filtro, sumamos SOLO la parte correspondiente al método
        return salesList.reduce((acc, sale) => {
            // Verificar si la venta tiene desglose de pagos (Backend nuevo)
            if (sale.pagos_detalle && sale.pagos_detalle.length > 0) {
                // Buscamos los pagos que coincidan con el filtro (Ej: "Tarjeta")
                const partesQueCoinciden = sale.pagos_detalle.filter(p =>
                    p.metodo.includes(filterMethod)
                );

                // Sumamos esos montos parciales
                const sumaParcial = partesQueCoinciden.reduce((sum, p) => sum + p.monto, 0);
                return acc + sumaParcial;
            }

            // Fallback para ventas antiguas sin detalle (si el string coincide, sumamos todo)
            if (sale.metodo.includes(filterMethod)) {
                return acc + sale.total;
            }
            return acc;
        }, 0);
    }, [salesList, filterMethod]);

    const getCountByMethod = (method) => {
        if (method === 'Todos') return salesList.length;
        return salesList.filter(v => v.metodo.includes(method)).length;
    };

    // --- ACCIONES ---
    const handleOpen = async (e) => {
        e.preventDefault();
        if (!montoInicial || parseFloat(montoInicial) < 0) return toast.error("Monto inválido");
        try { await api.post('/sales/caja/open', { monto_inicial: montoInicial }); fetchData(); toast.success("Caja Abierta"); }
        catch (e) { toast.error("Error"); }
    };

    const handleExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/sales/caja/movement', { tipo: 'retiro', monto: expenseData.monto, descripcion: expenseData.descripcion });
            toast.success("Retiro registrado"); setShowExpenseForm(false); setExpenseData({ monto: '', descripcion: '' }); fetchData();
        } catch (e) { toast.error("Error registrando retiro"); }
    };

    const handleClose = async (e) => {
        e.preventDefault();
        if (montoCierre === '') return toast.error("Ingresa el efectivo real");
        if (!window.confirm(`¿Cerrar turno con $${parseFloat(montoCierre).toLocaleString()} en billetes?`)) return;
        try {
            const res = await api.post('/sales/caja/close', { total_real: montoCierre });
            setCierreResult(res.data.resumen); setStatus('cerrada'); setSessionData(null); setSalesList([]);
        } catch (e) { toast.error("Error al cerrar"); }
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-950 h-full flex items-center justify-center">Cargando datos de caja...</div>;

    // --- PANTALLA DE RESULTADO CIERRE ---
    if (cierreResult) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[calc(100vh-100px)] animate-fade-in-down bg-gray-100 dark:bg-slate-950">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border dark:border-slate-700 max-w-md w-full text-center transition-colors">
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full inline-block mb-4 text-green-600 dark:text-green-400"><Lock size={40} /></div>
                    <h2 className="text-3xl font-bold mb-1 text-gray-800 dark:text-white">Turno Cerrado</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Resumen de operación</p>
                    <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-6 mb-6 border border-gray-100 dark:border-slate-700">
                        <div className="flex justify-between text-gray-500 dark:text-gray-400 text-sm mb-2"><span>Efectivo Esperado:</span><span className="font-medium">$ {cierreResult.esperado.toLocaleString()}</span></div>
                        <div className="flex justify-between text-gray-800 dark:text-white text-lg mb-4"><span className="font-bold">Efectivo Real:</span><span className="font-black text-blue-600 dark:text-blue-400">$ {cierreResult.real.toLocaleString()}</span></div>
                        <div className={`flex justify-between p-3 rounded-lg ${cierreResult.diferencia === 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                            <span className="font-bold text-sm">Diferencia:</span>
                            <span className="font-black text-lg">{cierreResult.diferencia > 0 ? '+' : ''} $ {cierreResult.diferencia.toLocaleString()}</span>
                        </div>
                    </div>
                    <button onClick={() => { setCierreResult(null); setMontoCierre(''); setMontoInicial(''); }} className="bg-slate-900 dark:bg-slate-700 text-white w-full py-3 rounded-xl font-bold hover:bg-black dark:hover:bg-slate-600 transition-all">Volver a Empezar</button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 max-w-7xl mx-auto space-y-6 bg-gray-100 dark:bg-slate-950 transition-colors duration-300 min-h-screen">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${status === 'abierta' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {status === 'abierta' ? <Unlock size={24} /> : <Lock size={24} />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Control de Caja</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{status === 'abierta' ? 'Sesión activa y registrando' : 'Turno cerrado'}</p>
                    </div>
                </div>
                {status === 'abierta' && (
                    <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">Apertura</p>
                        <p className="font-mono text-gray-700 dark:text-gray-200 font-bold">{sessionData?.fecha_apertura}</p>
                    </div>
                )}
            </div>

            {status === 'cerrada' ? (
                /* --- VISTA APERTURA --- */
                <div className="max-w-lg mx-auto mt-10">
                    <form onSubmit={handleOpen} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 relative overflow-hidden transition-colors">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 text-center">Apertura de Turno</h2>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Fondo de Caja (Cambio Inicial)</label>
                        <div className="relative mb-8">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-lg">$</span>
                            <input type="number" required autoFocus className="w-full pl-10 p-3 text-2xl font-bold border-2 border-gray-200 dark:border-slate-600 rounded-xl focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-800 dark:text-white outline-none transition-all" placeholder="0.00" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg flex justify-center items-center"><Unlock size={20} className="mr-2" /> ABRIR CAJA</button>
                    </form>
                </div>
            ) : (
                /* --- VISTA DASHBOARD (CAJA ABIERTA) --- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COLUMNA IZQUIERDA: ESTADÍSTICAS Y AUDITORÍA */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 1. TARJETAS DE KPI SUPERIORES */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Caja Inicial */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col justify-between transition-colors">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 flex items-center"><Unlock size={14} className="mr-1" /> Fondo Inicial</p>
                                <p className="text-2xl font-black text-gray-800 dark:text-white">$ {sessionData?.monto_inicial?.toLocaleString()}</p>
                            </div>

                            {/* Total Local */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-blue-600 dark:to-blue-800 text-white p-4 rounded-2xl shadow-md border border-slate-700 dark:border-blue-500 flex flex-col justify-between relative overflow-hidden transition-colors">
                                <div className="relative z-10">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-blue-200 uppercase mb-1 flex items-center"><Store size={14} className="mr-1 text-green-400 dark:text-white" /> Venta Local (Sin Web)</p>
                                    <p className="text-2xl font-black text-white">$ {totalLocal.toLocaleString()}</p>
                                </div>
                                <Store className="absolute right-[-10px] bottom-[-10px] text-white opacity-10" size={80} />
                            </div>

                            {/* Total Efectivo */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col justify-between transition-colors">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase mb-1 flex items-center"><Wallet size={14} className="mr-1 text-green-600 dark:text-green-400" /> Efectivo en Caja</p>
                                <p className="text-2xl font-black text-green-600 dark:text-green-400">$ {sessionData?.totales_esperados.efectivo_en_caja.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* 2. AUDITORÍA DE VENTAS */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-gray-200 dark:border-slate-700 flex flex-col h-[600px] overflow-hidden transition-colors">
                            {/* Header y Filtros */}
                            <div className="p-4 border-b bg-gray-50 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                        <Receipt className="text-blue-600 dark:text-blue-400" size={20} /> Auditoría de Operaciones
                                    </h3>
                                    <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                                        Total: {filteredSales.length} ops
                                    </span>
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                    {['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Tienda Nube'].map(method => {
                                        const count = getCountByMethod(method);
                                        const isActive = filterMethod === method;
                                        return (
                                            <button
                                                key={method}
                                                onClick={() => setFilterMethod(method)}
                                                className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap
                                                    ${isActive
                                                        ? 'bg-slate-800 dark:bg-blue-600 text-white border-slate-800 dark:border-blue-600 shadow-md transform scale-105'
                                                        : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                                                    }`}
                                            >
                                                {method === 'Tienda Nube' && <Cloud size={12} className="mr-1.5" />}
                                                {method === 'Efectivo' && <Wallet size={12} className="mr-1.5" />}
                                                {method === 'Tarjeta' && <CreditCard size={12} className="mr-1.5" />}
                                                {method === 'Transferencia' && <Smartphone size={12} className="mr-1.5" />}
                                                {method}
                                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-gray-300'}`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tabla Scrollable */}
                            <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-800">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white dark:bg-slate-900 text-gray-400 dark:text-gray-500 font-bold uppercase sticky top-0 shadow-sm z-10 text-xs">
                                        <tr>
                                            <th className="p-4 bg-gray-50/95 dark:bg-slate-800/95">Hora</th>
                                            <th className="p-4 bg-gray-50/95 dark:bg-slate-800/95">Detalle</th>
                                            <th className="p-4 bg-gray-50/95 dark:bg-slate-800/95">Método</th>
                                            <th className="p-4 bg-gray-50/95 dark:bg-slate-800/95 text-right">Monto Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                                        {filteredSales.length === 0 ? (
                                            <tr><td colSpan="4" className="p-10 text-center text-gray-300 dark:text-gray-600 italic">No hay movimientos con este filtro.</td></tr>
                                        ) : (
                                            filteredSales.map(v => (
                                                <tr key={v.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group">
                                                    <td className="p-4 font-mono text-gray-500 dark:text-gray-400 text-xs">{v.fecha.split(' ')[1]}</td>
                                                    <td className="p-4 text-gray-700 dark:text-gray-300 font-medium">
                                                        <div className="truncate max-w-[220px]" title={v.items}>{v.items}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold border inline-flex items-center ${v.metodo.includes('Efectivo') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-800' :
                                                            v.metodo.includes('Tarjeta') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800' :
                                                                v.metodo.includes('Nube') || v.metodo.includes('Tienda') ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-100 dark:border-sky-800' :
                                                                    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-800'
                                                            }`}>
                                                            {v.metodo}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-slate-800 dark:text-white">$ {v.total.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* FOOTER TOTALES - AQUI ESTÁ LA MAGIA CORREGIDA */}
                            <div className="p-4 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center transition-colors">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase block">Resumen Filtro: {filterMethod}</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{filteredSales.length} operaciones encontradas</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">$ {filteredTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUMNA DERECHA: GASTOS Y CIERRE */}
                    <div className="space-y-6">

                        {/* GASTOS */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700 dark:text-white text-sm uppercase flex items-center"><MinusCircle size={16} className="mr-2 text-red-500" /> Salidas / Gastos</h3>
                                <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1 rounded text-xs font-bold transition-colors">
                                    + Nuevo
                                </button>
                            </div>

                            {showExpenseForm && (
                                <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 animate-fade-in mb-4 shadow-inner">
                                    <form onSubmit={handleExpense} className="space-y-3">
                                        <input type="number" autoFocus required className="w-full p-2 text-sm border border-red-200 dark:border-red-800 rounded-lg outline-none bg-white dark:bg-slate-900 dark:text-white" placeholder="Monto $" value={expenseData.monto} onChange={e => setExpenseData({ ...expenseData, monto: e.target.value })} />
                                        <input required className="w-full p-2 text-sm border border-red-200 dark:border-red-800 rounded-lg outline-none bg-white dark:bg-slate-900 dark:text-white" placeholder="Descripción (ej: Comida)" value={expenseData.descripcion} onChange={e => setExpenseData({ ...expenseData, descripcion: e.target.value })} />
                                        <button type="submit" className="w-full bg-red-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-red-600 shadow-sm uppercase">Registrar Salida</button>
                                    </form>
                                </div>
                            )}

                            {sessionData?.movimientos?.length > 0 ? (
                                <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {sessionData.movimientos.map(m => (
                                        <li key={m.id} className="flex justify-between text-xs p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-300 shadow-sm">
                                            <span>{m.descripcion}</span>
                                            <span className="font-bold text-red-500 dark:text-red-400">- ${m.monto.toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-6 bg-gray-50 dark:bg-slate-900 rounded-lg border border-dashed border-gray-200 dark:border-slate-700 transition-colors">
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Sin retiros registrados</p>
                                </div>
                            )}
                        </div>

                        {/* PANEL DE CIERRE */}
                        <div className="bg-slate-900 dark:bg-black text-white p-6 rounded-2xl shadow-xl border border-slate-700 dark:border-slate-800 sticky top-4 transition-colors">
                            <h3 className="font-bold text-lg mb-4 flex items-center">
                                <Lock className="mr-2 text-yellow-400" size={20} /> Arqueo Final
                            </h3>

                            <div className="mb-6">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Dinero Físico (Billetes)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-500 text-xl font-bold">$</span>
                                    <input
                                        type="number" required
                                        className="w-full pl-10 p-3 text-2xl font-black bg-slate-800 dark:bg-slate-900 border-2 border-slate-700 dark:border-slate-800 rounded-xl focus:border-yellow-400 focus:text-yellow-400 outline-none transition-all placeholder-slate-600 text-white"
                                        placeholder="0.00"
                                        value={montoCierre} onChange={e => setMontoCierre(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-6 flex items-start">
                                <AlertTriangle className="text-yellow-500 mr-2 flex-shrink-0" size={16} />
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    Al confirmar, se cerrará el turno y se generará el reporte de caja diario.
                                </p>
                            </div>

                            <button onClick={handleClose} disabled={!montoCierre} className="w-full bg-yellow-500 text-slate-900 py-4 rounded-xl font-black hover:bg-yellow-400 flex justify-center items-center shadow-lg hover:shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide">
                                Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashRegisterPage;