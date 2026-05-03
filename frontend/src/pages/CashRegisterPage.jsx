import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    Lock, Unlock, Wallet, CreditCard, Smartphone, Receipt,
    Cloud, MinusCircle, AlertTriangle, Store, CheckCircle2,
    MonitorSmartphone
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CashRegisterPage = () => {
    const { token } = useAuth();

    // --- IDENTIDAD DE LA TERMINAL (Persistente) ---
    const [tipoCaja, setTipoCaja] = useState(() => {
        return localStorage.getItem('terminal_tipo_caja') || 'PRINCIPAL';
    });

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
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const resStatus = await api.get('/sales/caja/status', { params: { tipo_caja: tipoCaja } });
            setStatus(resStatus.data.estado);
            if (resStatus.data.estado === 'abierta') {
                setSessionData(resStatus.data);
                try {
                    const resSales = await api.get('/sales/history', { params: { current_session: true, tipo_caja: tipoCaja } });
                    setSalesList(resSales.data.history || []);
                } catch (e) { console.error("Error historial", e); }
            } else {
                setSessionData(null);
                setSalesList([]);
            }
        } catch (error) { toast.error("Error conectando con caja"); }
        finally { setLoading(false); }
    }, [tipoCaja]);

    useEffect(() => {
        localStorage.setItem('terminal_tipo_caja', tipoCaja);
        if (token) fetchData();
    }, [tipoCaja, token, fetchData]);

    // --- CÁLCULOS Y MEMOS ---
    const totalLocal = useMemo(() => {
        return salesList
            .filter(v => !v.metodo.toLowerCase().includes('nube') && !v.metodo.toLowerCase().includes('tienda'))
            .reduce((acc, curr) => acc + curr.total, 0);
    }, [salesList]);

    const filteredSales = useMemo(() => {
        if (filterMethod === 'Todos') return salesList;
        return salesList.filter(v => v.metodo.includes(filterMethod));
    }, [salesList, filterMethod]);

    const filteredTotal = useMemo(() => {
        if (filterMethod === 'Todos') {
            return salesList.reduce((acc, curr) => acc + curr.total, 0);
        }
        return salesList.reduce((acc, sale) => {
            if (sale.pagos_detalle && sale.pagos_detalle.length > 0) {
                const partesQueCoinciden = sale.pagos_detalle.filter(p => p.metodo.includes(filterMethod));
                return acc + partesQueCoinciden.reduce((sum, p) => sum + p.monto, 0);
            }
            if (sale.metodo.includes(filterMethod)) return acc + sale.total;
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
        try { 
            await api.post('/sales/caja/open', { monto_inicial: montoInicial, tipo_caja: tipoCaja }); 
            fetchData(); 
            toast.success(`Caja ${tipoCaja} Abierta`); 
        }
        catch (e) { toast.error(e.response?.data?.msg || "Error abriendo caja"); }
    };

    const handleExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/sales/caja/movement', { tipo: 'retiro', monto: expenseData.monto, descripcion: expenseData.descripcion, tipo_caja: tipoCaja });
            toast.success("Retiro registrado"); setShowExpenseForm(false); setExpenseData({ monto: '', descripcion: '' }); fetchData();
        } catch (e) { toast.error("Error registrando retiro"); }
    };

    const handleClose = async (e) => {
        e.preventDefault();
        if (montoCierre === '') return toast.error("Ingresa el efectivo real");
        if (!window.confirm(`¿Cerrar turno con $${parseFloat(montoCierre).toLocaleString()} en billetes?`)) return;
        try {
            const res = await api.post('/sales/caja/close', { total_real: montoCierre, tipo_caja: tipoCaja });
            setCierreResult(res.data.resumen); setStatus('cerrada'); setSessionData(null); setSalesList([]);
        } catch (e) { toast.error("Error al cerrar"); }
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-950 h-full flex items-center justify-center font-bold tracking-widest uppercase">Cargando Operaciones...</div>;

    // --- PANTALLA DE RESULTADO CIERRE ---
    if (cierreResult) {
        return (
            <div className="p-4 flex flex-col items-center justify-center h-[calc(100vh-4rem)] animate-fade-in-down bg-slate-50 dark:bg-slate-950">
                <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 max-w-md w-full text-center transition-colors relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-full inline-block mb-6 text-emerald-500 dark:text-emerald-400 shadow-inner">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-3xl font-black mb-2 text-slate-800 dark:text-white tracking-tight">Turno Cerrado</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 font-medium">El reporte de caja ha sido generado con éxito.</p>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm mb-3 font-bold uppercase tracking-wider">
                            <span>Esperado:</span>
                            <span className="text-slate-700 dark:text-slate-300">$ {cierreResult.esperado.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-slate-800 dark:text-white text-lg mb-5 border-b border-slate-200 dark:border-slate-700 pb-4">
                            <span className="font-black">Efectivo Real:</span>
                            <span className="font-black text-indigo-600 dark:text-indigo-400">$ {cierreResult.real.toLocaleString()}</span>
                        </div>
                        <div className={`flex justify-between items-center p-4 rounded-xl shadow-sm ${cierreResult.diferencia === 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50'}`}>
                            <span className="font-black text-xs uppercase tracking-widest">Diferencia:</span>
                            <span className="font-black text-xl">{cierreResult.diferencia > 0 ? '+' : ''} $ {cierreResult.diferencia.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <button onClick={() => { setCierreResult(null); setMontoCierre(''); setMontoInicial(''); }} className="bg-slate-800 dark:bg-slate-800 text-white w-full py-4 rounded-xl font-black hover:bg-slate-900 dark:hover:bg-slate-700 transition-all shadow-lg active:scale-95 tracking-wide uppercase text-sm">
                        Volver al Inicio
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-5 max-w-[1600px] mx-auto gap-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative font-sans">
            <Toaster position="top-center" toastOptions={{ style: { borderRadius: '12px', fontWeight: 'bold' } }} />

            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-900 p-4 md:px-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 shrink-0 transition-colors gap-4">
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl shadow-inner shrink-0 ${status === 'abierta' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                        {status === 'abierta' ? <Unlock size={22} /> : <Lock size={22} />}
                    </div>
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-1">
                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center">
                                Centro de Caja
                            </h1>
                            {/* AQUÍ MUDAMOS EL SELECTOR: AHORA SIEMPRE ES VISIBLE */}
                            <select
                                value={tipoCaja}
                                onChange={(e) => setTipoCaja(e.target.value)}
                                className={`text-[11px] font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border outline-none cursor-pointer shadow-sm transition-colors ${
                                    tipoCaja === 'MERCHANDISING' 
                                        ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' 
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
                                }`}
                            >
                                <option value="PRINCIPAL">🏢 CAJA CAMPEONES</option>
                                <option value="MERCHANDISING">👕 CAJA MERCH</option>
                            </select>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold tracking-wide uppercase">
                            {status === 'abierta' ? 'Sesión Operativa Activa' : 'Turno Cerrado / Inactivo'}
                        </p>
                    </div>
                </div>
                {status === 'abierta' && (
                    <div className="text-right w-full md:w-auto bg-slate-50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Apertura</p>
                        <p className="font-mono text-slate-700 dark:text-slate-300 font-bold text-sm">{sessionData?.fecha_apertura}</p>
                    </div>
                )}
            </div>

            {status === 'cerrada' ? (
                /* --- VISTA APERTURA --- */
                <div className="max-w-md mx-auto mt-12 w-full animate-fade-in-up">
                    <form onSubmit={handleOpen} className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-3xl shadow-xl border border-indigo-100 dark:border-slate-800 relative overflow-hidden transition-colors">
                        <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${tipoCaja === 'MERCHANDISING' ? 'from-purple-500 to-fuchsia-500' : 'from-indigo-500 to-blue-500'}`}></div>
                        <div className="flex justify-center mb-6">
                            <div className={`p-4 rounded-full ${tipoCaja === 'MERCHANDISING' ? 'bg-purple-50 text-purple-500 dark:bg-purple-900/20' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-900/20'}`}>
                                <Unlock size={32}/>
                            </div>
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-8 text-center tracking-tight">Iniciar Turno</h2>

                        <div className="mb-8">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Fondo Fijo Inicial (Billetes)</label>
                            <div className="relative">
                                <span className={`absolute left-5 top-4 font-black text-xl ${tipoCaja === 'MERCHANDISING' ? 'text-purple-400 dark:text-purple-500' : 'text-indigo-400 dark:text-indigo-500'}`}>$</span>
                                <input type="number" required autoFocus className={`w-full pl-12 p-4 text-3xl font-black border-2 rounded-2xl bg-slate-50 dark:bg-slate-800 outline-none transition-all text-center placeholder-slate-300 dark:placeholder-slate-600 shadow-inner ${tipoCaja === 'MERCHANDISING' ? 'border-purple-200 dark:border-purple-800 focus:border-purple-500 text-purple-900 dark:text-white' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500 text-indigo-900 dark:text-white'}`} placeholder="0.00" value={montoInicial} onChange={e => setMontoInicial(e.target.value)} />
                            </div>
                        </div>
                        <button type="submit" className={`w-full text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg flex justify-center items-center transition-all active:scale-[0.98] ${tipoCaja === 'MERCHANDISING' ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 shadow-purple-500/30' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/30'}`}><Unlock size={18} className="mr-2" /> ABRIR CAJA {tipoCaja === 'MERCHANDISING' ? 'MERCH' : ''}</button>
                    </form>
                </div>
            ) : (
                /* --- VISTA DASHBOARD --- */
                <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 animate-fade-in">
                    <div className="w-full lg:w-[65%] xl:w-[72%] flex flex-col gap-4 min-h-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-colors">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center"><Unlock size={12} className="mr-1.5" /> Fondo Inicial</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">$ {sessionData?.monto_inicial?.toLocaleString()}</p>
                            </div>

                            <div className={`text-white p-5 rounded-2xl shadow-md flex flex-col justify-center relative overflow-hidden transition-colors ${tipoCaja === 'MERCHANDISING' ? 'bg-gradient-to-br from-purple-600 to-fuchsia-700 dark:from-purple-800 dark:to-fuchsia-900' : 'bg-gradient-to-br from-indigo-600 to-blue-700 dark:from-indigo-800 dark:to-blue-900'}`}>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1.5 flex items-center"><Store size={12} className="mr-1.5 text-white" /> Venta Local (Física)</p>
                                    <p className="text-2xl font-black text-white font-mono tracking-tighter">$ {totalLocal.toLocaleString()}</p>
                                </div>
                                <Store className="absolute right-[-10px] bottom-[-10px] text-white opacity-10" size={70} />
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-center transition-colors">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center"><Wallet size={12} className="mr-1.5 text-emerald-500" /> Billetes en Caja</p>
                                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">$ {sessionData?.totales_esperados.efectivo_en_caja.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex-1 flex flex-col min-h-0 overflow-hidden transition-colors relative">
                            <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 shrink-0">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                    <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center tracking-tight">
                                        <Receipt className={`${tipoCaja === 'MERCHANDISING' ? 'text-purple-500' : 'text-indigo-500'} mr-2`} size={22} /> Auditoría de Operaciones
                                    </h3>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-inner border ${tipoCaja === 'MERCHANDISING' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-purple-100 dark:border-purple-800' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'}`}>
                                        Total: {filteredSales.length} transacciones
                                    </span>
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                    {['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Tienda Nube'].map(method => {
                                        const count = getCountByMethod(method);
                                        const isActive = filterMethod === method;
                                        return (
                                            <button
                                                key={method}
                                                onClick={() => setFilterMethod(method)}
                                                className={`flex items-center px-4 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap active:scale-95 shadow-sm
                                                    ${isActive
                                                        ? (tipoCaja === 'MERCHANDISING' ? 'bg-slate-800 dark:bg-purple-600 text-white border-slate-800 dark:border-purple-600' : 'bg-slate-800 dark:bg-indigo-600 text-white border-slate-800 dark:border-indigo-600')
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {method === 'Tienda Nube' && <Cloud size={14} className={`mr-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                                                {method === 'Efectivo' && <Wallet size={14} className={`mr-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                                                {method === 'Tarjeta' && <CreditCard size={14} className={`mr-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                                                {method === 'Transferencia' && <Smartphone size={14} className={`mr-2 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
                                                {method}
                                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-400 dark:text-slate-500 font-black tracking-widest uppercase sticky top-0 shadow-sm z-10 text-[10px]">
                                        <tr>
                                            <th className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 w-24">Hora</th>
                                            <th className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">Descripción / Ítems</th>
                                            <th className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 w-40">Pago</th>
                                            <th className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-right w-36">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                        {filteredSales.length === 0 ? (
                                            <tr><td colSpan="4" className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">No se registraron movimientos.</td></tr>
                                        ) : (
                                            filteredSales.map(v => (
                                                <tr key={v.id} className={`hover:bg-opacity-50 transition-colors group ${tipoCaja === 'MERCHANDISING' ? 'hover:bg-purple-50 dark:hover:bg-slate-700/50' : 'hover:bg-indigo-50 dark:hover:bg-slate-700/50'}`}>
                                                    <td className="px-5 py-3.5 font-mono text-slate-500 dark:text-slate-400 text-xs font-bold">{v.fecha.split(' ')[1]}</td>
                                                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-200 font-bold text-xs">
                                                        <div className="truncate max-w-[200px] md:max-w-[300px] lg:max-w-[400px]" title={v.items}>{v.items}</div>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border inline-flex items-center shadow-sm
                                                            ${v.metodo.includes('Efectivo') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
                                                            v.metodo.includes('Tarjeta') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                                                                v.metodo.includes('Nube') || v.metodo.includes('Tienda') ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/50' :
                                                                    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
                                                            }`}>
                                                            {v.metodo}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-black text-slate-800 dark:text-white font-mono tracking-tight text-sm">$ {v.total.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 md:p-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5">Filtrando: {filterMethod}</span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{filteredSales.length} coincidencias</span>
                                </div>
                                <div className="text-right flex items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-3">Subtotal Filtro</span>
                                    <span className={`text-3xl font-black tracking-tighter font-mono ${tipoCaja === 'MERCHANDISING' ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}`}>$ {filteredTotal.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-[35%] xl:w-[28%] flex flex-col gap-4 overflow-y-auto no-scrollbar shrink-0">
                        <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest flex items-center"><MinusCircle size={18} className="mr-2 text-red-500" /> Salidas / Gastos</h3>
                                <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 dark:bg-red-900/20 dark:hover:bg-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-red-100 dark:border-red-900/50">
                                    {showExpenseForm ? 'Cancelar' : '+ Registrar'}
                                </button>
                            </div>

                            {showExpenseForm && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-fade-in-down mb-5 shadow-inner">
                                    <form onSubmit={handleExpense} className="space-y-3">
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                                            <input type="number" autoFocus required className="w-full pl-8 p-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-red-400 bg-white dark:bg-slate-900 dark:text-white transition-colors" placeholder="0.00" value={expenseData.monto} onChange={e => setExpenseData({ ...expenseData, monto: e.target.value })} />
                                        </div>
                                        <input required className="w-full p-2.5 text-sm font-bold border-2 border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-red-400 bg-white dark:bg-slate-900 dark:text-white transition-colors" placeholder="Descripción del retiro..." value={expenseData.descripcion} onChange={e => setExpenseData({ ...expenseData, descripcion: e.target.value })} />
                                        <button type="submit" className="w-full bg-red-500 text-white py-3 rounded-lg font-black text-xs hover:bg-red-600 shadow-md transition-all active:scale-95 uppercase tracking-widest">Confirmar Retiro</button>
                                    </form>
                                </div>
                            )}

                            {sessionData?.movimientos?.length > 0 ? (
                                <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {sessionData.movimientos.map(m => (
                                        <li key={m.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                                            <span className="text-xs font-bold truncate pr-4">{m.descripcion}</span>
                                            <span className="font-black text-red-500 dark:text-red-400 font-mono tracking-tight">- ${m.monto.toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 transition-colors">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Caja sin retiros</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-800 dark:bg-black text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700 dark:border-slate-800 relative overflow-hidden transition-colors">
                            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${tipoCaja === 'MERCHANDISING' ? 'bg-fuchsia-500/10' : 'bg-amber-500/10'}`}></div>
                            
                            <h3 className="font-black text-xl mb-6 flex items-center tracking-tight relative z-10">
                                <Lock className={`mr-3 ${tipoCaja === 'MERCHANDISING' ? 'text-fuchsia-400' : 'text-amber-400'}`} size={24} /> Corte de Caja
                            </h3>

                            <div className="mb-6 relative z-10">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Arqueo: Dinero Físico Real</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3.5 text-slate-400 font-black text-xl">$</span>
                                    <input
                                        type="number" required
                                        className={`w-full pl-10 p-3.5 text-2xl font-black bg-slate-900/50 dark:bg-slate-900 border-2 border-slate-600 dark:border-slate-800 rounded-2xl outline-none transition-all placeholder-slate-600 text-white shadow-inner text-center ${tipoCaja === 'MERCHANDISING' ? 'focus:border-fuchsia-400 focus:text-fuchsia-400' : 'focus:border-amber-400 focus:text-amber-400'}`}
                                        placeholder="0.00"
                                        value={montoCierre} onChange={e => setMontoCierre(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-900/50 dark:bg-slate-900 p-4 rounded-xl border border-slate-700 dark:border-slate-800 mb-6 flex items-start relative z-10 shadow-inner">
                                <AlertTriangle className={`${tipoCaja === 'MERCHANDISING' ? 'text-fuchsia-400' : 'text-amber-400'} mr-3 flex-shrink-0 mt-0.5`} size={18} />
                                <p className="text-[11px] font-medium text-slate-300 leading-relaxed">
                                    Verifica los billetes. Al confirmar, la caja se cerrará y se imprimirá el informe "Z".
                                </p>
                            </div>

                            <button onClick={handleClose} disabled={!montoCierre} className={`w-full text-slate-900 py-4 rounded-2xl font-black text-sm flex justify-center items-center shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest relative z-10 ${tipoCaja === 'MERCHANDISING' ? 'bg-fuchsia-400 hover:bg-fuchsia-300 shadow-fuchsia-500/20' : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'}`}>
                                Confirmar Cierre
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashRegisterPage;