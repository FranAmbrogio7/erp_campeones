import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import StockPrintTemplate from '../components/StockPrintTemplate';
import {
    Search, Printer, Trash2, Box, FileText, ArrowLeft,
    Shirt, CheckCircle, X, Maximize2,
    AlertCircle, Plus, Layers, ListPlus, FilterX
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const StockReportPage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE DATOS ---
    const [searchResults, setSearchResults] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);

    // --- ESTADOS DE FILTROS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // --- ESTADOS DE REPORTE ---
    const [selectedItems, setSelectedItems] = useState([]);
    const [reportTitle, setReportTitle] = useState('');

    // --- ESTADOS DE UI ---
    const [zoomImage, setZoomImage] = useState(null);

    // --- REFS ---
    const componentRef = useRef();
    const searchInputRef = useRef(null);

    // --- CARGA INICIAL DE FILTROS ---
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [resCat, resSpec] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);
                setCategories(resCat.data);
                setSpecificCategories(resSpec.data);
            } catch (e) { console.error("Error cargando filtros", e); }
        };
        if (token) fetchFilters();
    }, [token]);

    // --- BÚSQUEDA INTELIGENTE (DEBOUNCE) ---
    useEffect(() => {
        if (!searchTerm.trim() && !selectedCat && !selectedSpec) {
            setSearchResults([]);
            return;
        }

        const delaySearch = setTimeout(async () => {
            setIsSearching(true);
            try {
                const params = {
                    search: searchTerm,
                    category_id: selectedCat || undefined,
                    specific_id: selectedSpec || undefined,
                    limit: 150
                };
                const res = await api.get('/products', { params });
                setSearchResults(res.data.products || []);
            } catch (error) {
                console.error(error);
                toast.error("Error al buscar");
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delaySearch);
    }, [searchTerm, selectedCat, selectedSpec]);

    // --- IMPRESIÓN ---
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `ReporteStock_${new Date().toLocaleDateString().replace(/\//g, '-')}`,
        onAfterPrint: () => toast.success("PDF Generado correctamente")
    });

    // --- ACCIONES ---
    const handleAddItem = (product, variant) => {
        const exists = selectedItems.find(i => i.id_variante === variant.id_variante);
        if (exists) return;

        const newItem = {
            id_variante: variant.id_variante,
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            stock_actual: variant.stock,
            precio: product.precio,
            imagen: product.imagen
        };

        setSelectedItems(prev => [...prev, newItem]);
        toast.success(`+ ${product.nombre} (${variant.talle})`, { duration: 1000, position: 'bottom-center' });
    };

    const handleAddCurve = (product) => {
        const itemsToAdd = product.variantes
            .filter(v => !selectedItems.some(i => i.id_variante === v.id_variante))
            .map(v => ({
                id_variante: v.id_variante,
                sku: v.sku,
                nombre: product.nombre,
                talle: v.talle,
                stock_actual: v.stock,
                precio: product.precio,
                imagen: product.imagen
            }));

        if (itemsToAdd.length === 0) return;

        setSelectedItems(prev => [...prev, ...itemsToAdd]);
        toast.success(`+ ${itemsToAdd.length} variantes`, { position: 'bottom-center' });
    };

    const handleAddAllResults = () => {
        if (searchResults.length === 0) return;
        let addedCount = 0;
        setSelectedItems(prev => {
            const newItems = [...prev];
            const existingIds = new Set(newItems.map(i => i.id_variante));
            searchResults.forEach(prod => {
                prod.variantes.forEach(v => {
                    if (!existingIds.has(v.id_variante)) {
                        newItems.push({
                            id_variante: v.id_variante,
                            sku: v.sku,
                            nombre: prod.nombre,
                            talle: v.talle,
                            stock_actual: v.stock,
                            precio: prod.precio,
                            imagen: prod.imagen
                        });
                        existingIds.add(v.id_variante);
                        addedCount++;
                    }
                });
            });
            return newItems;
        });
        if (addedCount > 0) toast.success(`${addedCount} ítems agregados`);
    };

    const handleRemoveItem = (id_variante) => {
        setSelectedItems(prev => prev.filter(i => i.id_variante !== id_variante));
    };

    const clearFilters = () => {
        setSearchTerm(''); setSelectedCat(''); setSelectedSpec(''); setSearchResults([]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 overflow-hidden animate-fade-in transition-colors duration-300">
            <Toaster position="top-center" />

            {/* COMPONENTE OCULTO PARA IMPRESIÓN */}
            <div style={{ display: "none" }}>
                <StockPrintTemplate ref={componentRef} items={selectedItems} title={reportTitle} />
            </div>

            {/* --- TOPBAR FILTROS (DISEÑO INVENTARIO) --- */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 shadow-md z-30 shrink-0">
                <div className="max-w-[1920px] mx-auto">
                    {/* Fila 1: Título, Buscador y Acciones Principales */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center whitespace-nowrap">
                                <Box className="mr-2 text-blue-600" /> Reporte Stock
                            </h1>
                        </div>

                        {/* Buscador Central Grande */}
                        <div className="relative w-full max-w-2xl group">
                            <Search className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-12 pr-12 py-3 bg-gray-100 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-gray-700 dark:text-white placeholder-gray-400 text-lg shadow-inner"
                                placeholder="Buscar productos para el reporte..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            {(searchTerm || selectedCat || selectedSpec) && (
                                <button
                                    onClick={clearFilters}
                                    className="absolute right-3 top-3.5 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Limpiar filtros"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>

                        {/* Botón Agregar Todo */}
                        <div className="w-full md:w-auto flex justify-end">
                            {searchResults.length > 0 && (
                                <button
                                    onClick={handleAddAllResults}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-6 rounded-xl text-sm font-bold flex items-center shadow-lg transition-all active:scale-95 whitespace-nowrap"
                                >
                                    <ListPlus size={18} className="mr-2" />
                                    Agregar ({searchResults.reduce((acc, p) => acc + p.variantes.length, 0)})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: Filtros Rápidos (Chips) */}
                    <div className="flex flex-col gap-2">
                        {/* Categorías */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1">Categoría:</span>
                            <button onClick={() => setSelectedCat('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${selectedCat === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Todas</button>
                            {categories.map(c => (
                                <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${selectedCat == c.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                        {/* Ligas/Tipos */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1">Tipo/Liga:</span>
                            <button onClick={() => setSelectedSpec('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${selectedSpec === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-50'}`}>Todas</button>
                            {specificCategories.map(c => (
                                <button key={c.id} onClick={() => setSelectedSpec(selectedSpec === c.id ? '' : c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${selectedSpec == c.id ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- CONTENIDO PRINCIPAL (SPLIT VIEW) --- */}
            <div className="flex flex-1 overflow-hidden">

                {/* 1. RESULTADOS (IZQUIERDA - MAYOR ESPACIO) */}
                <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-950/50 p-4 custom-scrollbar">
                    {searchResults.length === 0 && !isSearching && (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            {searchTerm || selectedCat || selectedSpec ? (
                                <>
                                    <AlertCircle size={48} className="mb-2 opacity-50" />
                                    <p className="text-lg font-bold">No se encontraron productos</p>
                                    <p className="text-sm">Intenta con otros filtros</p>
                                </>
                            ) : (
                                <>
                                    <Search size={48} className="mb-2 opacity-20" />
                                    <p className="text-lg font-bold opacity-60">Listo para buscar</p>
                                    <p className="text-sm opacity-60">Usa el panel superior para filtrar el stock</p>
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-w-[1600px] mx-auto">
                        {searchResults.map(p => (
                            <div key={p.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all group">
                                <div className="flex gap-4">
                                    <div
                                        className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 flex items-center justify-center overflow-hidden relative cursor-zoom-in border border-gray-100 dark:border-slate-600"
                                        onClick={(e) => { e.stopPropagation(); if (p.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); }}
                                    >
                                        {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={24} className="text-gray-300 dark:text-slate-500" />}
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 size={16} className="text-white drop-shadow-md" /></div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-gray-800 dark:text-white truncate text-base leading-tight">{p.nombre}</h3>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">SKU Base: {p.id}</p>
                                            </div>
                                            <button onClick={() => handleAddCurve(p)} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-bold flex items-center transition-colors">
                                                <Layers size={14} className="mr-1" /> Todo
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {p.variantes.map(v => {
                                                const isAdded = selectedItems.some(i => i.id_variante === v.id_variante);
                                                return (
                                                    <button
                                                        key={v.id_variante}
                                                        onClick={() => handleAddItem(p, v)}
                                                        disabled={isAdded}
                                                        className={`
                                                            text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all
                                                            ${isAdded
                                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default opacity-70'
                                                                : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-600 hover:shadow-sm'
                                                            }
                                                        `}
                                                    >
                                                        <span className="font-bold">{v.talle}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${v.stock > 0 ? 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300' : 'bg-red-50 text-red-500'}`}>{v.stock}</span>
                                                        {isAdded && <CheckCircle size={12} />}
                                                    </button>
                                                );
                                            })}
                                            {p.variantes.length === 0 && <span className="text-xs text-red-400 italic">Sin stock</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. VISTA PREVIA REPORTE (DERECHA - PANEL FIJO) */}
                <div className="w-96 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col shadow-xl z-20">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                        <h2 className="text-sm font-black text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Vista Previa Reporte</h2>
                        <input
                            type="text"
                            className="w-full text-lg font-bold text-gray-800 dark:text-white placeholder-gray-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition-all"
                            placeholder="Título (ej: Control Remeras)"
                            value={reportTitle}
                            onChange={e => setReportTitle(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                        {selectedItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                                <FileText size={40} className="mb-3 opacity-20" />
                                <p className="text-sm">Agrega productos del panel izquierdo para armar tu reporte.</p>
                            </div>
                        ) : (
                            selectedItems.map((item, idx) => (
                                <div key={`${item.id_variante}-${idx}`} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl hover:shadow-md transition-all group">
                                    <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-xs border border-gray-200 dark:border-slate-600">
                                        {item.talle}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 dark:text-white truncate">{item.nombre}</p>
                                        <p className="text-xs text-gray-400 font-mono">Stock: {item.stock_actual}</p>
                                    </div>
                                    <button onClick={() => handleRemoveItem(item.id_variante)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                        <div className="flex justify-between items-center text-sm font-bold text-gray-600 dark:text-gray-300">
                            <span>Total Ítems:</span>
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{selectedItems.length}</span>
                        </div>
                        <div className="flex gap-2">
                            {selectedItems.length > 0 && (
                                <button onClick={() => { if (window.confirm("¿Borrar todo?")) { setSelectedItems([]); setReportTitle(''); } }} className="px-3 py-3 rounded-xl border border-red-200 text-red-500 font-bold hover:bg-red-50 transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            )}
                            <button
                                onClick={handlePrint}
                                disabled={selectedItems.length === 0}
                                className="flex-1 bg-slate-900 dark:bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center shadow-lg hover:bg-black dark:hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Printer size={20} className="mr-2" /> GENERAR PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL ZOOM */}
            {zoomImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
                    <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-zoom-in" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-5 right-5 text-white/50 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"><X size={32} /></button>
                </div>
            )}
        </div>
    );
};

export default StockReportPage;