import { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useLabelQueue } from '../context/LabelContext';
import {
    Printer, Trash2, RotateCcw, FileText, Search, Plus, Layers,
    X, Maximize2, Shirt, Filter, FilterX
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const LabelPrinterPage = () => {
    const { token } = useAuth();
    const { printQueue, addToQueue, updateQuantity, removeFromQueue, clearQueue } = useLabelQueue();

    const [isGenerating, setIsGenerating] = useState(false);

    // --- ESTADOS DE BÚSQUEDA Y FILTROS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    const [genCats, setGenCats] = useState([]);
    const [specCats, setSpecCats] = useState([]);
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');
    const [sortBy, setSortBy] = useState('mas_vendidos');

    const [zoomImage, setZoomImage] = useState(null);

    const searchInputRef = useRef(null);
    const searchContainerRef = useRef(null);

    // --- 1. CARGAR CATEGORÍAS AL INICIO ---
    useEffect(() => {
        const loadAllCategories = async () => {
            if (!token) return;
            try {
                const [resGen, resSpec] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);
                setGenCats(Array.isArray(resGen.data) ? resGen.data : []);
                setSpecCats(Array.isArray(resSpec.data) ? resSpec.data : []);
            } catch (e) {
                console.error("Error cargando filtros:", e);
            }
        };
        loadAllCategories();
    }, [token]);

    // --- 2. EFECTO DE BÚSQUEDA INTELIGENTE ---
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!searchTerm.trim() && !selectedCat && !selectedSpec) {
                setSearchResults([]);
                setShowDropdown(false);
                return;
            }

            setIsSearching(true);
            try {
                const params = { limit: 50, sort_by: sortBy };
                if (searchTerm.trim()) params.search = searchTerm;
                if (selectedCat) params.category_id = selectedCat;
                if (selectedSpec) params.specific_id = selectedSpec;

                const res = await api.get('/products', { params });
                setSearchResults(res.data.products || []);
                setShowDropdown(true);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [searchTerm, selectedCat, selectedSpec, sortBy]);

    // --- MANEJADORES DE CIERRE (CLIC AFUERA Y ESCAPE) ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowDropdown(false);
            searchInputRef.current?.blur();
        }
    };

    // --- FUNCIONES DE LA COLA ---
    const handleAddSingle = (e, product, variant) => {
        e.stopPropagation(); // Evita que se disparen otros eventos
        const existingItem = printQueue.find(item => item.sku === variant.sku);
        if (existingItem) {
            updateQuantity(variant.sku, existingItem.cantidad + 1);
            toast.success(`+1 ${variant.talle}`, { id: `add-${variant.sku}`, duration: 1000, icon: '➕' });
        } else {
            addToQueue(product, variant);
            toast.success(`Agregado: ${variant.talle}`, { duration: 1000 });
        }
        searchInputRef.current?.focus(); // Mantiene el foco en el input sin cerrar
    };

    const handleAddFullCurve = (e, product) => {
        e.stopPropagation();
        let addedCount = 0;
        product.variantes.forEach(variant => {
            const existingItem = printQueue.find(item => item.sku === variant.sku);
            if (existingItem) updateQuantity(variant.sku, existingItem.cantidad + 1);
            else addToQueue(product, variant);
            addedCount++;
        });
        toast.success(`Agregados ${addedCount} talles`);
        searchInputRef.current?.focus();
    };

    const handlePrintBatch = async () => {
        if (printQueue.length === 0) return;
        setIsGenerating(true);
        const toastId = toast.loading("Generando PDF...");
        try {
            const response = await api.post('/products/labels/batch-pdf', { items: printQueue }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));

            // Descargar el archivo directamente en lugar de abrirlo (más compatible)
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Etiquetas_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success("PDF Generado", { id: toastId });
            if (window.confirm("¿Se descargó correctamente el PDF? ¿Deseas limpiar la cola de impresión?")) {
                clearQueue();
            }
        } catch (e) {
            toast.error("Error generando etiquetas", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
            <Toaster position="top-center" />

            {/* ZOOM IMAGEN */}
            {zoomImage && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-fade-in" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border-2 border-white/10 animate-zoom-in" alt="Zoom" onClick={(e) => e.stopPropagation()} />
                    <button className="absolute top-5 right-5 text-white/50 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"><X size={32} /></button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center">
                        <Printer className="mr-3 text-blue-600 dark:text-blue-400" size={28} /> Cola de Impresión
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Busca artículos y arma la plancha de etiquetas a imprimir.</p>
                </div>
                <button onClick={clearQueue} disabled={printQueue.length === 0} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 px-5 py-2.5 rounded-xl flex items-center font-bold text-sm disabled:opacity-50 transition-colors border border-red-100 dark:border-red-900/50">
                    <RotateCcw size={16} className="mr-2" /> Limpiar Todo
                </button>
            </div>

            {/* --- SECCIÓN BUSCADOR CON FILTROS --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-blue-100 dark:border-slate-700 relative z-40 shrink-0 transition-colors flex flex-col gap-3" ref={searchContainerRef}>

                {/* Filtros Dropdowns */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        className="flex-1 sm:max-w-[200px] p-2.5 font-bold border-2 border-blue-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-colors text-sm"
                        value={selectedCat}
                        onChange={e => setSelectedCat(e.target.value)}
                    >
                        <option value="">Todas las Categorías</option>
                        {genCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>

                    <select
                        className="flex-1 sm:max-w-[200px] p-2.5 font-bold border-2 border-blue-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-colors text-sm"
                        value={selectedSpec}
                        onChange={e => setSelectedSpec(e.target.value)}
                    >
                        <option value="">Todas las Ligas</option>
                        {specCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>

                    <select
                        className="flex-1 sm:max-w-[180px] p-2.5 font-bold border-2 border-blue-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-colors text-sm"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                    >
                        <option value="mas_vendidos">Más Vendidos</option>
                        <option value="recientes">Recientes</option>
                        <option value="az">A - Z</option>
                    </select>
                </div>

                {/* Barra de Búsqueda de Texto */}
                <div className="flex gap-2 relative">
                    <div className="relative flex-1">
                        <input
                            ref={searchInputRef}
                            placeholder="Buscar nombre o código (ESC para cerrar)..."
                            className="w-full pl-11 p-3 border-2 border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/20 outline-none shadow-sm transition-all font-bold text-gray-800 dark:text-white placeholder-gray-400"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                            onFocus={() => { if (searchTerm.trim() || selectedCat || selectedSpec) setShowDropdown(true); }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <Search className="absolute left-4 top-3.5 text-blue-400 dark:text-blue-500" size={20} />

                        {(searchTerm || selectedCat || selectedSpec) && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedCat('');
                                    setSelectedSpec('');
                                    setSearchResults([]);
                                    setShowDropdown(false);
                                    searchInputRef.current?.focus();
                                }}
                                className="absolute right-4 top-3.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                                title="Limpiar búsqueda y filtros"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* RESULTADOS FLOTANTES */}
                {showDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-2xl border border-gray-200 dark:border-slate-700 rounded-b-xl mt-1 overflow-hidden max-h-[50vh] overflow-y-auto z-[100] custom-scrollbar">
                        {searchResults.map(prod => (
                            <div key={prod.id} className="p-3 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-0 group transition-colors flex gap-4 items-start animate-fade-in">
                                <div
                                    className="w-14 h-14 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 border dark:border-slate-600 overflow-hidden relative cursor-zoom-in flex items-center justify-center group/img"
                                    onClick={(e) => { e.stopPropagation(); if (prod.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${prod.imagen}`); }}
                                >
                                    {prod.imagen ? (
                                        <>
                                            <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform" alt={prod.nombre} />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <Maximize2 size={16} className="text-white" />
                                            </div>
                                        </>
                                    ) : (<Shirt size={20} className="text-gray-300 dark:text-slate-500" />)}
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-bold text-sm text-gray-800 dark:text-white leading-tight">
                                                {prod.nombre}
                                            </p>
                                            <div className="flex items-center mt-1 space-x-2">
                                                <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{prod.sku_base || 'S/SKU'}</span>
                                                <span className="text-[10px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase">
                                                    {prod.categoria || prod.liga || '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                                $ {prod.precio.toLocaleString()}
                                            </span>
                                            <button
                                                onClick={(e) => handleAddFullCurve(e, prod)}
                                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                                            >
                                                <Layers size={10} className="mr-1" /> Curva Completa
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 select-none">
                                        {prod.variantes.map(v => (
                                            <button
                                                key={v.id_variante}
                                                onClick={(e) => handleAddSingle(e, prod, v)}
                                                className="text-xs flex items-center bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 px-2.5 py-1 rounded hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white dark:hover:border-blue-500 transition-all shadow-sm active:scale-95 group/btn"
                                            >
                                                <span className="font-bold mr-1.5">{v.talle}</span>
                                                <Plus size={12} className="text-gray-400 group-hover/btn:text-white transition-colors" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {showDropdown && (searchTerm || selectedCat || selectedSpec) && !isSearching && searchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 p-6 text-center text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 rounded-b-xl shadow-lg mt-1 font-medium z-[100]">No se encontraron productos para esta búsqueda.</div>
                )}
            </div>

            {/* TABLA DE COLA DE IMPRESIÓN */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden relative z-0 transition-colors">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400 uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-bold">Producto y Talle</th>
                                <th className="p-4 font-bold">SKU</th>
                                <th className="p-4 w-40 text-center font-bold">Cant. Etiquetas</th>
                                <th className="p-4 text-right font-bold">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {printQueue.length === 0 ? (
                                <tr><td colSpan="4" className="p-16 text-center text-gray-400 dark:text-slate-500 italic">
                                    <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                    La lista está vacía.<br />Usa el buscador arriba para agregar etiquetas.
                                </td></tr>
                            ) : (
                                printQueue.map((item) => (
                                    <tr key={item.sku} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="p-4">
                                            <p className="font-bold text-gray-800 dark:text-white">{item.nombre}</p>
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 inline-block px-1.5 py-0.5 rounded mt-1 uppercase">Talle: {item.talle}</p>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400">{item.sku}</td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden w-fit mx-auto shadow-inner">
                                                <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="w-8 h-8 hover:bg-gray-200 dark:hover:bg-slate-700 font-bold text-gray-600 dark:text-gray-400 transition-colors" disabled={item.cantidad <= 1}>-</button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-10 text-center font-black text-base bg-transparent focus:text-blue-600 dark:focus:text-blue-400 outline-none text-gray-800 dark:text-white"
                                                    value={item.cantidad}
                                                    onChange={(e) => updateQuantity(item.sku, parseInt(e.target.value) || 1)}
                                                />
                                                <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="w-8 h-8 hover:bg-gray-200 dark:hover:bg-slate-700 font-bold text-gray-600 dark:text-gray-400 transition-colors">+</button>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => removeFromQueue(item.sku)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER FIJO */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 transition-colors z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] dark:shadow-none">
                    <div className="text-gray-600 dark:text-gray-300 font-medium flex items-center bg-gray-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-slate-700">
                        Total a Imprimir: <span className="font-black text-blue-600 dark:text-blue-400 text-xl ml-2">{printQueue.reduce((acc, i) => acc + i.cantidad, 0)}</span> <span className="text-xs ml-1 font-bold">etiquetas</span>
                    </div>

                    <button
                        onClick={handlePrintBatch}
                        disabled={printQueue.length === 0 || isGenerating}
                        className="w-full md:w-auto bg-blue-600 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isGenerating ? (
                            <span className="flex items-center">
                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></span> Generando PDF...
                            </span>
                        ) : (
                            <><Printer size={20} className="mr-2" /> IMPRIMIR ETIQUETAS</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LabelPrinterPage;