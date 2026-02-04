import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import {
    ScanBarcode, Save, Trash2, RotateCcw, PackageCheck,
    PlusCircle, AlertTriangle, Search, X, Image as ImageIcon,
    Shirt, ChevronRight, CheckCircle2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const StockTakePage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE CONTROL ---
    const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual'
    const [updateMode, setUpdateMode] = useState('replace'); // 'replace' | 'add'

    // --- ESTADOS DE DATOS ---
    const [scannedItems, setScannedItems] = useState(() => {
        const saved = localStorage.getItem('stockTakeSession');
        return saved ? JSON.parse(saved) : [];
    });

    // --- INPUTS ---
    const [skuInput, setSkuInput] = useState('');
    const [manualTerm, setManualTerm] = useState('');
    const [manualResults, setManualResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Refs
    const scanInputRef = useRef(null);
    const searchInputRef = useRef(null);

    // 1. PERSISTENCIA AUTOMÁTICA
    useEffect(() => {
        localStorage.setItem('stockTakeSession', JSON.stringify(scannedItems));
    }, [scannedItems]);

    // 2. AUTO-FOCUS INTELIGENTE
    useEffect(() => {
        const focusInterval = setInterval(() => {
            if (activeTab === 'scan' && document.activeElement !== scanInputRef.current) {
                scanInputRef.current?.focus();
            }
        }, 2000);
        return () => clearInterval(focusInterval);
    }, [activeTab]);

    // 3. BÚSQUEDA MANUAL (Debounce)
    useEffect(() => {
        if (!manualTerm.trim()) {
            setManualResults([]);
            return;
        }
        const delay = setTimeout(async () => {
            setIsSearching(true);
            try {
                // Buscamos productos que coincidan
                const res = await api.get('/products', { params: { search: manualTerm, limit: 20 } });
                setManualResults(res.data.products || []);
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [manualTerm]);


    // --- LÓGICA DE AGREGADO UNIFICADA ---
    const addOrIncrementItem = (itemData) => {
        setScannedItems(prev => {
            const existingIdx = prev.findIndex(i => i.sku === itemData.sku);
            if (existingIdx >= 0) {
                // Si existe, sumamos 1 y lo movemos al principio para visibilidad
                const newList = [...prev];
                newList[existingIdx].cantidad += 1;
                // Opcional: Mover al tope -> const item = newList.splice(existingIdx, 1)[0]; newList.unshift(item);
                return newList;
            }
            // Si es nuevo
            return [{
                sku: itemData.sku,
                nombre: itemData.nombre,
                talle: itemData.talle,
                imagen: itemData.imagen,
                stock_sistema: itemData.stock_sistema,
                cantidad: 1
            }, ...prev];
        });
        toast.success(`+1 ${itemData.nombre} (${itemData.talle})`, {
            position: 'bottom-right',
            duration: 1000,
            icon: '📦'
        });
    };

    // A. AGREGAR POR ESCÁNER
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
                    imagen: p.imagen, // Si el endpoint de scan devuelve imagen
                    stock_sistema: p.stock_actual
                });
                setSkuInput('');
            } else {
                toast.error("Producto no encontrado");
            }
        } catch (e) { toast.error("Error al buscar código"); }
    };

    // B. AGREGAR MANUALMENTE (Desde resultados)
    const handleManualSelect = (product, variant) => {
        addOrIncrementItem({
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            imagen: product.imagen,
            stock_sistema: variant.stock
        });
    };

    // --- ACCIONES DE LISTA ---
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

    // --- GUARDADO FINAL ---
    const handleSave = async () => {
        if (scannedItems.length === 0) return;

        const modeLabel = updateMode === 'replace' ? 'REEMPLAZAR (Arqueo)' : 'SUMAR (Ajuste)';
        if (!window.confirm(`⚠️ ¿Confirmar actualización de Stock?\n\nModo: ${modeLabel}\nItems: ${scannedItems.length}`)) return;

        const loadToast = toast.loading("Actualizando base de datos...");
        try {
            // Preparamos payload
            const itemsPayload = scannedItems.map(i => {
                let finalStock = i.cantidad;
                if (updateMode === 'add') {
                    // Nota: El backend debería hacer la suma atómica idealmente, 
                    // pero aquí mandamos la instrucción basada en lógica visual
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
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center">
                        <PackageCheck className="mr-3 text-blue-600" size={28} /> Toma de Inventario
                    </h1>
                    <p className="text-sm text-gray-500">Cuenta física de mercadería. Los cambios impactan el stock real.</p>
                </div>
                {scannedItems.length > 0 && (
                    <button
                        onClick={handleReset}
                        className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg font-bold text-sm transition-colors flex items-center"
                    >
                        <RotateCcw size={16} className="mr-2" /> Reiniciar Sesión
                    </button>
                )}
            </div>

            {/* PANEL DE ENTRADA (HÍBRIDO) */}
            <div className="bg-white p-5 rounded-2xl shadow-lg border border-blue-100 relative z-50 shrink-0">

                {/* TABS SELECTOR */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab('scan')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'scan' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                    >
                        <ScanBarcode className="mr-2" size={18} /> Escáner (Rápido)
                    </button>
                    <button
                        onClick={() => { setActiveTab('manual'); setTimeout(() => searchInputRef.current?.focus(), 100); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'manual' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
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
                            className="w-full pl-12 pr-4 py-4 text-2xl font-mono uppercase font-bold border-2 border-blue-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all placeholder-blue-200"
                            placeholder="PISTOLEAR CÓDIGO AQUÍ..."
                            autoFocus
                        />
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-300" size={32} />
                    </form>
                ) : (
                    <div className="relative">
                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                value={manualTerm} onChange={e => setManualTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 text-xl font-bold border-2 border-purple-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-50 transition-all placeholder-purple-200"
                                placeholder="Escribe nombre (ej: Remera Boca)..."
                                autoFocus
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-300" size={28} />
                            {manualTerm && <button onClick={() => { setManualTerm(''); setManualResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X /></button>}
                        </div>

                        {/* RESULTADOS FLOTANTES */}
                        {manualResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white shadow-2xl rounded-b-xl border border-gray-200 max-h-80 overflow-y-auto mt-1 z-[100]">
                                {manualResults.map(prod => (
                                    <div key={prod.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 animate-fade-in group items-start">
                                        <div className="w-12 h-12 bg-gray-100 rounded shrink-0 flex items-center justify-center border overflow-hidden">
                                            {prod.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-gray-300" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between font-bold text-gray-800 text-sm">
                                                <span>{prod.nombre}</span>
                                                <span className="text-gray-400 font-mono text-xs">#{prod.id}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {prod.variantes.map(v => (
                                                    <button
                                                        key={v.id_variante}
                                                        onClick={() => handleManualSelect(prod, v)}
                                                        className="text-xs border px-2 py-1 rounded bg-white hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-colors flex items-center gap-2 group/btn"
                                                    >
                                                        <span className="font-bold">{v.talle}</span>
                                                        <span className="text-[10px] text-gray-400 group-hover/btn:text-purple-200 border-l pl-2">Stock: {v.stock}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {manualTerm && !isSearching && manualResults.length === 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white p-4 text-center text-gray-400 border rounded-b-xl shadow-lg mt-1">Sin resultados</div>
                        )}
                    </div>
                )}
            </div>

            {/* ZONA DE TRABAJO (TABLA + SIDEBAR) */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">

                {/* 1. LISTA DE CONTEO */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b flex justify-between items-center text-xs font-bold text-gray-500 uppercase">
                        <span>Items Escaneados ({scannedItems.length})</span>
                        <span>Total Unidades: {scannedItems.reduce((acc, i) => acc + i.cantidad, 0)}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-gray-400 font-bold text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 text-center w-16">Foto</th>
                                    <th className="p-3">Descripción</th>
                                    <th className="p-3 font-mono text-center">SKU</th>
                                    <th className="p-3 text-center w-24">Actual</th>
                                    <th className="p-3 text-center w-28 bg-blue-50 text-blue-700">Conteo</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {scannedItems.length === 0 ? (
                                    <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Lista vacía. Comienza a escanear o buscar.</td></tr>
                                ) : (
                                    scannedItems.map(item => (
                                        <tr key={item.sku} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-2 text-center">
                                                <div className="w-10 h-10 bg-gray-100 rounded border mx-auto overflow-hidden flex items-center justify-center">
                                                    {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <PackageCheck size={16} className="text-gray-300" />}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <p className="font-bold text-gray-800 leading-tight">{item.nombre}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">Talle: <b className="text-gray-700">{item.talle}</b></p>
                                            </td>
                                            <td className="p-3 font-mono text-xs text-gray-500 text-center">{item.sku}</td>
                                            <td className="p-3 text-center text-gray-400 font-mono">{item.stock_sistema}</td>
                                            <td className="p-2 text-center bg-blue-50/20">
                                                <div className="flex items-center justify-center">
                                                    <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="text-gray-400 hover:text-blue-600 p-1"><ChevronRight className="rotate-180" size={14} /></button>
                                                    <input
                                                        type="number"
                                                        value={item.cantidad}
                                                        onChange={(e) => updateQuantity(item.sku, e.target.value)}
                                                        className="w-12 text-center font-black text-lg bg-transparent outline-none text-blue-700"
                                                    />
                                                    <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="text-gray-400 hover:text-blue-600 p-1"><ChevronRight size={14} /></button>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <button onClick={() => removeItem(item.sku)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
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
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 text-sm uppercase mb-4">Modo de Guardado</h3>

                        <div className="flex flex-col gap-3">
                            <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'replace' ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="mode" value="replace" checked={updateMode === 'replace'} onChange={() => setUpdateMode('replace')} className="mt-1" />
                                <div className="ml-3">
                                    <span className={`block font-bold text-sm ${updateMode === 'replace' ? 'text-orange-800' : 'text-gray-700'}`}>REEMPLAZAR (Arqueo)</span>
                                    <span className="text-[10px] text-gray-500 leading-tight block mt-1">Lo que cuentas es el TOTAL absoluto. Borra el stock anterior. (Ej: Inventario anual)</span>
                                </div>
                            </label>

                            <label className={`flex p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'add' ? 'bg-green-50 border-green-200 ring-1 ring-green-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                                <input type="radio" name="mode" value="add" checked={updateMode === 'add'} onChange={() => setUpdateMode('add')} className="mt-1" />
                                <div className="ml-3">
                                    <span className={`block font-bold text-sm ${updateMode === 'add' ? 'text-green-800' : 'text-gray-700'}`}>SUMAR (Reposición)</span>
                                    <span className="text-[10px] text-gray-500 leading-tight block mt-1">Se SUMA al stock actual. (Ej: Llegó mercadería nueva)</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Botón Final */}
                    <div className="mt-auto">
                        {updateMode === 'replace' && (
                            <div className="mb-4 flex items-start gap-2 bg-orange-100 p-3 rounded-lg text-orange-800 text-xs">
                                <AlertTriangle size={16} className="shrink-0" />
                                <p><b>¡Cuidado!</b> Si el sistema dice 10 y escaneas 2, el nuevo stock será 2.</p>
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={scannedItems.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all active:scale-95 ${scannedItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' : updateMode === 'add' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-slate-900 hover:bg-black shadow-slate-300'}`}
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