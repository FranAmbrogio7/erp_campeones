import { useEffect, useState, useMemo } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    Lock, Unlock, DollarSign, AlertTriangle, Save, MinusCircle,
    Wallet, CreditCard, Smartphone, Receipt, Eye, Search, Filter,
    ChevronDown, ChevronUp, Clock, Cloud
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CashRegisterPage = () => {
    const { token } = useAuth();

    // Estados Principales
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null);
    const [salesList, setSalesList] = useState([]); // Lista de ventas del turno

    // Estados de UI/Filtros
    const [showSalesDetail, setShowSalesDetail] = useState(false);
    const [filterMethod, setFilterMethod] = useState('Todos'); // Todos, Efectivo, Tarjeta, Transferencia, Tienda Nube

    // Inputs Cierre
    const [montoInicial, setMontoInicial] = useState('');
    const [montoCierre, setMontoCierre] = useState('');

    // Gastos
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseData, setExpenseData] = useState({ monto: '', descripcion: '' });

    // Resultado Cierre
    const [cierreResult, setCierreResult] = useState(null);

    // --- CARGA DE DATOS ---
    const fetchData = async () => {
        try {
            // 1. Estado de Caja
            const resStatus = await api.get('/sales/caja/status');
            setStatus(resStatus.data.estado);

            if (resStatus.data.estado === 'abierta') {
                setSessionData(resStatus.data);

                // 2. Cargar Ventas del Turno (Para auditoría)
                try {
                    const resSales = await api.get('/sales/history', {
                        params: { current_session: true }
                    });
                    setSalesList(resSales.data.history || []);
                } catch (e) { console.error("Error cargando ventas turno", e); }
            }
        } catch (error) {
            toast.error("Error conectando con caja");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    // --- LÓGICA DE FILTRADO ---
    const filteredSales = useMemo(() => {
        if (filterMethod === 'Todos') return salesList;
        // Filtramos buscando el string en el nombre del método (ej: "Tienda Nube" o "Tarjeta Visa")
        return salesList.filter(v => v.metodo.includes(filterMethod));
    }, [salesList, filterMethod]);

    const filteredTotal = useMemo(() => {
        return filteredSales.reduce((acc, curr) => acc + curr.total, 0);
    }, [filteredSales]);

    // --- ACCIONES DE CAJA ---
    const handleOpen = async (e) => {
        e.preventDefault();
        if (!montoInicial || parseFloat(montoInicial) < 0) return toast.error("Monto inválido");
        try {
            await api.post('/sales/caja/open', { monto_inicial: montoInicial });
            fetchData();
            toast.success("Caja Abierta");
        } catch (e) { toast.error(e.response?.data?.msg || "Error"); }
    };

    const handleExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/sales/caja/movement', {
                tipo: 'retiro',
                monto: expenseData.monto,
                descripcion: expenseData.descripcion
            });
            toast.success("Retiro registrado");
            setShowExpenseForm(false);
            setExpenseData({ monto: '', descripcion: '' });
            fetchData(); // Recarga todo
        } catch (e) { toast.error("Error registrando retiro"); }
    };

    const handleClose = async (e) => {
        e.preventDefault();
        if (montoCierre === '' || parseFloat(montoCierre) < 0) return toast.error("Ingresa el monto contado");
        if (!window.confirm(`¿Confirmas cierre con $${parseFloat(montoCierre).toLocaleString()} en EFECTIVO?`)) return;

        try {
            const res = await api.post('/sales/caja/close', { total_real: montoCierre });
            setCierreResult(res.data.resumen);
            setStatus('cerrada');
            setSessionData(null);
            setSalesList([]);
        } catch (e) { toast.error("Error al cerrar caja"); }
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-gray-500">Sincronizando caja...</div>;

    // --- VISTA: RESULTADO DEL CIERRE ---
    if (cierreResult) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-[calc(100vh-100px)] animate-fade-in-down">
                <div className="bg-white p-8 rounded-2xl shadow-2xl border max-w-md w-full text-center">
                    <div className="bg-green-100 p-4 rounded-full inline-block mb-4 text-green-600 shadow-sm"><Lock size={40} /></div>
                    <h2 className="text-3xl font-bold mb-1 text-gray-800">Turno Cerrado</h2>
                    <p className="text-gray-500 text-sm mb-6">Resumen de la operación</p>

                    <div className="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-100">
                        <div className="flex justify-between text-gray-500 text-sm mb-2">
                            <span>Efectivo Sistema:</span>
                            <span className="font-medium">$ {cierreResult.esperado.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-800 text-lg mb-4">
                            <span className="font-bold">Efectivo Real:</span>
                            <span className="font-black text-blue-600">$ {cierreResult.real.toLocaleString()}</span>
                        </div>

                        <div className={`flex justify-between p-3 rounded-lg ${cierreResult.diferencia === 0 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                            <span className="font-bold text-sm flex items-center">Diferencia:</span>
                            <span className="font-black text-lg">
                                {cierreResult.diferencia > 0 ? '+' : ''} $ {cierreResult.diferencia.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => { setCierreResult(null); setMontoCierre(''); setMontoInicial(''); }} className="bg-slate-900 text-white w-full py-3 rounded-xl font-bold hover:bg-black transition-all shadow-lg">Volver a Empezar</button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <Toaster position="top-center" />

            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${status === 'abierta' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {status === 'abierta' ? <Unlock size={24} /> : <Lock size={24} />}
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800">Control de Caja</h1>
                        <p className="text-gray-500 text-sm">{status === 'abierta' ? 'Sesión activa' : 'Turno cerrado'}</p>
                    </div>
                </div>
                {status === 'abierta' && (
                    <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-gray-400 uppercase">Inicio de Turno</p>
                        <p className="font-mono text-gray-700 font-bold">{sessionData?.fecha_apertura}</p>
                    </div>
                )}
            </div>

            {status === 'cerrada' ? (
                /* --- VISTA APERTURA --- */
                <div className="max-w-lg mx-auto mt-10">
                    <form onSubmit={handleOpen} className="bg-white p-8 rounded-2xl shadow-xl border border-blue-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Apertura de Turno</h2>

                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fondo de Caja (Cambio Inicial)</label>
                        <div className="relative mb-8">
                            <span className="absolute left-4 top-3.5 text-gray-400 font-bold text-lg">$</span>
                            <input
                                type="number" required autoFocus
                                className="w-full pl-10 p-3 text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                placeholder="0.00"
                                value={montoInicial} onChange={e => setMontoInicial(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg hover:shadow-blue-200 transition-all flex justify-center items-center">
                            <Unlock size={20} className="mr-2" /> ABRIR CAJA
                        </button>
                    </form>
                </div>
            ) : (
                /* --- VISTA CONTROL (CAJA ABIERTA) --- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COLUMNA IZQUIERDA: RESUMEN FINANCIERO */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* TARJETAS DE TOTALES */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden group hover:border-yellow-300 transition-colors">
                            <div className="relative z-10">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center">
                                    <Unlock size={12} className="mr-1" /> Caja Inicial
                                </p>
                                <p className="text-2xl font-black text-gray-800 group-hover:text-yellow-600 transition-colors">
                                    $ {sessionData?.monto_inicial?.toLocaleString() || '0'}
                                </p>
                            </div>
                            <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Unlock size={64} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden group hover:border-green-300 transition-colors">
                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center"><Wallet size={12} className="mr-1" /> Efectivo (Teórico)</p>
                                    <p className="text-2xl font-black text-gray-800 group-hover:text-green-600 transition-colors">$ {sessionData?.totales_esperados.efectivo_en_caja.toLocaleString()}</p>
                                </div>
                                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={64} /></div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden group hover:border-blue-300 transition-colors">
                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center"><CreditCard size={12} className="mr-1" /> Tarjetas</p>
                                    <p className="text-2xl font-black text-gray-800 group-hover:text-blue-600 transition-colors">$ {sessionData?.desglose.tarjeta.toLocaleString()}</p>
                                </div>
                                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><CreditCard size={64} /></div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative overflow-hidden group hover:border-purple-300 transition-colors">
                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center"><Smartphone size={12} className="mr-1" /> Transferencias</p>
                                    <p className="text-2xl font-black text-gray-800 group-hover:text-purple-600 transition-colors">$ {sessionData?.desglose.transferencia.toLocaleString()}</p>
                                </div>
                                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Smartphone size={64} /></div>
                            </div>
                        </div>

                        {/* SECCIÓN DETALLE DE VENTAS */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div
                                className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => setShowSalesDetail(!showSalesDetail)}
                            >
                                <div className="flex items-center gap-2">
                                    <Receipt size={18} className="text-slate-500" />
                                    <h3 className="font-bold text-gray-700 text-sm">Auditoría de Ventas</h3>
                                    <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{salesList.length} ops</span>
                                </div>
                                {showSalesDetail ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                            </div>

                            {showSalesDetail && (
                                <div className="p-4 bg-slate-50/50 animate-fade-in">
                                    {/* FILTROS RÁPIDOS */}
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                        {['Todos', 'Efectivo', 'Tarjeta', 'Transferencia', 'Tienda Nube'].map(method => (
                                            <button
                                                key={method}
                                                onClick={() => setFilterMethod(method)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${filterMethod === method
                                                    ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {method === 'Tienda Nube' && <Cloud size={10} className="inline mr-1" />}
                                                {method}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tabla Compacta */}
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-60 overflow-y-auto shadow-inner">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-50 text-gray-400 font-bold uppercase sticky top-0">
                                                <tr>
                                                    <th className="p-3">Hora</th>
                                                    <th className="p-3">Items</th>
                                                    <th className="p-3">Método</th>
                                                    <th className="p-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {filteredSales.length === 0 ? (
                                                    <tr><td colSpan="4" className="p-4 text-center text-gray-400 italic">No hay movimientos.</td></tr>
                                                ) : (
                                                    filteredSales.map(v => (
                                                        <tr key={v.id} className="hover:bg-blue-50/50 transition-colors">
                                                            <td className="p-3 font-mono text-gray-500">{v.fecha.split(' ')[1]}</td>
                                                            <td className="p-3 text-gray-700 truncate max-w-[150px]" title={v.items}>{v.items}</td>
                                                            <td className="p-3">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex w-fit items-center ${v.metodo.includes('Efectivo') ? 'bg-green-50 text-green-700 border-green-100' :
                                                                        v.metodo.includes('Tarjeta') ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                            v.metodo.includes('Nube') || v.metodo.includes('Tienda') ? 'bg-sky-50 text-sky-700 border-sky-100' :
                                                                                'bg-purple-50 text-purple-700 border-purple-100'
                                                                    }`}>
                                                                    {(v.metodo.includes('Nube') || v.metodo.includes('Tienda')) && <Cloud size={10} className="mr-1" />}
                                                                    {v.metodo}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right font-bold text-gray-800">$ {v.total.toLocaleString()}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Footer Totales Filtrados */}
                                    <div className="flex justify-between items-center mt-3 px-2">
                                        <span className="text-xs text-gray-400 font-bold uppercase">Total Filtrado ({filterMethod})</span>
                                        <span className="text-lg font-black text-slate-800 border-b-2 border-slate-200 border-dotted">$ {filteredTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    {/* COLUMNA DERECHA: GASTOS Y CIERRE */}
                    <div className="space-y-6">

                        {/* GASTOS / RETIROS */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700 text-sm uppercase">Salidas de Caja</h3>
                                <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Agregar Gasto">
                                    <MinusCircle size={20} />
                                </button>
                            </div>

                            {showExpenseForm && (
                                <div className="bg-red-50 p-3 rounded-xl border border-red-100 animate-fade-in mb-4">
                                    <form onSubmit={handleExpense} className="space-y-3">
                                        <input type="number" autoFocus required className="w-full p-2 text-sm border border-red-200 rounded-lg outline-none" placeholder="Monto $" value={expenseData.monto} onChange={e => setExpenseData({ ...expenseData, monto: e.target.value })} />
                                        <input required className="w-full p-2 text-sm border border-red-200 rounded-lg outline-none" placeholder="Motivo (ej: Comida)" value={expenseData.descripcion} onChange={e => setExpenseData({ ...expenseData, descripcion: e.target.value })} />
                                        <button type="submit" className="w-full bg-red-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-red-600 shadow-sm">CONFIRMAR RETIRO</button>
                                    </form>
                                </div>
                            )}

                            {sessionData?.movimientos?.length > 0 ? (
                                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {sessionData.movimientos.map(m => (
                                        <li key={m.id} className="flex justify-between text-xs p-2 bg-gray-50 rounded border border-gray-100 text-gray-600">
                                            <span>{m.descripcion}</span>
                                            <span className="font-bold text-red-500">- ${m.monto.toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-center text-xs text-gray-300 italic py-4">Sin retiros registrados</p>
                            )}
                        </div>

                        {/* ZONA DE CIERRE (STICKY EN PANTALLAS GRANDES O NO, SEGÚN PREFERENCIA) */}
                        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
                            <h3 className="font-bold text-lg mb-4 flex items-center">
                                <Lock className="mr-2 text-yellow-400" size={20} /> Arqueo Final
                            </h3>

                            <div className="mb-6">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Dinero Físico (Billetes)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-3 text-slate-500 text-xl font-bold">$</span>
                                    <input
                                        type="number" required
                                        className="w-full pl-10 p-3 text-2xl font-black bg-slate-800 border-2 border-slate-700 rounded-xl focus:border-yellow-400 focus:text-yellow-400 outline-none transition-all placeholder-slate-600 text-white"
                                        placeholder="0.00"
                                        value={montoCierre} onChange={e => setMontoCierre(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 mb-6 flex items-start">
                                <AlertTriangle className="text-yellow-500 mr-2 flex-shrink-0" size={16} />
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    Al confirmar, se cerrará el turno y no podrás realizar más ventas hasta abrir uno nuevo.
                                </p>
                            </div>

                            <button
                                onClick={handleClose}
                                disabled={!montoCierre}
                                className="w-full bg-yellow-500 text-slate-900 py-4 rounded-xl font-black hover:bg-yellow-400 flex justify-center items-center shadow-lg hover:shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                CERRAR CAJA
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default CashRegisterPage;