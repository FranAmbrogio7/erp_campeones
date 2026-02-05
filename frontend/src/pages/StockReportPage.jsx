import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import StockPrintTemplate from '../components/StockPrintTemplate';
import {
    Search, Printer, Trash2, Box, FileText, ArrowLeft,
    Shirt, CheckCircle, Layers, Filter, X, Maximize2,
    AlertCircle, Plus, ChevronRight, ListPlus // <--- NUEVO ICONO
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
        // Si no hay criterios de búsqueda, limpiamos
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
                    limit: 200 // Límite amplio para permitir reportes grandes
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

    // --- NUEVO: FUNCIÓN DE AGREGADO MASIVO ---
    const handleAddAllResults = () => {
        if (searchResults.length === 0) return;

        // Calculamos el total real de variantes que vamos a intentar agregar
        const totalVariantesPosibles = searchResults.reduce((acc, p) => acc + p.variantes.length, 0);

        // Protección de rendimiento
        if (totalVariantesPosibles > 150) {
            if (!window.confirm(`⚠️ La búsqueda contiene ${totalVariantesPosibles} ítems en total. ¿Deseas agregarlos todos al reporte?`)) return;
        }

        let addedCount = 0;

        setSelectedItems(prev => {
            const newItems = [...prev];
            // Creamos un Set con los IDs existentes para búsqueda rápida O(1)
            const existingIds = new Set(newItems.map(i => i.id_variante));

            searchResults.forEach(prod => {
                prod.variantes.forEach(v => {
                    // Solo agregamos si NO está ya en la lista
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
            toast.success(`${addedCount} nuevos ítems agregados al reporte`, { duration: 3000 });
            // Opcional: Limpiar búsqueda para ver el reporte limpio
            // setSearchTerm(''); setSelectedCat(''); setSelectedSpec(''); setSearchResults([]);
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
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden animate-fade-in">
            <Toaster position="top-center" />

            {/* COMPONENTE OCULTO PARA IMPRESIÓN (PLANTILLA PDF) */}
            <div style={{ display: "none" }}>
                <StockPrintTemplate
                    ref={componentRef}
                    items={selectedItems}
                    title={reportTitle}
                />
            </div>

            {/* --- IZQUIERDA: BUSCADOR Y RESULTADOS --- */}
            <div className="w-full md:w-5/12 lg:w-1/3 flex flex-col border-r border-gray-200 bg-white shadow-xl z-20 relative">

                {/* Header Buscador */}
                <div className="p-5 border-b border-gray-100 bg-white z-10 shrink-0">
                    <div className="flex items-center gap-2 mb-4">
                        <Link to="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-black text-gray-800 flex items-center">
                            <Box className="mr-2 text-blue-600" /> Generador de Reportes
                        </h1>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Fila de Filtros */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-600 py-2 pl-3 pr-8 rounded-lg text-xs font-bold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 cursor-pointer"
                                >
                                    <option value="">Categoría...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <Filter size={12} className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative flex-1">
                                <select
                                    value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
                                    className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-600 py-2 pl-3 pr-8 rounded-lg text-xs font-bold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-50 cursor-pointer"
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
                                className="w-full pl-10 pr-10 p-2.5 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
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

                        {/* --- BOTÓN DE AGREGADO MASIVO (SOLO VISIBLE CON RESULTADOS) --- */}
                        {searchResults.length > 0 && (
                            <button
                                onClick={handleAddAllResults}
                                className="w-full mt-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-sm active:scale-95 group"
                            >
                                <ListPlus size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                                Agregar TODOS los resultados ({searchResults.reduce((acc, p) => acc + p.variantes.length, 0)} ítems)
                            </button>
                        )}
                    </div>
                </div>

                {/* Lista de Resultados */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-2 custom-scrollbar">
                    {/* Empty State */}
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
                        <div key={p.id} className="group bg-white border border-gray-200 rounded-xl p-3 mb-2 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                            <div className="flex gap-3">
                                {/* Imagen con Zoom */}
                                <div
                                    className="w-16 h-16 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center overflow-hidden relative cursor-zoom-in border border-gray-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (p.imagen) setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`);
                                    }}
                                >
                                    {p.imagen ? (
                                        <>
                                            <img
                                                src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`}
                                                className="w-full h-full object-cover"
                                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} // Fallback simple
                                            />
                                            <div className="hidden w-full h-full items-center justify-center bg-gray-50 text-gray-300"><Shirt size={20} /></div>
                                        </>
                                    ) : (
                                        <Shirt size={24} className="text-gray-300" />
                                    )}
                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Maximize2 size={16} className="text-white drop-shadow-md" />
                                    </div>
                                </div>

                                {/* Info y Variantes */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <h3 className="font-bold text-sm text-gray-800 truncate pr-1 leading-tight">{p.nombre}</h3>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {p.id}</p>
                                        </div>
                                        <button
                                            onClick={() => handleAddCurve(p)}
                                            className="text-[10px] flex items-center bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors font-bold whitespace-nowrap"
                                            title="Agregar todos los talles de este producto"
                                        >
                                            <Layers size={10} className="mr-1" /> Todo
                                        </button>
                                    </div>

                                    {/* Grid de Botones Variantes */}
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
                                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default shadow-inner'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                                                        }
                                                    `}
                                                >
                                                    <span className="font-bold">{v.talle}</span>
                                                    <span className={`text-[9px] px-1 rounded-sm ${v.stock > 0 ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-500'}`}>
                                                        {v.stock}
                                                    </span>
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

            {/* --- DERECHA: VISTA PREVIA Y ACCIONES --- */}
            <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden relative">

                {/* Header Reporte */}
                <div className="p-6 bg-white border-b border-gray-200 shadow-sm z-10 flex flex-col md:flex-row justify-between items-end gap-4 shrink-0">
                    <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Título del Reporte</label>
                        <div className="flex items-center gap-3">
                            <FileText size={24} className="text-blue-600" />
                            <input
                                type="text"
                                className="flex-1 text-2xl font-black text-gray-800 placeholder-gray-300 border-b-2 border-transparent focus:border-blue-500 outline-none bg-transparent transition-all py-1"
                                placeholder="Ej: Control Remeras..."
                                value={reportTitle}
                                onChange={e => setReportTitle(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {selectedItems.length > 0 && (
                            <button
                                onClick={handleClearList}
                                className="px-4 py-3 rounded-xl border border-red-200 text-red-500 font-bold hover:bg-red-50 transition-colors text-sm flex items-center"
                            >
                                <Trash2 size={18} className="mr-2" /> Borrar
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            disabled={selectedItems.length === 0}
                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-black hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            <Printer size={20} className="mr-2" /> GENERAR PDF
                        </button>
                    </div>
                </div>

                {/* Tabla de Items */}
                <div className="flex-1 overflow-auto p-6">
                    {selectedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
                            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                                <FileText size={48} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-600">Reporte Vacío</h3>
                            <p className="text-sm">Selecciona productos del panel izquierdo para comenzar.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center px-6">
                                <span className="text-xs font-bold text-gray-500 uppercase">Detalle de Ítems</span>
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{selectedItems.length} ítems</span>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-white text-gray-500 text-xs uppercase font-bold sticky top-0 border-b border-gray-100">
                                    <tr>
                                        <th className="p-4 w-20 text-center">Talle</th>
                                        <th className="p-4">Producto / SKU</th>
                                        <th className="p-4 text-center">Stock Sistema</th>
                                        <th className="p-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {selectedItems.map((item, idx) => (
                                        <tr key={`${item.id_variante}-${idx}`} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="p-4 text-center">
                                                <span className="inline-block min-w-[2rem] py-1 px-2 bg-gray-100 border border-gray-200 rounded font-bold text-gray-700 text-xs">
                                                    {item.talle}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800">{item.nombre}</div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">{item.sku}</div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`font-mono font-bold ${item.stock_actual === 0 ? 'text-red-500' : 'text-gray-600'}`}>
                                                    {item.stock_actual}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleRemoveItem(item.id_variante)}
                                                    className="text-gray-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                    title="Quitar de la lista"
                                                >
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
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out"
                    onClick={() => setZoomImage(null)}
                >
                    <img
                        src={zoomImage}
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-zoom-in"
                        onClick={e => e.stopPropagation()}
                    />
                    <button className="absolute top-5 right-5 text-white/50 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                        <X size={32} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default StockReportPage;