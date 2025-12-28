import { useEffect, useState } from 'react';
import BulkPriceModal from '../components/BulkPriceModal';
import { Plus, Trash2, Shirt, Save, ChevronLeft, ChevronRight, Search, Image as ImageIcon, X, TrendingUp } from 'lucide-react';
import { useAuth, api } from '../context/AuthContext';

// --- DEFINICIÓN DE CURVAS DE TALLES ---
const SIZE_GRIDS = {
    'ADULTO': ['S', 'M', 'L', 'XL', 'XXL'],
    'NIÑOS': ['4', '6', '8', '10', '12', '14', '16'],
    'BEBÉ': ['0', '1', '2', '3', '4', '5'],
    'ÚNICO': ['U'],
    'CALZADO': ['38', '39', '40', '41', '42', '43', '44']
};

const ProductsPage = () => {
    // --- Estados de Datos ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuth();

    // --- Estados de Paginación y Búsqueda ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Estados de Formulario ---
    const [showForm, setShowForm] = useState(false);

    // Estado para la curva seleccionada (Por defecto Adulto)
    const [selectedGridType, setSelectedGridType] = useState('ADULTO');

    const [newProduct, setNewProduct] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: ''
    });
    const [selectedFile, setSelectedFile] = useState(null);

    // --- Estado para Modal de Zoom de Imagen ---
    const [imageModalSrc, setImageModalSrc] = useState(null);

    // --- Estado para Modal de Actualización Masiva ---
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // 1. Cargar Listas Desplegables (Solo al inicio)
    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                const [resCat, resSpec] = await Promise.all([
                    api.get('/products/categories'),
                    api.get('/products/specific-categories')
                ]);
                setCategories(resCat.data);
                setSpecificCategories(resSpec.data);
            } catch (e) {
                console.error("Error cargando categorías", e);
            }
        };
        if (token) fetchDropdowns();
    }, [token]);

    // 2. Cargar Productos (Paginados)
    const fetchProducts = async (currentPage, search) => {
        setLoading(true);
        try {
            const res = await api.get('/products', {
                params: { page: currentPage, limit: 10, search: search }
            });
            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);
        } catch (error) {
            console.error(error);
            alert("Error cargando productos");
        } finally {
            setLoading(false);
        }
    };

    // 3. Efecto Debounce para Buscador
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchProducts(1, searchTerm);
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // 4. Cambio de Página
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchProducts(newPage, searchTerm);
        }
    };

    // --- Acciones ---

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de borrar este producto?")) return;
        try {
            await api.delete(`/products/${id}`);
            fetchProducts(page, searchTerm);
            alert("Producto eliminado correctamente");
        } catch (e) {
            alert("Error al borrar: " + (e.response?.data?.msg || "Error desconocido"));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newProduct.categoria_id) {
            alert("Selecciona una categoría general");
            return;
        }

        try {
            const formData = new FormData();
            formData.append('nombre', newProduct.nombre);
            formData.append('precio', newProduct.precio);

            // --- LÓGICA DE CURVA DE TALLES ---
            // Enviamos la lista de talles separada por comas (ej: "S,M,L,XL")
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

            await api.post('/products', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setShowForm(false);
            // Resetear formulario
            setNewProduct({
                nombre: '', precio: '', stock: '10', sku: '',
                categoria_id: '', categoria_especifica_id: ''
            });
            setSelectedGridType('ADULTO'); // Volver al default
            setSelectedFile(null);
            setSearchTerm('');
            fetchProducts(1, '');
            alert(`Producto creado correctamente con talles: ${tallesToSend}`);

        } catch (e) {
            alert("Error: " + (e.response?.data?.msg || "Error desconocido"));
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <Shirt className="mr-2 text-blue-600" /> Gestión de Productos
                    </h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700 shadow whitespace-nowrap"
                    >
                        <Plus size={18} className="mr-2" /> Nuevo
                    </button>

                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-emerald-700 shadow whitespace-nowrap ml-2"
                    >
                        <TrendingUp size={18} className="mr-2" /> Ajustar Precios
                    </button>
                    <BulkPriceModal
                        isOpen={isBulkModalOpen}
                        onClose={() => setIsBulkModalOpen(false)}
                        onUpdate={fetchProducts}
                        categories={categories}
                        specificCategories={specificCategories}
                    />
                </div>
            </div>

            {/* FORMULARIO */}
            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow border border-blue-200 animate-fade-in-down shrink-0">
                    <h3 className="font-bold text-lg mb-4 text-gray-700">Agregar Nuevo Producto</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">

                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Nombre</label>
                            <input
                                className="w-full border p-2 rounded outline-none focus:border-blue-500"
                                required
                                placeholder="Ej: Camiseta Boca 2025"
                                value={newProduct.nombre}
                                onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })}
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
                            <input
                                className="w-full border p-2 rounded outline-none"
                                required
                                type="number"
                                value={newProduct.precio}
                                onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })}
                            />
                        </div>

                        {/* SELECTOR DE CURVA DE TALLES (NUEVO) */}
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
                            <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center cursor-pointer w-fit">
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
                            className="md:col-span-6 w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 mt-2 flex justify-center items-center"
                        >
                            <Save size={18} className="mr-2" /> Guardar Producto
                        </button>
                    </form>
                </div>
            )}

            {/* TABLA DE PRODUCTOS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                <div className="overflow-auto flex-1">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">Img</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoría</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Precio</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stock Total</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-10 text-center text-gray-500">
                                        Cargando...
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-10 text-center text-gray-500">
                                        No se encontraron productos.
                                    </td>
                                </tr>
                            ) : (
                                products.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        {/* COLUMNA IMAGEN */}
                                        <td className="px-6 py-2">
                                            {p.imagen ? (
                                                <img
                                                    src={`/api/static/uploads/${p.imagen}`}
                                                    alt={p.nombre}
                                                    className="h-10 w-10 rounded object-cover border bg-white cursor-zoom-in hover:scale-110 transition-transform"
                                                    onClick={() => setImageModalSrc(`/api/static/uploads/${p.imagen}`)}
                                                    onError={(e) => {
                                                        e.target.src = 'https://via.placeholder.com/40?text=Error';
                                                        e.target.onerror = null;
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 border">
                                                    <Shirt size={20} />
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 font-medium text-gray-900">{p.nombre}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{p.categoria}</td>
                                        <td className="px-6 py-4 text-green-600 font-bold">$ {p.precio.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.stock_total > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                {p.stock_total} u.
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="text-gray-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
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
                    <span className="text-sm text-gray-500">
                        Página <span className="font-bold text-gray-800">{page}</span> de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1 || loading}
                            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} className="mr-1" /> Anterior
                        </button>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === totalPages || loading}
                            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Siguiente <ChevronRight size={16} className="ml-1" />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MODAL DE ZOOM DE IMAGEN --- */}
            {imageModalSrc && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
                    onClick={() => setImageModalSrc(null)}
                >
                    <div className="relative max-w-3xl w-full h-auto max-h-[90vh] flex justify-center">
                        <img
                            src={imageModalSrc}
                            alt="Zoom"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setImageModalSrc(null)}
                            className="absolute -top-4 -right-4 bg-white text-slate-800 rounded-full p-2 shadow-lg hover:bg-slate-100 transition-colors border border-slate-200"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProductsPage;