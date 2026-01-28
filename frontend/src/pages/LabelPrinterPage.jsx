import { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useLabelQueue } from '../context/LabelContext';
import {
    Printer, Trash2, RotateCcw, FileText, Search, Plus, Layers,
    X, Maximize2, Shirt, Filter
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const LabelPrinterPage = () => {
    const { token } = useAuth();
    const { printQueue, addToQueue, updateQuantity, removeFromQueue, clearQueue } = useLabelQueue();

    const [isGenerating, setIsGenerating] = useState(false);

    // --- ESTADOS DEL BUSCADOR ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- ESTADOS DE CATEGORÍAS (DOBLE CARGA) ---
    const [genCats, setGenCats] = useState([]);  // Categorías Generales
    const [specCats, setSpecCats] = useState([]); // Categorías Específicas (Ligas)

    // El valor del filtro será compuesto: "cat-1", "spec-5", etc.
    const [selectedFilter, setSelectedFilter] = useState('');

    const [zoomImage, setZoomImage] = useState(null);
    const searchRef = useRef(null);

    // --- 1. CARGAR AMBAS LISTAS AL INICIO ---
    useEffect(() => {
        const loadAllCategories = async () => {
            try {
                // Hacemos las dos peticiones en paralelo
                const [resGen, resSpec] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);

                // Asignamos asegurando que sean arrays
                setGenCats(Array.isArray(resGen.data) ? resGen.data : []);
                setSpecCats(Array.isArray(resSpec.data) ? resSpec.data : []);

            } catch (e) {
                console.error("Error cargando filtros:", e);
                toast.error("Error cargando categorías");
            }
        };
        loadAllCategories();
    }, []);

    // --- 2. EFECTO DE BÚSQUEDA INTELIGENTE ---
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            // Si está todo vacío, limpiamos
            if (!searchTerm.trim() && !selectedFilter) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const params = new URLSearchParams();

                // A. Texto
                if (searchTerm.trim()) params.append('search', searchTerm);

                // B. Filtro de Categoría (Desglosamos el valor "tipo-id")
                if (selectedFilter) {
                    const [type, id] = selectedFilter.split('-');

                    if (type === 'cat') {
                        params.append('category_id', id);
                    } else if (type === 'spec') {
                        params.append('specific_id', id);
                    }
                }

                params.append('limit', 50);

                const res = await api.get(`/products?${params.toString()}`);
                setSearchResults(res.data.products || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm, selectedFilter]); // Se activa al cambiar texto o filtro

    // --- MANEJADORES DE CIERRE ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setSearchResults([]);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setSearchResults([]);
            e.currentTarget.blur();
        }
    };

    // --- FUNCIONES DE LA COLA (Sin cambios) ---
    const handleAddSingle = (product, variant) => {
        const existingItem = printQueue.find(item => item.sku === variant.sku);
        if (existingItem) {
            updateQuantity(variant.sku, existingItem.cantidad + 1);
            toast.success(`+1 ${variant.talle}`, { id: `add-${variant.sku}`, duration: 1000, icon: '➕' });
        } else {
            addToQueue(product, variant);
            toast.success(`Agregado: ${variant.talle}`, { duration: 1000 });
        }
    };

    const handleAddFullCurve = (product) => {
        let addedCount = 0;
        product.variantes.forEach(variant => {
            const existingItem = printQueue.find(item => item.sku === variant.sku);
            if (existingItem) updateQuantity(variant.sku, existingItem.cantidad + 1);
            else addToQueue(product, variant);
            addedCount++;
        });
        toast.success(`Agregados ${addedCount} talles`);
        setSearchTerm('');
        setSearchResults([]);
    };

    const handlePrintBatch = async () => {
        if (printQueue.length === 0) return;
        setIsGenerating(true);
        const toastId = toast.loading("Generando PDF...");
        try {
            const response = await api.post('/products/labels/batch-pdf', { items: printQueue }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(url);
            toast.success("PDF Generado", { id: toastId });
            if (window.confirm("¿Se imprimieron correctamente? Limpiar cola.")) clearQueue();
        } catch (e) {
            toast.error("Error generando etiquetas", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            <Toaster position="top-center" />

            {/* ZOOM IMAGEN */}
            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-fade-in" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border-2 border-white/20" alt="Zoom" onClick={(e) => e.stopPropagation()} />
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/50 p-2 rounded-full hover:bg-red-600"><X size={32} /></button>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Printer className="mr-2 text-blue-600" /> Cola de Impresión
                    </h1>
                    <p className="text-gray-500 text-sm">Busca artículos y agrégalos a la lista para imprimir.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={clearQueue} disabled={printQueue.length === 0} className="text-red-500 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg flex items-center font-bold text-sm disabled:opacity-50 transition-colors">
                        <RotateCcw size={16} className="mr-2" /> Limpiar Todo
                    </button>
                </div>
            </div>

            {/* --- SECCIÓN BUSCADOR --- */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 relative z-50" ref={searchRef}>
                <label className="block text-xs font-bold text-blue-600 uppercase mb-2">Buscar producto para etiquetar</label>

                <div className="flex gap-2 relative">
                    {/* INPUT TEXTO */}
                    <div className="relative flex-1">
                        <input
                            placeholder="Nombre, código..."
                            className="w-full pl-10 p-3 border rounded-l-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    </div>

                    {/* SELECTOR UNIFICADO (Generales + Específicas) */}
                    <div className="relative w-1/3 md:w-1/4">
                        <select
                            className="w-full p-3 pl-9 border border-l-0 rounded-r-lg bg-gray-50 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm h-full cursor-pointer hover:bg-gray-100 transition-colors"
                            value={selectedFilter}
                            onChange={(e) => setSelectedFilter(e.target.value)}
                        >
                            <option value="">Todas</option>

                            {/* GRUPO 1: CATEGORÍAS GENERALES */}
                            {genCats.length > 0 && (
                                <optgroup label="Categorías">
                                    {genCats.map(c => (
                                        <option key={`cat-${c.id}`} value={`cat-${c.id}`}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </optgroup>
                            )}

                            {/* GRUPO 2: CATEGORÍAS ESPECÍFICAS (LIGAS) */}
                            {specCats.length > 0 && (
                                <optgroup label="Tipos / Ligas">
                                    {specCats.map(c => (
                                        <option key={`spec-${c.id}`} value={`spec-${c.id}`}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <Filter className="absolute left-3 top-3.5 text-blue-500 pointer-events-none" size={16} />
                    </div>

                    {isSearching && (
                        <div className="absolute right-3 top-3 z-10">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                        </div>
                    )}
                </div>

                {/* RESULTADOS */}
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-gray-200 rounded-b-xl mt-1 overflow-hidden max-h-[400px] overflow-y-auto z-50">
                        {searchResults.map(prod => (
                            <div key={prod.id} className="p-3 hover:bg-blue-50 border-b last:border-0 group transition-colors flex gap-4 items-start">
                                <div
                                    className="w-12 h-12 bg-gray-100 rounded-lg shrink-0 border overflow-hidden relative cursor-zoom-in group/img"
                                    onClick={() => prod.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${prod.imagen}`)}
                                >
                                    {prod.imagen ? (
                                        <>
                                            <img src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`} className="w-full h-full object-cover" alt={prod.nombre} />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <Maximize2 size={16} className="text-white" />
                                            </div>
                                        </>
                                    ) : (<div className="w-full h-full flex items-center justify-center text-gray-300"><Shirt size={20} /></div>)}
                                </div>

                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="cursor-pointer" onClick={() => handleAddFullCurve(prod)}>
                                            <p className="font-bold text-sm text-gray-800 group-hover:text-blue-600 transition-colors leading-tight">
                                                {prod.nombre}
                                            </p>
                                            <div className="flex items-center mt-1 space-x-2">
                                                <span className="text-xs font-mono text-gray-400">{prod.sku_base || 'S/SKU'}</span>
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                                    {prod.categoria || prod.liga || '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            $ {prod.precio.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 select-none">
                                        {prod.variantes.map(v => (
                                            <button
                                                key={v.id_variante}
                                                onClick={() => handleAddSingle(prod, v)}
                                                className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95 active:bg-blue-700"
                                            >
                                                <span className="font-bold mr-1">{v.talle}</span>
                                                <Plus size={10} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* TABLA DE COLA */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative z-0">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                        <tr>
                            <th className="p-4">Producto</th>
                            <th className="p-4">SKU</th>
                            <th className="p-4 w-32 text-center">Cant. Etiquetas</th>
                            <th className="p-4 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {printQueue.length === 0 ? (
                            <tr><td colSpan="4" className="p-10 text-center text-gray-400 italic">
                                La lista está vacía.<br />Usa el buscador para agregar etiquetas.
                            </td></tr>
                        ) : (
                            printQueue.map((item) => (
                                <tr key={item.sku} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-gray-800">{item.nombre}</p>
                                        <p className="text-xs text-gray-500 bg-gray-100 inline-block px-1 rounded mt-1">Talle: {item.talle}</p>
                                    </td>
                                    <td className="p-4 font-mono text-xs text-gray-600">{item.sku}</td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <button onClick={() => updateQuantity(item.sku, item.cantidad - 1)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-l font-bold text-gray-600" disabled={item.cantidad <= 1}>-</button>
                                            <input type="number" min="1" className="w-14 p-1 border-y border-gray-200 text-center font-bold text-lg focus:border-blue-500 outline-none" value={item.cantidad} onChange={(e) => updateQuantity(item.sku, parseInt(e.target.value) || 1)} />
                                            <button onClick={() => updateQuantity(item.sku, item.cantidad + 1)} className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-r font-bold text-gray-600">+</button>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={() => removeFromQueue(item.sku)} className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center sticky bottom-0">
                    <div className="text-gray-600 font-medium">Total Etiquetas: <span className="font-black text-gray-900 text-lg ml-2">{printQueue.reduce((acc, i) => acc + i.cantidad, 0)}</span></div>
                    <button onClick={handlePrintBatch} disabled={printQueue.length === 0 || isGenerating} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center hover:bg-black shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95">
                        {isGenerating ? <span className="flex items-center"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Generando...</span> : <><FileText size={20} className="mr-2" />IMPRIMIR ETIQUETAS</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LabelPrinterPage;