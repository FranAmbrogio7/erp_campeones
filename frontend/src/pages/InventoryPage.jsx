import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Package, QrCode, AlertTriangle, Search, Edit,
    ChevronLeft, ChevronRight, Shirt, Image as ImageIcon, Filter, XCircle, Cloud, CloudOff, UploadCloud
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import { api } from '../context/AuthContext';
import { toast } from 'react-hot-toast';


const InventoryPage = () => {
    // --- Estados de Datos ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    // --- Estados de Paginación ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // --- Estados de Filtros ---
    const [filters, setFilters] = useState({
        search: '',
        category_id: '',
        specific_id: '',
        min_price: '',
        max_price: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // --- Estados de Modales ---
    const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState(null);
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // --- Estado Zoom Imagen ---
    const [imageModalSrc, setImageModalSrc] = useState(null);

    // 1. Cargar Dropdowns
    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                const [resCat, resSpec] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);
                setCategories(resCat.data);
                setSpecificCategories(resSpec.data);
            } catch (e) { console.error(e); }
        };
        if (token) fetchDropdowns();
    }, [token]);

    // 2. Cargar Productos
    const fetchProducts = async (currentPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: 15,
                search: filters.search,
                category_id: filters.category_id || undefined,
                specific_id: filters.specific_id || undefined,
                min_price: filters.min_price || undefined,
                max_price: filters.max_price || undefined
            };

            const res = await api.get('/products', { params });

            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);
        } catch (error) {
            console.error("Error cargando productos", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayFn = setTimeout(() => {
            fetchProducts(1);
        }, 500);
        return () => clearTimeout(delayFn);
    }, [filters]);

    // --- Manejadores ---
    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const clearFilters = () => {
        setFilters({ search: '', category_id: '', specific_id: '', min_price: '', max_price: '' });
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchProducts(newPage);
        }
    };

    const handleOpenBarcode = (productName, variant) => {
        const skuToUse = variant.sku || `GEN-${variant.id_variante}`;
        setSelectedVariantForBarcode({ nombre: productName, talle: variant.talle, sku: skuToUse });
        setIsBarcodeModalOpen(true);
    };

    const handleEditClick = (product) => {
        setEditingProduct(product);
        setIsEditModalOpen(true);
    };

    const handlePublish = async (product) => {
        if (!window.confirm(`¿Publicar "${product.nombre}" en Tienda Nube?`)) return;

        const toastId = toast.loading("Subiendo a la nube...");
        try {
            await axios.post(`http://localhost:5000/api/products/${product.id}/publish`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success("¡Publicado exitosamente!", { id: toastId });
            fetchProducts(page); // Recargar para ver el icono verde
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.msg || "Error al publicar", { id: toastId });
        }
    };

    const getStockColor = (stock) => {
        if (stock === 0) return "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
        if (stock < 3) return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200";
        return "bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-blue-300 hover:text-blue-600";
    };

    return (
        <div className="space-y-6 h-full flex flex-col">

            {/* HEADER Y FILTROS */}
            <div className="shrink-0 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                            <Package className="mr-3 text-blue-600" />
                            Inventario
                        </h1>
                        <p className="text-gray-500 text-sm">Gestión de catálogo y stock</p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <input
                                name="search"
                                placeholder="Buscar nombre o SKU..."
                                value={filters.search}
                                onChange={handleFilterChange}
                                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-full shadow-sm outline-none"
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border flex items-center transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-gray-600'}`}
                            title="Filtros avanzados"
                        >
                            <Filter size={20} />
                        </button>
                    </div>
                </div>

                {/* PANEL DE FILTROS */}
                {showFilters && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 animate-fade-in-down">
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
                            <select name="category_id" value={filters.category_id} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none">
                                <option value="">Todas</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Liga / Tipo</label>
                            <select name="specific_id" value={filters.specific_id} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none">
                                <option value="">Todas</option>
                                {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Precio Mín</label>
                            <input type="number" name="min_price" value={filters.min_price} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none" placeholder="$ 0" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Precio Máx</label>
                            <input type="number" name="max_price" value={filters.max_price} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none" placeholder="$ ..." />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                            <button onClick={clearFilters} className="w-full py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded text-sm font-bold flex items-center justify-center">
                                <XCircle size={16} className="mr-2" /> Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODALES */}
            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} product={editingProduct} categories={categories} specificCategories={specificCategories} onUpdate={() => fetchProducts(page)} />

            {imageModalSrc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setImageModalSrc(null)}>
                    <img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded shadow-2xl animate-zoom-in" onClick={e => e.stopPropagation()} />
                </div>
            )}

            {/* TABLA PRINCIPAL */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10 text-gray-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-4 py-3 w-16 text-center">Foto</th>
                                <th className="px-4 py-3">Descripción Producto</th>
                                <th className="px-4 py-3 w-32">Precio</th>
                                <th className="px-4 py-3">Variantes (Clic para ver código)</th>
                                <th className="px-4 py-3 text-right w-24">Editar</th>
                                <th className="px-4 py-3 text-center">Web</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400">Cargando catálogo...</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400">No se encontraron productos.</td></tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id} className="hover:bg-slate-50 transition-colors group">

                                        {/* 0. COLUMNA ESTADO WEB */}
                                        <td className="px-4 py-3 text-center">
                                            {product.tiendanube_id ? (
                                                <span className="inline-flex items-center justify-center p-2 bg-green-100 text-green-600 rounded-full" title="Sincronizado">
                                                    <Cloud size={18} />
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handlePublish(product)}
                                                    className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                                    title="Subir a Tienda Nube"
                                                >
                                                    <UploadCloud size={18} />
                                                </button>
                                            )}
                                        </td>

                                        {/* 1. IMAGEN */}
                                        <td className="px-4 py-3 text-center">
                                            {product.imagen ? (
                                                <img
                                                    src={`/api/static/uploads/${product.imagen}`}
                                                    alt={product.nombre}
                                                    className="h-10 w-10 rounded object-cover border bg-white cursor-zoom-in hover:scale-110 transition-transform shadow-sm mx-auto"
                                                    onClick={() => setImageModalSrc(`/api/static/uploads/${product.imagen}`)}
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-slate-300 border mx-auto"><Shirt size={18} /></div>
                                            )}
                                        </td>

                                        {/* 2. DATOS */}
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-800">{product.nombre}</div>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{product.categoria}</span>
                                                {product.liga !== '-' && <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-100">{product.liga}</span>}
                                            </div>
                                        </td>

                                        {/* 3. PRECIO */}
                                        <td className="px-4 py-3 font-mono font-bold text-gray-700">
                                            $ {product.precio.toLocaleString()}
                                        </td>

                                        {/* 4. VARIANTES (PASTILLAS DE COLORES) */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {product.variantes.map(v => (
                                                    <div
                                                        key={v.id_variante}
                                                        onClick={() => handleOpenBarcode(product.nombre, v)}
                                                        className={`flex items-center px-2 py-1 rounded border text-xs cursor-pointer transition-all shadow-sm ${getStockColor(v.stock)}`}
                                                        title="Clic para ver Código de Barras"
                                                    >
                                                        <span className="font-bold mr-1.5">{v.talle}</span>
                                                        <span className="font-mono text-[10px] opacity-80 border-l border-current pl-1.5">{v.stock}</span>
                                                        <QrCode size={10} className="ml-1.5 opacity-50" />
                                                    </div>
                                                ))}
                                                {product.variantes.length === 0 && <span className="text-xs text-gray-400 italic">Sin stock</span>}
                                            </div>
                                        </td>

                                        {/* 5. ACCIONES */}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-all"
                                            >
                                                <Edit size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="bg-gray-50 p-3 border-t flex items-center justify-between shrink-0">
                    <span className="text-sm text-gray-500">Pág <span className="font-bold text-gray-900">{page}</span> de {totalPages}</span>
                    <div className="flex gap-2">
                        <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                        <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryPage;