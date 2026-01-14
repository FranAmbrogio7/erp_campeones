import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    Package, QrCode, Search, Edit,
    ChevronLeft, ChevronRight, Shirt, Filter, XCircle,
    Cloud, UploadCloud, Loader2, Plus, Save, Image as ImageIcon // Agregamos iconos necesarios
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import { toast, Toaster } from 'react-hot-toast';

// --- DEFINICIÓN DE CURVAS DE TALLES (Igual que en ProductsPage) ---
const SIZE_GRIDS = {
    'ADULTO': ['S', 'M', 'L', 'XL', 'XXL'],
    'NIÑOS': ['4', '6', '8', '10', '12', '14', '16'],
    'BEBÉ': ['0', '1', '2', '3', '4', '5'],
    'ÚNICO': ['U'],
    'CALZADO': ['38', '39', '40', '41', '42', '43', '44']
};

const SOUNDS = {
    success: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3')
};

const InventoryPage = () => {
    // --- Estados de Datos ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    // --- Estados de Procesamiento ---
    const [processingId, setProcessingId] = useState(null);

    // --- Estados de Paginación ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // --- Estados de Filtros ---
    const [filters, setFilters] = useState({
        search: '', category_id: '', specific_id: '', min_price: '', max_price: ''
    });
    const [showFilters, setShowFilters] = useState(false);

    // --- ESTADOS PARA CREACIÓN (Traídos de ProductsPage) ---
    const [showForm, setShowForm] = useState(false);
    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [newProduct, setNewProduct] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    // --- Estados de Modales ---
    const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState(null);
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [imageModalSrc, setImageModalSrc] = useState(null);

    const playSound = (type) => {
        try {
            if (SOUNDS[type]) {
                SOUNDS[type].currentTime = 0;
                SOUNDS[type].volume = 0.5;
                SOUNDS[type].play();
            }
        } catch (e) { console.error("Error reproduciendo audio", e); }
    };

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
            toast.error("Error de conexión");
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

    // --- Manejadores de Filtros ---
    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const clearFilters = () => {
        setFilters({ search: '', category_id: '', specific_id: '', min_price: '', max_price: '' });
        playSound('success');
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchProducts(newPage);
        }
    };

    // --- MANEJO DE CREACIÓN DE PRODUCTO (Lógica de ProductsPage) ---
    const handleSubmitCreate = async (e) => {
        e.preventDefault();

        // Validaciones básicas
        if (!newProduct.categoria_id) {
            toast.error("Selecciona una categoría general");
            return;
        }
        if (!newProduct.nombre || !newProduct.precio) {
            toast.error("Completa nombre y precio");
            return;
        }

        const toastId = toast.loading("Creando producto...");

        try {
            const formData = new FormData();
            formData.append('nombre', newProduct.nombre);
            formData.append('precio', newProduct.precio);

            // --- LÓGICA DE CURVA DE TALLES ---
            const tallesToSend = SIZE_GRIDS[selectedGridType].join(',');
            formData.append('talle', tallesToSend);

            // Stock inicial (se aplicará a CADA talle)
            formData.append('stock', newProduct.stock);
            formData.append('categoria_id', newProduct.categoria_id);

            if (newProduct.categoria_especifica_id) {
                formData.append('categoria_especifica_id', newProduct.categoria_especifica_id);
            }
            if (selectedFile) {
                formData.append('imagen', selectedFile);
            }

            // Enviamos al backend
            await api.post('/products', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Éxito
            toast.success(`Creado con curva: ${selectedGridType}`, { id: toastId });
            playSound('success');

            // Limpiar formulario
            setShowForm(false);
            setNewProduct({
                nombre: '', precio: '', stock: '10', sku: '',
                categoria_id: '', categoria_especifica_id: ''
            });
            setSelectedGridType('ADULTO');
            setSelectedFile(null);

            // Recargar lista
            fetchProducts(1);

        } catch (e) {
            console.error(e);
            playSound('error');
            toast.error("Error: " + (e.response?.data?.msg || "Error desconocido"), { id: toastId });
        }
    };

    // --- Otros Manejadores ---
    const handleOpenBarcode = (productName, variant, price) => { // <--- Agregamos 'price'
        const skuToUse = variant.sku || `GEN-${variant.id_variante}`;
        setSelectedVariantForBarcode({
            nombre: productName,
            talle: variant.talle,
            sku: skuToUse,
            precio: price // <--- Guardamos el precio
        });
        setIsBarcodeModalOpen(true);
    };

    const handleEditClick = (product) => {
        setEditingProduct(product);
        setIsEditModalOpen(true);
    };

    const handlePublish = async (product) => {
        if (!window.confirm(`¿Publicar "${product.nombre}" en Tienda Nube?`)) return;
        setProcessingId(product.id);
        const toastId = toast.loading("Conectando con la nube...");

        try {
            await axios.post(`/api/products/${product.id}/publish`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            playSound('success');
            toast.success("¡Sincronizado correctamente!", { id: toastId });
            await fetchProducts(page);
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.msg || "Error al publicar", { id: toastId });
        } finally {
            setProcessingId(null);
        }
    };

    const getStockColor = (stock) => {
        if (stock === 0) return "bg-red-100 text-red-700 border-red-200 hover:bg-red-200";
        if (stock < 3) return "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200";
        return "bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-blue-300 hover:text-blue-600";
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <Toaster position="top-center" reverseOrder={false} />

            {/* HEADER Y ACCIONES */}
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
                                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-full shadow-sm outline-none transition-all focus:shadow-md"
                            />
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border flex items-center transition-all active:scale-95 ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                            title="Filtros avanzados"
                        >
                            <Filter size={20} />
                        </button>

                        {/* BOTÓN NUEVO (Ahora alterna el formulario inline) */}
                        <button
                            onClick={() => setShowForm(!showForm)}
                            className={`${showForm ? 'bg-gray-700' : 'bg-slate-900 hover:bg-black'} text-white px-4 py-2 rounded-lg font-bold flex items-center shadow-lg transition-all active:scale-95 whitespace-nowrap`}
                        >
                            {showForm ? <XCircle size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
                            {showForm ? 'Cancelar' : 'Nuevo'}
                        </button>
                    </div>
                </div>

                {/* PANEL DE FILTROS */}
                {showFilters && (
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 animate-fade-in-down">
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
                            <select name="category_id" value={filters.category_id} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none focus:ring-2 focus:ring-blue-100">
                                <option value="">Todas</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Liga / Tipo</label>
                            <select name="specific_id" value={filters.specific_id} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none focus:ring-2 focus:ring-blue-100">
                                <option value="">Todas</option>
                                {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Precio Mín</label>
                            <input type="number" name="min_price" value={filters.min_price} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none focus:ring-2 focus:ring-blue-100" placeholder="$ 0" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Precio Máx</label>
                            <input type="number" name="max_price" value={filters.max_price} onChange={handleFilterChange} className="w-full border p-2 rounded text-sm mt-1 outline-none focus:ring-2 focus:ring-blue-100" placeholder="$ ..." />
                        </div>
                        <div className="md:col-span-1 flex items-end">
                            <button onClick={clearFilters} className="w-full py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded text-sm font-bold flex items-center justify-center active:scale-95 transition-transform">
                                <XCircle size={16} className="mr-2" /> Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* --- FORMULARIO DE CREACIÓN (Copiado de ProductsPage) --- */}
            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow border border-blue-200 animate-fade-in-down shrink-0">
                    <h3 className="font-bold text-lg mb-4 text-gray-700 flex items-center">
                        <Plus size={20} className="mr-2 text-blue-600" /> Agregar Nuevo Producto
                    </h3>
                    <form onSubmit={handleSubmitCreate} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">

                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nombre</label>
                            <input
                                className="w-full border p-2 rounded outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                required
                                placeholder="Ej: Camiseta Boca 2025"
                                value={newProduct.nombre}
                                onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Categoría Gral.</label>
                            <select
                                className="w-full border p-2 rounded outline-none bg-white"
                                required
                                value={newProduct.categoria_id}
                                onChange={e => setNewProduct({ ...newProduct, categoria_id: e.target.value })}
                            >
                                <option value="">General...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Categoría Específica</label>
                            <select
                                className="w-full border p-2 rounded outline-none bg-white"
                                value={newProduct.categoria_especifica_id}
                                onChange={e => setNewProduct({ ...newProduct, categoria_especifica_id: e.target.value })}
                            >
                                <option value="">(Opcional)...</option>
                                {specificCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Precio ($)</label>
                            <div className="relative">
                                <span className="absolute left-2 top-2 text-gray-400">$</span>
                                <input
                                    className="w-full border p-2 pl-6 rounded outline-none"
                                    required
                                    type="number"
                                    value={newProduct.precio}
                                    onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* SELECTOR DE CURVA DE TALLES */}
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Curva de Talles</label>
                            <select
                                className="w-full border p-2 rounded outline-none bg-white text-sm"
                                value={selectedGridType}
                                onChange={e => setSelectedGridType(e.target.value)}
                            >
                                {Object.keys(SIZE_GRIDS).map(gridName => (
                                    <option key={gridName} value={gridName}>{gridName}</option>
                                ))}
                            </select>
                            {/* Previsualización */}
                            <div className="text-[10px] text-blue-500 mt-1 truncate font-medium">
                                {SIZE_GRIDS[selectedGridType].join(', ')}
                            </div>
                        </div>

                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Stock Inicial (c/u)</label>
                            <input
                                className="w-full border p-2 rounded outline-none"
                                required
                                type="number"
                                placeholder="Por talle"
                                value={newProduct.stock}
                                onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                            />
                        </div>

                        <div className="md:col-span-6 bg-gray-50 p-3 rounded border border-dashed border-gray-300 mt-2">
                            <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center cursor-pointer w-fit hover:text-blue-600">
                                <ImageIcon size={16} className="mr-1" /> Imagen del Producto (Opcional)
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setSelectedFile(e.target.files[0])}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>

                        <button
                            type="submit"
                            className="md:col-span-6 w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 mt-2 flex justify-center items-center shadow-md active:scale-[0.99] transition-transform"
                        >
                            <Save size={18} className="mr-2" /> Crear Producto con Curva
                        </button>
                    </form>
                </div>
            )}

            {/* MODALES */}
            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                product={editingProduct}
                categories={categories}
                specificCategories={specificCategories}
                onUpdate={() => {
                    fetchProducts(page);
                    playSound('success');
                }}
            />

            {imageModalSrc && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setImageModalSrc(null)}>
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
                                <th className="px-4 py-3">Variantes</th>
                                <th className="px-4 py-3 text-right w-24">Editar</th>
                                <th className="px-4 py-3 text-center">Web</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-blue-500">
                                            <Loader2 size={40} className="animate-spin mb-4" />
                                            <p className="font-bold text-gray-400">Cargando catálogo...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400">No se encontraron productos.</td></tr>
                            ) : (
                                products.map((product) => (
                                    <tr
                                        key={product.id}
                                        className={`hover:bg-slate-50 transition-colors group ${processingId === product.id ? 'bg-blue-50/50' : ''}`}
                                    >
                                        {/* 1. IMAGEN */}
                                        <td className="px-4 py-3 text-center">
                                            {product.imagen ? (
                                                <img
                                                    src={`/api/static/uploads/${product.imagen}`}
                                                    alt={product.nombre}
                                                    className="h-10 w-10 rounded object-cover border bg-white cursor-zoom-in hover:scale-150 hover:z-50 relative transition-all shadow-sm mx-auto"
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

                                        {/* 4. VARIANTES */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {product.variantes.map(v => (
                                                    <div
                                                        key={v.id_variante}
                                                        onClick={() => handleOpenBarcode(product.nombre, v, product.precio)}
                                                        className={`flex items-center px-2 py-1 rounded border text-xs cursor-pointer transition-all active:scale-95 shadow-sm ${getStockColor(v.stock)}`}
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

                                        {/* 5. ACCIONES (EDITAR) */}
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-all active:scale-90"
                                            >
                                                <Edit size={18} />
                                            </button>
                                        </td>

                                        {/* 6. COLUMNA ESTADO WEB */}
                                        <td className="px-4 py-3 text-center">
                                            {processingId === product.id ? (
                                                <div className="flex justify-center">
                                                    <Loader2 className="animate-spin text-blue-600" size={20} />
                                                </div>
                                            ) : product.tiendanube_id ? (
                                                <span className="inline-flex items-center justify-center p-2 bg-green-100 text-green-600 rounded-full" title="Sincronizado">
                                                    <Cloud size={18} />
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handlePublish(product)}
                                                    disabled={processingId !== null}
                                                    className="inline-flex items-center justify-center p-2 bg-gray-100 text-gray-400 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Subir a Tienda Nube"
                                                >
                                                    <UploadCloud size={18} />
                                                </button>
                                            )}
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
                        <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryPage;