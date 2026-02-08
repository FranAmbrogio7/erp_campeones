import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ScanBarcode, Save, Trash2, RotateCcw, PackageCheck,
    PlusCircle, AlertTriangle, Search, X, Image as ImageIcon,
    Shirt, ChevronRight, CheckCircle2, Printer
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const StockTakePage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE CONTROL ---
    const [activeTab, setActiveTab] = useState('scan');
    const [updateMode, setUpdateMode] = useState('replace');

    // --- ESTADOS DE DATOS ---
    const [scannedItems, setScannedItems] = useState(() => {
        const saved = localStorage.getItem('stockTakeSession');
        return saved ? JSON.parse(saved) : [];
    });

    const [skuInput, setSkuInput] = useState('');
    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Refs
    const scanInputRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        localStorage.setItem('stockTakeSession', JSON.stringify(scannedItems));
    }, [scannedItems]);

    useEffect(() => {
        const focusInterval = setInterval(() => {
            if (activeTab === 'scan' && document.activeElement !== scanInputRef.current) {
                scanInputRef.current?.focus();
            }
        }, 2000);
        return () => clearInterval(focusInterval);
    }, [activeTab]);

    useEffect(() => {
        if (!manualTerm.trim()) {
            setManualResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await api.get('/products', { params: { search: manualTerm, limit: 20 } });
                setManualResults(res.data.products || []);
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [manualTerm]);


    const addOrIncrementItem = (itemData) => {
        setScannedItems(prev => {
            const existingIdx = prev.findIndex(i => i.sku === itemData.sku);
            if (existingIdx >= 0) {
                const newList = [...prev];
                newList[existingIdx].cantidad += 1;
                return newList;
            }
            return [{
                sku: itemData.sku,
                nombre: itemData.nombre,
                talle: itemData.talle,
                imagen: itemData.imagen,
                stock_sistema: itemData.stock_sistema,
                cantidad: 1
            }, ...prev];
        });
        toast.success(`+1 ${itemData.nombre} (${itemData.talle})`, { position: 'bottom-right', duration: 1000, icon: '📦' });
    };

    const handleScanSubmit = async (e) => {
        e.preventDefault();
        if (!skuInput.trim()) return;

        try {
            const res = await api.get(`/sales/scan/${skuInput}`);
            if (res.data.found) {
                const p = res.data.product;
                addOrIncrementItem({
                    sku: p.sku,
                    nombre: p.nombre,
                    talle: p.talle,
                    imagen: p.imagen,
                    stock_sistema: p.stock_actual
                });
                setSkuInput('');
            } else {
                toast.error("Producto no encontrado");
            }
        } catch (e) { toast.error("Error al buscar código"); }
    };

    const handleManualSelect = (product, variant) => {
        addOrIncrementItem({
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            imagen: product.imagen,
            stock_sistema: variant.stock
        });
    };

    const updateQuantity = (sku, val) => {
        const qty = parseInt(val) || 0;
        setScannedItems(prev => prev.map(i => i.sku === sku ? { ...i, cantidad: qty } : i));
    };

    const removeItem = (sku) => setScannedItems(prev => prev.filter(i => i.sku !== sku));

    const handleReset = () => {
        if (window.confirm("¿Borrar todo el conteo actual?")) {
            setScannedItems([]);
            localStorage.removeItem('stockTakeSession');
            toast("Lista reiniciada");
        }
    };

    const generatePdf = async (items) => {
        const loadToast = toast.loading("Generando PDF...");
        try {
            const res = await api.post('/products/labels/batch-pdf', { items }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Etiquetas_Ingreso_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Descargando etiquetas...", { id: loadToast });
        } catch (e) {
            console.error(e);
            toast.error("Error al generar PDF", { id: loadToast });
        }
    };

    const handlePrintList = async () => {
        if (scannedItems.length === 0) return toast.error("No hay items para imprimir");
        const totalEtiquetas = scannedItems.reduce((acc, i) => acc + i.cantidad, 0);
        if (!window.confirm(`¿Imprimir ${totalEtiquetas} etiquetas correspondientes a esta lista?`)) return;

        const itemsToPrint = scannedItems.map(i => ({
            sku: i.sku,
            nombre: i.nombre,
            talle: i.talle,
            cantidad: i.cantidad
        }));

        await generatePdf(itemsToPrint);
    };

    const handleSave = async () => {
        if (scannedItems.length === 0) return;
        const modeLabel = updateMode === 'replace' ? 'REEMPLAZAR (Arqueo)' : 'SUMAR (Ajuste)';
        if (!window.confirm(`⚠️ ¿Confirmar actualización de Stock?\n\nModo: ${modeLabel}\nItems: ${scannedItems.length}`)) return;

        const loadToast = toast.loading("Actualizando base de datos...");
        try {
            const itemsPayload = scannedItems.map(i => {
                let finalStock = i.cantidad;
                if (updateMode === 'add') {
                    finalStock = (parseInt(i.stock_sistema) || 0) + parseInt(i.cantidad);
                }
                return { sku: i.sku, cantidad: finalStock };
            });

            await api.post('/products/stock/bulk-update', { items: itemsPayload });
            toast.success("Inventario actualizado exitosamente", { id: loadToast });
            setScannedItems([]);
            localStorage.removeItem('stockTakeSession');
        } catch (e) {
            toast.error("Error al guardar", { id: loadToast });
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center">
                        <PackageCheck className="mr-3 text-blue-600 dark:text-blue-400" size={28} /> Toma de Inventario
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cuenta física de mercadería. Los cambios impactan el stock real.</p>
                </div>
                {scannedItems.length > 0 && (
                    <button
                        onClick={handleReset}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center"
                    >
                        <RotateCcw size={16} className="mr-2" /> Reiniciar Sesión
                    </button>
                )}
            </div>

            {/* PANEL DE ENTRADA (HÍBRIDO) */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 relative z-50 shrink-0 transition-colors">

                {/* TABS SELECTOR */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'scan' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'}`}
                    >
                        <ScanBarcode className="mr-2" size={18} /> Escáner (Rápido)
                    </button>
                    <button
                        onClick={() => { setActiveTab('manual'); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'manual' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'}`}
                    >
                        <Search className="mr-2" size={18} /> Búsqueda Manual
                    </button>
                </div>

                {/* CONTENIDO TAB */}
                {activeTab === 'scan' ? (
                    <form onSubmit={handleScanSubmit} className="relative">
                        <input
                            ref={scanInputRef}
                            value={skuInput} onChange={e => setSkuInput(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 text-2xl font-mono uppercase font-bold border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 transition-all placeholder-blue-200 dark:placeholder-slate-600"
                            placeholder="PISTOLEAR CÓDIGO AQUÍ..."
                            autoFocus
                        />
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300 dark:text-blue-500" size={32} />
                    </form>
                ) : (
                    <div className="relative">
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                value={manualTerm} onChange={e => setManualTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 text-xl font-bold border-2 border-purple-200 dark:border-purple-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl outline-none focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-50 dark:focus:ring-purple-900/30 transition-all placeholder-purple-200 dark:placeholder-slate-600"
                                placeholder="Escribe nombre (ej: Remera Boca)..."
                                autoFocus
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300 dark:text-purple-500" size={28} />
                            {manualTerm && <button onClick={() => { setManualTerm(''); setManualResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><X /></button>}
                        </div>

                        {/* RESULTADOS FLOTANTES */}
                        {manualResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-2xl rounded-b-xl border border-gray-200 dark:border-slate-700 max-h-80 overflow-y-auto mt-1 z-[100]">
                                {manualResults.map(prod => (
                                    <div key={prod.id} className="p-3 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex gap-3 animate-fade-in group items-start">
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded shrink-0 flex items-center justify-center border dark:border-slate-600 overflow-hidden">
                                            {prod.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-gray-300 dark:text-slate-500" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between font-bold text-gray-800 dark:text-white text-sm">
                                                <span>{prod.nombre}</span>
                                                <span className="text-gray-400 dark:text-gray-500 font-mono text-xs">#{prod.id}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {prod.variantes.map(v => (
                                                    <button
                                                        key={v.id_variante}
                                                        onClick={() => handleManualSelect(prod, v)}
                                                        className="text-xs border border-gray-200 dark:border-slate-600 px-2 py-1 rounded bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white dark:hover:text-white hover:border-purple-600 transition-colors flex items-center gap-2 group/btn"
                                                    >
                                                        <span className="font-bold">{v.talle}</span>
                                                        <span className="text-[10px] text-gray-400 group-hover/btn:text-purple-200 border-l dark:border-slate-500 pl-2">Stock: {v.stock}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {manualTerm && !isSearching && manualResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 p-4 text-center text-gray-400 border dark:border-slate-700 rounded-b-xl shadow-lg mt-1">Sin resultados</div>
                        )}
                    </div>
                )}
            </div>

            {/* ZONA DE TRABAJO (TABLA + SIDEBAR) */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">

                {/* 1. LISTA DE CONTEO */}
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden transition-colors">
                    <div className="p-3 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                        <span>Items Escaneados ({scannedItems.length})</span>
                        <span>Total Unidades: {scannedItems.reduce((acc, i) => acc + i.cantidad, 0)}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white dark:bg-slate-900 text-gray-400 dark:text-slate-500 font-bold text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 text-center w-16">Foto</th>
                                    <th className="p-3">Descripción</th>
                                    <th className="p-3 font-mono text-center">SKU</th>
                                    <th className="p-3 text-center w-24">Actual</th>
                                    <th className="p-3 text-center w-28 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">Conteo</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {scannedItems.length === 0 ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-gray-400 dark:text-slate-600 italic">Lista vacía. Comienza a escanear o buscar.</td></tr>
                                ) : (
                                    scannedItems.map(item => (
                                        <tr key={item.sku} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="p-2 text-center">
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded border dark:border-slate-600 mx-auto overflow-hidden flex items-center justify-center">
                                                    {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <PackageCheck size={16} className="text-gray-300 dark:text-slate-500" />}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <p className="font-bold text-gray-800 dark:text-white leading-tight">{item.nombre}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Talle: <b className="text-gray-700 dark:text-gray-300">{item.talle}</b></p>
                                            </td>
                                            <td className="p-3 font-mono text-xs text-gray-500 dark:text-gray-400 text-center">{item.sku}</td>
                                            <td className="p-3 text-center text-gray-400 dark:text-gray-500 font-mono">{item.stock_sistema}</td>
                                            <td className="p-2 text-center bg-blue-50/20 dark:bg-blue-900/10">
                                                <div className="flex items-center justify-center">
                                                    <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-1"><ChevronRight className="rotate-180" size={14} /></button>
                                                    <input
                                                        type="number"
                                                        value={item.cantidad}
                                                        onChange={(e) => updateQuantity(item.sku, e.target.value)}
                                                        className="w-12 text-center font-black text-lg bg-transparent outline-none text-blue-700 dark:text-blue-400"
                                                    />
                                                    <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-1"><ChevronRight size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => removeItem(item.sku)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 2. SIDEBAR DE CONTROL (CONFIGURACIÓN) */}
                <div className="w-full md:w-80 flex flex-col gap-4 shrink-0">

                    {/* Tarjeta de Modo */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase mb-4">Modo de Guardado</h3>

                        <div className="flex flex-col gap-3">
                            <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'replace' ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 ring-1 ring-orange-200 dark:ring-orange-900/50' : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                                <input type="radio" name="mode" value="replace" checked={updateMode === 'replace'} onChange={() => setUpdateMode('replace')} className="mt-1" />
                                <div className="ml-3">
                                    <span className={`block font-bold text-sm ${updateMode === 'replace' ? 'text-orange-800 dark:text-orange-300' : 'text-gray-700 dark:text-gray-300'}`}>REEMPLAZAR (Arqueo)</span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight block mt-1">Lo que cuentas es el TOTAL absoluto. Borra el stock anterior. (Ej: Inventario anual)</span>
                                </div>
                            </label>

                            <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'add' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 ring-1 ring-green-200 dark:ring-green-900/50' : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                                <input type="radio" name="mode" value="add" checked={updateMode === 'add'} onChange={() => setUpdateMode('add')} className="mt-1" />
                                <div className="ml-3">
                                    <span className={`block font-bold text-sm ${updateMode === 'add' ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>SUMAR (Reposición)</span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight block mt-1">Se SUMA al stock actual. (Ej: Llegó mercadería nueva)</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Botones Finales */}
                    <div className="mt-auto">
                        {updateMode === 'replace' && (
                            <div className="mb-4 flex items-start gap-2 bg-orange-100 dark:bg-orange-900/20 p-3 rounded-lg text-orange-800 dark:text-orange-300 text-xs">
                                <AlertTriangle size={16} className="shrink-0" />
                                <p><b>¡Cuidado!</b> Si el sistema dice 10 y escaneas 2, el nuevo stock será 2.</p>
                            </div>
                        )}

                        <button
                            onClick={handlePrintList}
                            disabled={scannedItems.length === 0}
                            className="w-full py-3 mb-3 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="mr-2" size={20} /> IMPRIMIR ETIQUETAS
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={scannedItems.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all active:scale-95 ${scannedItems.length === 0 ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed text-gray-500 dark:text-gray-500' : updateMode === 'add' ? 'bg-green-600 hover:bg-green-700 shadow-green-200 dark:shadow-none' : 'bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 shadow-slate-300 dark:shadow-none'}`}
                        >
                            {updateMode === 'add' ? <PlusCircle className="mr-2" /> : <Save className="mr-2" />}
                            {updateMode === 'add' ? 'CONFIRMAR INGRESO' : 'GUARDAR ARQUEO'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default StockTakePage;