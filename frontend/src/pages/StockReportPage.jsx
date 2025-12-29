import { useState, useRef, useEffect } from 'react';
import { api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import StockPrintTemplate from '../components/StockPrintTemplate';
import {
    Search, Printer, Trash2, Box, Package, FileText,
    ArrowLeft, Shirt, CheckCircle, Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

const StockReportPage = () => {
    // --- ESTADOS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]); // Lista para imprimir
    const [reportTitle, setReportTitle] = useState('');

    // --- REFS ---
    const componentRef = useRef();
    const searchInputRef = useRef(null);

    // --- IMPRESIÓN ---
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Stock_${new Date().toLocaleDateString()}`,
        onAfterPrint: () => toast.success("PDF Generado correctamente")
    });

    // --- BUSCADOR ---
    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!searchTerm.trim()) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await api.get('/products', { params: { search: searchTerm, limit: 10 } });
                setSearchResults(res.data.products || []);
            } catch (error) {
                console.error(error);
            }
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    // --- MANEJADORES ---
    const handleAddItem = (product, variant) => {
        const exists = selectedItems.find(i => i.id_variante === variant.id_variante);
        if (exists) {
            toast.error("Ya está en la lista");
            return;
        }

        const newItem = {
            id_variante: variant.id_variante,
            sku: variant.sku,
            nombre: product.nombre,
            talle: variant.talle,
            stock_actual: variant.stock,
            precio: product.precio
        };

        setSelectedItems(prev => [...prev, newItem]);
        toast.success(`Agregado: ${variant.talle}`);
        searchInputRef.current?.focus();
    };

    // --- NUEVA FUNCIÓN: AGREGAR CURVA COMPLETA ---
    const handleAddCurve = (product) => {
        // Filtramos solo las variantes que NO estén ya en la lista
        const itemsToAdd = product.variantes
            .filter(v => !selectedItems.some(i => i.id_variante === v.id_variante))
            .map(v => ({
                id_variante: v.id_variante,
                sku: v.sku,
                nombre: product.nombre,
                talle: v.talle,
                stock_actual: v.stock,
                precio: product.precio
            }));

        if (itemsToAdd.length === 0) {
            toast('¡Ya tienes toda la curva agregada!', { icon: '👍' });
            return;
        }

        setSelectedItems(prev => [...prev, ...itemsToAdd]);
        toast.success(`Se agregaron ${itemsToAdd.length} variantes`);
        setSearchTerm(''); // Limpiar para buscar otro
        searchInputRef.current?.focus();
    };

    const handleRemoveItem = (id_variante) => {
        setSelectedItems(prev => prev.filter(i => i.id_variante !== id_variante));
    };

    const handleClearList = () => {
        if (window.confirm("¿Borrar toda la lista actual?")) setSelectedItems([]);
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-50 overflow-hidden">
            <Toaster position="top-center" />

            {/* COMPONENTE OCULTO PARA IMPRESIÓN */}
            <div style={{ display: "none" }}>
                <StockPrintTemplate
                    ref={componentRef}
                    items={selectedItems}
                    title={reportTitle}
                />
            </div>

            {/* --- COLUMNA IZQUIERDA: BUSCADOR --- */}
            <div className="w-full md:w-1/3 p-4 flex flex-col gap-4 border-r border-gray-200 bg-white z-10 shadow-sm">

                <div className="flex items-center gap-2 mb-2">
                    <Link to="/" className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center">
                        <Box className="mr-2 text-blue-600" /> Nuevo Reporte
                    </h1>
                </div>

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <label className="text-xs font-bold text-blue-800 uppercase mb-2 block">Buscar Producto</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-blue-400" size={20} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="w-full pl-10 p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Nombre, SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* RESULTADOS DE BÚSQUEDA */}
                <div className="flex-1 overflow-y-auto pr-1">
                    {searchResults.length === 0 && searchTerm && (
                        <div className="text-center p-4 text-gray-400 animate-fade-in">No se encontraron productos</div>
                    )}

                    {searchResults.map(p => (
                        <div key={p.id} className="mb-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                            <div className="flex gap-3">
                                {/* Imagen */}
                                <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                                    {p.imagen ? <img src={p.imagen} className="w-full h-full object-cover" /> : <Shirt size={24} className="text-gray-400" />}
                                </div>

                                {/* Info Producto */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-sm text-gray-800 truncate pr-2">{p.nombre}</h3>
                                        {/* BOTÓN CURVA COMPLETA */}
                                        <button
                                            onClick={() => handleAddCurve(p)}
                                            className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded-md font-bold flex items-center hover:bg-indigo-100 hover:text-indigo-800 transition-colors whitespace-nowrap"
                                            title="Agregar todos los talles"
                                        >
                                            <Layers size={12} className="mr-1" /> Curva Completa
                                        </button>
                                    </div>

                                    <p className="text-[10px] text-gray-400 mb-2 mt-1">Variantes disponibles:</p>

                                    {/* Variantes Individuales */}
                                    <div className="flex flex-wrap gap-2">
                                        {p.variantes.map(v => {
                                            const isAdded = selectedItems.some(i => i.id_variante === v.id_variante);
                                            return (
                                                <button
                                                    key={v.id_variante}
                                                    onClick={() => handleAddItem(p, v)}
                                                    disabled={isAdded}
                                                    className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition-all
                                                        ${isAdded
                                                            ? 'bg-green-100 text-green-700 border-green-200 cursor-default'
                                                            : 'bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-700'
                                                        }`}
                                                >
                                                    <span className="font-bold">{v.talle}</span>
                                                    <span className={`text-[9px] ml-1 px-1 rounded ${v.stock > 0 ? 'bg-gray-100' : 'bg-red-50 text-red-500'}`}>
                                                        {v.stock}
                                                    </span>
                                                    {isAdded && <CheckCircle size={10} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- COLUMNA DERECHA: PREVISUALIZACIÓN LISTA --- */}
            <div className="w-full md:w-2/3 p-6 flex flex-col bg-gray-50">

                {/* CONFIGURACIÓN DEL REPORTE */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex justify-between items-end gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Título del Reporte (Opcional)</label>
                        <div className="flex items-center gap-2">
                            <FileText size={20} className="text-gray-400" />
                            <input
                                type="text"
                                className="flex-1 p-2 border-b-2 border-gray-200 focus:border-blue-500 outline-none bg-transparent font-bold text-lg transition-colors"
                                placeholder="Ej: Control Camisetas Selección"
                                value={reportTitle}
                                onChange={e => setReportTitle(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <button
                            onClick={handlePrint}
                            disabled={selectedItems.length === 0}
                            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer size={20} /> Imprimir PDF
                        </button>
                    </div>
                </div>

                {/* TABLA VISUAL */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <h3 className="font-bold text-gray-700 flex items-center">
                            <Package className="mr-2 text-blue-600" size={18} />
                            Ítems Seleccionados ({selectedItems.length})
                        </h3>
                        {selectedItems.length > 0 && (
                            <button onClick={handleClearList} className="text-red-400 hover:text-red-600 text-xs font-bold bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition-colors">
                                Limpiar Todo
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {selectedItems.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <FileText size={48} className="mb-4 opacity-20" />
                                <p>Busca productos a la izquierda para armar tu reporte</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3 font-bold">SKU</th>
                                        <th className="p-3 font-bold">Producto</th>
                                        <th className="p-3 font-bold text-center">Talle</th>
                                        <th className="p-3 font-bold text-center">Stock Actual</th>
                                        <th className="p-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedItems.map((item, idx) => (
                                        <tr key={`${item.id_variante}-${idx}`} className="hover:bg-blue-50/30 group transition-colors">
                                            <td className="p-3 font-mono text-xs text-gray-500">{item.sku}</td>
                                            <td className="p-3 font-medium text-gray-800">{item.nombre}</td>
                                            <td className="p-3 text-center">
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold border">{item.talle}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`font-bold text-lg ${item.stock_actual === 0 ? 'text-red-500' : 'text-blue-600'}`}>
                                                    {item.stock_actual}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() => handleRemoveItem(item.id_variante)}
                                                    className="text-gray-300 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockReportPage;