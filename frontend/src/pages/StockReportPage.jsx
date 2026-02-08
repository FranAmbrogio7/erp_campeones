import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import StockPrintTemplate from '../components/StockPrintTemplate';
import {
    Search, Printer, Trash2, Box, FileText, ArrowLeft,
    Shirt, CheckCircle, Layers, Filter, X, Maximize2,
    AlertCircle, Plus, ChevronRight, ListPlus
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
                    limit: 200
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

    // --- ACCIONES LISTA INDIVIDUAL ---
    const handleAddItem = (product, variant) => {
        const exists = selectedItems.find(i => i.id_variante === variant.id_variante);
        if (exists) {
            toast.error("Ya está en la lista", { id: 'dup-toast' });
            return;
        }

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
        toast.success(`Agregado: ${variant.talle}`);
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

        if (itemsToAdd.length === 0) {
            toast('Todos los talles ya están agregados', { icon: '👌' });
            return;
        }

        setSelectedItems(prev => [...prev, ...itemsToAdd]);
        toast.success(`Agregados ${itemsToAdd.length} ítems`);
    };

    // --- AGREGADO MASIVO ---
    const handleAddAllResults = () => {
        if (searchResults.length === 0) return;
        const totalVariantesPosibles = searchResults.reduce((acc, p) => acc + p.variantes.length, 0);

        if (totalVariantesPosibles > 150) {
            if (!window.confirm(`⚠️ La búsqueda contiene ${totalVariantesPosibles} ítems en total. ¿Deseas agregarlos todos al reporte?`)) return;
        }

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

        if (addedCount > 0) {
            toast.success(`${addedCount} nuevos ítems agregados`, { duration: 3000 });
        } else {
            toast('Todos los ítems filtrados ya estaban incluidos', { icon: '📝' });
        }
    };

    const handleRemoveItem = (id_variante) => {
        setSelectedItems(prev => prev.filter(i => i.id_variante !== id_variante));
    };

    const handleClearList = () => {
        if (selectedItems.length > 0 && window.confirm("¿Limpiar toda la lista del reporte?")) {
            setSelectedItems([]);
            setReportTitle('');
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 overflow-hidden animate-fade-in transition-colors duration-300">
            <Toaster position="top-center" />

            {/* COMPONENTE OCULTO PARA IMPRESIÓN (Mantiene fondo blanco para papel) */}
            <div style={{ display: "none" }}>
                <StockPrintTemplate ref={componentRef} items={selectedItems} title={reportTitle} />
            </div>

            {/* --- IZQUIERDA: BUSCADOR Y RESULTADOS --- */}
            <div className="w-full md:w-5/12 lg:w-1/3 flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-20 relative transition-colors">

                {/* Header Buscador */}
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shrink-0 transition-colors">
                    <div className="flex items-center gap-2 mb-4">
                        <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center">
                            <Box className="mr-2 text-blue-600" /> Generador de Reportes
                        </h1>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Fila de Filtros */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                                    className="w-full appearance-none bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 dark:focus:ring-blue-900/30 cursor-pointer transition-colors"
                                >
                                    <option value="">Categoría...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <Filter size={12} className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative flex-1">
                                <select
                                    value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
                                    className="w-full appearance-none bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 py-2 pl-3 pr-8 rounded-lg text-xs font-bold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 dark:focus:ring-blue-900/30 cursor-pointer transition-colors"
                                >
                                    <option value="">Liga/Tipo...</option>
                                    {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <Filter size={12} className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Input Principal */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-10 pr-10 p-2.5 border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 outline-none transition-all font-medium text-gray-700 dark:text-white placeholder-gray-400"
                                placeholder="Buscar productos..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                            {(searchTerm || selectedCat || selectedSpec) && (
                                <button
                                    onClick={() => { setSearchTerm(''); setSelectedCat(''); setSelectedSpec(''); }}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* --- BOTÓN DE AGREGADO MASIVO --- */}
                        {searchResults.length > 0 && (
                            <button
                                onClick={handleAddAllResults}
                                className="w-full mt-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white hover:border-blue-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-sm active:scale-95 group"
                            >
                                <ListPlus size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                                Agregar TODOS los resultados ({searchResults.reduce((acc, p) => acc + p.variantes.length, 0)} ítems)
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista de Resultados */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 dark:bg-slate-950/30 p-2 custom-scrollbar">
                    {searchResults.length === 0 && !isSearching && (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 mt-10">
                            {searchTerm || selectedCat || selectedSpec ? (
                                <>
                                    <AlertCircle size={40} className="mb-2 opacity-50" />
                                    <p className="text-sm font-medium">No se encontraron productos</p>
                                </>
                            ) : (
                                <>
                                    <Search size={40} className="mb-2 opacity-20" />
                                    <p className="text-xs text-center px-10">Usa el buscador o los filtros para encontrar mercadería.</p>
                                </>
                            )}
                        </div>
                    )}

                    {searchResults.map(p => (
                        <div key={p.id} className="group bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-2 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all">
                            <div className="flex gap-3">
                                {/* Imagen */}
                                <div
                                    className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 flex items-center justify-center overflow-hidden relative cursor-zoom-in border border-gray-100 dark:border-slate-600"
                                    onClick={(e) => { e.stopPropagation(); if (p.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); }}
                                >
                                    {p.imagen ? (
                                        <>
                                            <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                                            <div className="hidden w-full h-full items-center justify-center bg-gray-50 text-gray-300"><Shirt size={20} /></div>
                                        </>
                                    ) : (<Shirt size={24} className="text-gray-300 dark:text-slate-500" />)}
                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Maximize2 size={16} className="text-white drop-shadow-md" />
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <h3 className="font-bold text-sm text-gray-800 dark:text-white truncate leading-tight" title={p.nombre}>{p.nombre}</h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">ID: {p.id}</p>
                                        </div>
                                        <button onClick={() => handleAddCurve(p)} className="shrink-0 text-[10px] flex items-center bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors font-bold whitespace-nowrap" title="Agregar todo">
                                            <Layers size={10} className="mr-1" /> Todo
                                        </button>
                                    </div>

                                    {/* Grid Variantes */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {p.variantes.map(v => {
                                            const isAdded = selectedItems.some(i => i.id_variante === v.id_variante);
                                            return (
                                                <button
                                                    key={v.id_variante}
                                                    onClick={() => handleAddItem(p, v)}
                                                    disabled={isAdded}
                                                    className={`
                                                        text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-all
                                                        ${isAdded
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default shadow-inner'
                                                            : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300'
                                                        }
                                                    `}
                                                >
                                                    <span className="font-bold">{v.talle}</span>
                                                    <span className={`text-[9px] px-1 rounded-sm ${v.stock > 0 ? 'bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-gray-300' : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-300'}`}>{v.stock}</span>
                                                    {isAdded ? <CheckCircle size={10} /> : <Plus size={10} className="opacity-0 group-hover:opacity-50" />}
                                                </button>
                                            );
                                        })}
                                        {p.variantes.length === 0 && <span className="text-[10px] text-red-400 italic">Sin stock cargado</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- DERECHA: VISTA PREVIA --- */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 h-full overflow-hidden relative transition-colors">

                {/* Header Reporte */}
                <div className="p-6 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm z-10 flex flex-col md:flex-row justify-between items-end gap-4 shrink-0 transition-colors">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Título del Reporte</label>
                        <div className="flex items-center gap-3">
                            <FileText size={24} className="text-blue-600" />
                            <input
                                type="text"
                                className="flex-1 text-2xl font-black text-gray-800 dark:text-white placeholder-gray-300 border-b-2 border-transparent focus:border-blue-500 outline-none bg-transparent transition-all py-1"
                                placeholder="Ej: Control Remeras..."
                                value={reportTitle}
                                onChange={e => setReportTitle(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {selectedItems.length > 0 && (
                            <button onClick={handleClearList} className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm flex items-center">
                                <Trash2 size={18} className="mr-2" /> Borrar
                            </button>
                        )}
                        <button onClick={handlePrint} disabled={selectedItems.length === 0} className="bg-slate-900 dark:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-black dark:hover:bg-slate-600 hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Printer size={20} className="mr-2" /> GENERAR PDF
                        </button>
                    </div>
                </div>

                {/* Tabla de Items */}
                <div className="flex-1 overflow-auto p-6">
                    {selectedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-600 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-full shadow-sm mb-4">
                                <FileText size={48} className="text-gray-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-600 dark:text-slate-400">Reporte Vacío</h3>
                            <p className="text-sm">Selecciona productos del panel izquierdo.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors">
                            <div className="p-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center px-6">
                                <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Detalle de Ítems</span>
                                <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold">{selectedItems.length} ítems</span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-xs uppercase font-bold sticky top-0 border-b border-gray-100 dark:border-slate-800">
                                    <tr>
                                        <th className="p-4 w-20 text-center">Talle</th>
                                        <th className="p-4">Producto / SKU</th>
                                        <th className="p-4 text-center">Stock Sistema</th>
                                        <th className="p-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800 text-sm">
                                    {selectedItems.map((item, idx) => (
                                        <tr key={`${item.id_variante}-${idx}`} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                            <td className="p-4 text-center">
                                                <span className="inline-block min-w-[2rem] py-1 px-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded font-bold text-gray-700 dark:text-slate-300 text-xs">
                                                    {item.talle}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800 dark:text-white">{item.nombre}</div>
                                                <div className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-0.5">{item.sku}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`font-mono font-bold ${item.stock_actual === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-slate-300'}`}>
                                                    {item.stock_actual}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => handleRemoveItem(item.id_variante)} className="text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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