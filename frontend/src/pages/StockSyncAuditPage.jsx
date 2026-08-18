import { useState, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ArrowLeft, RefreshCw, AlertTriangle, Link2Off, PackageX,
    ArrowUpDown, CheckCircle2, Loader2, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const CAUSA_INFO = {
    sin_vincular: {
        label: 'Sin vincular',
        icon: Link2Off,
        color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
    },
    no_encontrado_en_tn: {
        label: 'No existe en TN',
        icon: PackageX,
        color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
    },
    stock_desincronizado: {
        label: 'Stock desincronizado',
        icon: ArrowUpDown,
        color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
    }
};

const StockSyncAuditPage = () => {
    const { token } = useAuth();

    const [discrepancias, setDiscrepancias] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastRun, setLastRun] = useState(null);
    const [syncingId, setSyncingId] = useState(null);
    const [filtroCausa, setFiltroCausa] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [errorMsg, setErrorMsg] = useState(null);

    const runAudit = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await api.get('/products/sync/audit-stock');
            setDiscrepancias(res.data.discrepancias || []);
            setResumen(res.data.resumen || null);
            setLastRun(new Date());
            if ((res.data.discrepancias || []).length === 0) {
                toast.success('¡Todo sincronizado! No se encontraron diferencias.');
            } else {
                toast.success(`Auditoría completa: ${res.data.total} diferencia(s) encontradas.`);
            }
        } catch (error) {
            const msg = error.response?.data?.error || error.response?.data?.msg || 'Error al ejecutar la auditoría';
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleForceSync = async (item) => {
        setSyncingId(item.id_variante);
        try {
            const res = await api.post(`/products/sync/force-stock/${item.id_variante}`);
            toast.success(`Stock de "${item.producto_nombre}" (${item.talle}) sincronizado a ${res.data.stock_local}`);
            setDiscrepancias(prev => prev.filter(d => d.id_variante !== item.id_variante));
        } catch (error) {
            const msg = error.response?.data?.msg || 'No se pudo sincronizar';
            toast.error(msg);
        } finally {
            setSyncingId(null);
        }
    };

    const filtered = discrepancias.filter(d => {
        if (filtroCausa && d.causa !== filtroCausa) return false;
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            return d.producto_nombre?.toLowerCase().includes(t) || d.sku?.toLowerCase().includes(t);
        }
        return true;
    });

    if (!token) return null;

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 overflow-hidden animate-fade-in transition-colors duration-300">
            <Toaster position="top-center" />

            {/* TOPBAR */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 shadow-md z-30 shrink-0">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center whitespace-nowrap">
                                <ArrowUpDown className="mr-2 text-blue-600" /> Auditoría de Stock ERP ↔ Tienda Nube
                            </h1>
                        </div>

                        <button
                            onClick={runAudit}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 px-6 rounded-xl text-sm font-bold flex items-center shadow-lg transition-all active:scale-95 whitespace-nowrap"
                        >
                            {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}
                            {loading ? 'Consultando Tienda Nube...' : 'Ejecutar Auditoría'}
                        </button>
                    </div>

                    {lastRun && (
                        <p className="text-xs text-gray-400 mt-2">Última ejecución: {lastRun.toLocaleString()}</p>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-[1400px] mx-auto space-y-4">

                    {errorMsg && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">No se pudo completar la auditoría</p>
                                <p className="text-sm">{errorMsg}</p>
                            </div>
                        </div>
                    )}

                    {/* RESUMEN */}
                    {resumen && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {Object.entries(CAUSA_INFO).map(([key, info]) => {
                                const Icon = info.icon;
                                const count = resumen[key] || 0;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setFiltroCausa(filtroCausa === key ? '' : key)}
                                        className={`text-left p-4 rounded-xl border-2 transition-all ${filtroCausa === key ? info.color : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <Icon size={20} className={filtroCausa === key ? '' : 'text-gray-400'} />
                                            <span className="text-2xl font-black text-gray-800 dark:text-white">{count}</span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{info.label}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* BUSCADOR */}
                    {discrepancias.length > 0 && (
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-medium text-gray-700 dark:text-white"
                                placeholder="Buscar por producto o SKU..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {/* TABLA */}
                    {!loading && discrepancias.length === 0 && !errorMsg && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            {lastRun ? (
                                <>
                                    <CheckCircle2 size={48} className="mb-2 text-emerald-500" />
                                    <p className="text-lg font-bold text-gray-600 dark:text-gray-300">Sin diferencias de stock</p>
                                    <p className="text-sm">El ERP y Tienda Nube están sincronizados.</p>
                                </>
                            ) : (
                                <>
                                    <ArrowUpDown size={48} className="mb-2 opacity-20" />
                                    <p className="text-lg font-bold opacity-60">Listo para auditar</p>
                                    <p className="text-sm opacity-60">Presioná "Ejecutar Auditoría" para comparar el stock local contra Tienda Nube.</p>
                                </>
                            )}
                        </div>
                    )}

                    {filtered.length > 0 && (
                        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase text-xs font-bold">
                                        <tr>
                                            <th className="text-left p-3">Producto</th>
                                            <th className="text-left p-3">SKU</th>
                                            <th className="text-center p-3">Stock ERP</th>
                                            <th className="text-center p-3">Stock TN</th>
                                            <th className="text-center p-3">Diferencia</th>
                                            <th className="text-left p-3">Causa probable</th>
                                            <th className="text-right p-3">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filtered.map(item => {
                                            const info = CAUSA_INFO[item.causa];
                                            const Icon = info?.icon || AlertTriangle;
                                            const puedeForzar = item.causa === 'stock_desincronizado';
                                            return (
                                                <tr key={item.id_variante} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3">
                                                        <p className="font-bold text-gray-800 dark:text-white">{item.producto_nombre}</p>
                                                        <p className="text-xs text-gray-400">{item.talle}{item.estampa !== '-' ? ` · ${item.estampa}` : ''}</p>
                                                    </td>
                                                    <td className="p-3 font-mono text-xs text-gray-500 dark:text-gray-400">{item.sku || '-'}</td>
                                                    <td className="p-3 text-center font-bold text-gray-700 dark:text-gray-200">{item.stock_local}</td>
                                                    <td className="p-3 text-center font-bold text-gray-700 dark:text-gray-200">{item.stock_nube ?? '—'}</td>
                                                    <td className="p-3 text-center">
                                                        {item.diferencia !== null && item.diferencia !== undefined && (
                                                            <span className={`font-mono font-bold ${item.diferencia > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {item.diferencia > 0 ? '+' : ''}{item.diferencia}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-bold ${info?.color}`} title={item.causa_detalle}>
                                                            <Icon size={14} />
                                                            {info?.label || item.causa}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {puedeForzar ? (
                                                            <button
                                                                onClick={() => handleForceSync(item)}
                                                                disabled={syncingId === item.id_variante}
                                                                className="bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 ml-auto transition-all"
                                                            >
                                                                {syncingId === item.id_variante
                                                                    ? <Loader2 size={14} className="animate-spin" />
                                                                    : <RefreshCw size={14} />}
                                                                Forzar sync
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-gray-300 dark:text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StockSyncAuditPage;
