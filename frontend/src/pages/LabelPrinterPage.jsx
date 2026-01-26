import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLabelQueue } from '../context/LabelContext';
import {
    Printer, Trash2, RotateCcw, FileText, Search, Plus, Layers,
    X, Maximize2, ImageOff, Shirt
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../context/AuthContext';

const LabelPrinterPage = () => {
    const { token } = useAuth();
    const { printQueue, addToQueue, updateQuantity, removeFromQueue, clearQueue } = useLabelQueue();

    // Estados para Generación de PDF
    const [isGenerating, setIsGenerating] = useState(false);

    // --- ESTADOS DEL BUSCADOR ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Estado para Zoom de Imagen
    const [zoomImage, setZoomImage] = useState(null);

    // Ref para detectar clic fuera del buscador
    const searchRef = useRef(null);

    // --- EFECTO DE BÚSQUEDA (Debounce) ---
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!searchTerm.trim()) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const res = await api.get(`/products?search=${searchTerm}&limit=5`);
                setSearchResults(res.data.products);
            } catch (e) {
                console.error(e);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    // --- EFECTO: CERRAR AL CLICKEAR AFUERA ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setSearchResults([]); // Cierra resultados pero mantiene el texto
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- MANEJO DE TECLADO (ESCAPE) ---
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setSearchResults([]); // Cerrar lista
            e.currentTarget.blur(); // Quitar foco opcionalmente
        }
    };

    // --- ACCIONES DE AGREGADO ---
    const handleAddSingle = (product, variant) => {
        addToQueue(product, variant);
        // No cerramos resultados para permitir carga rápida de varios talles
    };

    const handleAddFullCurve = (product) => {
        let count = 0;
        product.variantes.forEach(variant => {
            addToQueue(product, variant);
            count++;
        });
        toast.success(`Agregados ${count} talles de ${product.nombre}`);
        setSearchTerm('');
        setSearchResults([]);
    };

    // --- GENERAR PDF ---
    const handlePrintBatch = async () => {
        if (printQueue.length === 0) return;
        setIsGenerating(true);
        const toastId = toast.loading("Generando PDF...");

        try {
            const response = await api.post('/products/labels/batch-pdf', {
                items: printQueue
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const printWindow = window.open(url);

            toast.success("PDF Generado", { id: toastId });

            if (window.confirm("¿Se imprimieron correctamente? Limpiar cola.")) {
                clearQueue();
            }
        } catch (e) {
            console.error(e);
            toast.error("Error generando etiquetas", { id: toastId });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            <Toaster position="top-center" />

            {/* MODAL ZOOM IMAGEN */}
            {zoomImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-fade-in"
                    onClick={() => setZoomImage(null)}
                >
                    <img
                        src={zoomImage}
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain border-2 border-white/20"
                        alt="Zoom Producto"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/50 p-2 rounded-full transition-all hover:bg-red-600">
                        <X size={32} />
                    </button>
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
                <div className="relative">
                    <input
                        placeholder="Escribe el nombre, código o características..."
                        className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown} // <--- ESCAPE KEY
                        autoFocus
                    />
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />

                    {isSearching && (
                        <div className="absolute right-3 top-3">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                        </div>
                    )}
                </div>

                {/* RESULTADOS DE BÚSQUEDA */}
                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-gray-200 rounded-b-xl mt-1 overflow-hidden max-h-[400px] overflow-y-auto">
                        {searchResults.map(prod => (
                            <div key={prod.id} className="p-3 hover:bg-blue-50 border-b last:border-0 group transition-colors flex gap-4 items-start">

                                {/* 1. IMAGEN CON ZOOM */}
                                <div
                                    className="w-12 h-12 bg-gray-100 rounded-lg shrink-0 border overflow-hidden relative cursor-zoom-in group/img"
                                    onClick={() => prod.imagen && setZoomImage(`${api.defaults.baseURL}/static/uploads/${prod.imagen}`)}
                                >
                                    {prod.imagen ? (
                                        <>
                                            <img
                                                src={`${api.defaults.baseURL}/static/uploads/${prod.imagen}`}
                                                className="w-full h-full object-cover"
                                                alt={prod.nombre}
                                            />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                <Maximize2 size={16} className="text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Shirt size={20} />
                                        </div>
                                    )}
                                </div>

                                {/* 2. DATOS Y ACCIONES */}
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div
                                            className="cursor-pointer"
                                            onClick={() => handleAddFullCurve(prod)}
                                        >
                                            <p className="font-bold text-sm text-gray-800 group-hover:text-blue-600 transition-colors leading-tight">
                                                {prod.nombre}
                                            </p>
                                            <div className="flex items-center mt-1">
                                                <span className="text-xs font-mono text-gray-400 mr-2">{prod.sku_base || 'S/SKU'}</span>
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center hover:bg-blue-200 transition-colors">
                                                    <Layers size={10} className="mr-1" /> Agregar Todos
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            $ {prod.precio.toLocaleString()}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {prod.variantes.map(v => (
                                            <button
                                                key={v.id_variante}
                                                onClick={() => handleAddSingle(prod, v)}
                                                className="text-xs flex items-center bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm active:scale-95"
                                                title={`Agregar etiqueta Talle ${v.talle}`}
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

            {/* --- TABLA DE COLA --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative z-0">
                {/* ... (Esta parte se mantiene igual que antes, funcionalmente correcta) ... */}
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
                                La lista está vacía.<br />Usa el buscador de arriba para agregar etiquetas.
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
                                            <input
                                                type="number" min="1"
                                                className="w-16 p-2 border border-gray-300 rounded-lg text-center font-bold text-lg focus:border-blue-500 outline-none"
                                                value={item.cantidad}
                                                onChange={(e) => updateQuantity(item.sku, e.target.value)}
                                            />
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => removeFromQueue(item.sku)}
                                            className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                                            title="Quitar de la lista"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <div className="p-4 bg-gray-50 border-t flex justify-between items-center sticky bottom-0">
                    <div className="text-gray-600 font-medium">
                        Total Etiquetas: <span className="font-black text-gray-900 text-lg ml-2">{printQueue.reduce((acc, i) => acc + i.cantidad, 0)}</span>
                    </div>
                    <button
                        onClick={handlePrintBatch}
                        disabled={printQueue.length === 0 || isGenerating}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center hover:bg-black shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all active:scale-95"
                    >
                        {isGenerating ? (
                            <span className="flex items-center"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span> Generando...</span>
                        ) : (
                            <><FileText size={20} className="mr-2" />IMPRIMIR ETIQUETAS</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LabelPrinterPage;