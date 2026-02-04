import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    Package, Search, Edit, ChevronLeft, ChevronRight,
    Shirt, Filter, X, Cloud, UploadCloud, Loader2,
    Plus, Save, Image as ImageIcon, Printer, RefreshCw,
    AlertTriangle, CheckCircle2, ArrowUpRight
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import { toast, Toaster } from 'react-hot-toast';

// --- DEFINICIÓN DE CURVAS DE TALLES ---
const SIZE_GRIDS = {
    'ADULTO': ['S', 'M', 'L', 'XL', 'XXL'],
    'NIÑOS': ['4', '6', '8', '10', '12', '14', '16'],
    'BEBÉ': ['0', '1', '2', '3', '4', '5'],
    'ÚNICO': ['U'],
    'CALZADO': ['NIÑO', 'JUVENIL', 'ADULTO'],
    'TALLES ESPECIALES': ['6', '7', '8', '9', '10']
};

const SOUNDS = {
    success: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
    error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3')
};

const InventoryPage = () => {
    const { token } = useAuth();

    // --- ESTADOS DE DATOS ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS DE FILTROS ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');

    // --- ESTADOS DE ACCIÓN ---
    const [isSyncing, setIsSyncing] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    // --- ESTADOS DE CREACIÓN / EDICIÓN ---
    const [showForm, setShowForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: ''
    });
    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [selectedFile, setSelectedFile] = useState(null);

    // --- MODALES ---
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [imageModalSrc, setImageModalSrc] = useState(null);

    // Helper Audio
    const playSound = (type) => {
        try {
            if (SOUNDS[type]) {
                SOUNDS[type].currentTime = 0;
                SOUNDS[type].volume = 0.5;
                SOUNDS[type].play();
            }
        } catch (e) { console.error(e); }
    };

    // 1. CARGA INICIAL
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

    // 2. CARGA DE PRODUCTOS (Debounce + Filtros)
    const fetchProducts = async (currentPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: 15,
                search: searchTerm,
                category_id: selectedCat || undefined,
                specific_id: selectedSpec || undefined
            };

            const res = await api.get('/products', { params });
            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);
        } catch (error) {
            toast.error("Error cargando inventario");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayFn = setTimeout(() => {
            fetchProducts(1);
        }, 400);
        return () => clearTimeout(delayFn);
    }, [searchTerm, selectedCat, selectedSpec]);

    // --- ACCIONES DE STOCK Y WEB ---

    const handleForceSync = async () => {
        if (!window.confirm("⚠️ ¿Sincronizar Stock Masivamente?\n\nEsto enviará el stock actual de CADA producto del ERP hacia Tienda Nube. Puede tardar unos minutos.")) return;

        setIsSyncing(true);
        const toastId = toast.loading("Iniciando sincronización masiva...");

        try {
            const res = await api.post('/products/sync/force-tiendanube');
            toast.success(res.data.detalles, { id: toastId, duration: 6000 });
            playSound('success');
        } catch (error) {
            toast.error("Error al iniciar sync", { id: toastId });
            playSound('error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePublish = async (product) => {
        if (!window.confirm(`¿Publicar "${product.nombre}" en Tienda Nube?`)) return;
        setProcessingId(product.id);
        const toastId = toast.loading("Publicando...");

        try {
            await axios.post(`/api/products/${product.id}/publish`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            playSound('success');
            toast.success("¡Publicado exitosamente!", { id: toastId });
            await fetchProducts(page);
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.msg || "Error al publicar", { id: toastId });
        } finally {
            setProcessingId(null);
        }
    };

    // --- CREACIÓN RÁPIDA ---
    const handleSubmitCreate = async (e) => {
        e.preventDefault();
        if (!newProduct.categoria_id) return toast.error("Falta categoría");

        const toastId = toast.loading("Creando...");
        try {
            const fd = new FormData();
            fd.append('nombre', newProduct.nombre);
            fd.append('precio', newProduct.precio);
            fd.append('talle', SIZE_GRIDS[selectedGridType].join(','));
            fd.append('stock', newProduct.stock);
            fd.append('categoria_id', newProduct.categoria_id);
            if (newProduct.categoria_especifica_id) fd.append('categoria_especifica_id', newProduct.categoria_especifica_id);
            if (selectedFile) fd.append('imagen', selectedFile);

            await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });

            toast.success("Producto Creado", { id: toastId });
            playSound('success');
            setShowForm(false);
            setNewProduct({ nombre: '', precio: '', stock: '10', sku: '', categoria_id: '', categoria_especifica_id: '' });
            setSelectedFile(null);
            fetchProducts(1);
        } catch (e) {
            toast.error("Error creando producto", { id: toastId });
            playSound('error');
        }
    };

    // --- ETIQUETAS E IMPRESIÓN ---
    const handlePrintSingleLabel = async (e, product, variant) => {
        e.stopPropagation();
        const toastId = toast.loading("Generando etiqueta...");
        try {
            const itemParaImprimir = {
                sku: variant.sku || `GEN-${variant.id_variante}`,
                nombre: product.nombre,
                talle: variant.talle,
                cantidad: 1
            };
            const response = await api.post('/products/labels/batch-pdf', { items: [itemParaImprimir] }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            window.open(url, '_blank');
            toast.dismiss(toastId);
        } catch (error) {
            toast.error("Error al imprimir", { id: toastId });
        }
    };

    // Helper de Colores de Stock
    const getStockColorClass = (stock) => {
        if (stock === 0) return "bg-red-100 text-red-700 border-red-200 ring-1 ring-red-50";
        if (stock < 3) return "bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-50";
        return "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100";
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* HEADER & ACCIONES SUPERIORES */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                        <Package size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800">Control de Stock</h1>
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>Normal</span>
                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>Bajo</span>
                            <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>Agotado</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* Botón Sync Nube */}
                    <button
                        onClick={handleForceSync}
                        disabled={isSyncing}
                        className={`flex items-center px-4 py-2.5 rounded-xl text-xs font-bold border transition-all shadow-sm ${isSyncing ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-wait' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'}`}
                    >
                        <RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Sincronizando..." : "Sync Stock Nube"}
                    </button>

                    <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

                    {/* Botón Nuevo Producto */}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className={`flex items-center px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95 ${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-slate-900 hover:bg-black'}`}
                    >
                        {showForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
                        {showForm ? "Cancelar" : "Nuevo Producto"}
                    </button>
                </div>
            </div>

            {/* BARRA DE FILTROS INTEGRADA */}
            {!showForm && (
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-2 animate-fade-in">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre, SKU, código..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none transition-all font-medium text-sm"
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                    </div>

                    <select
                        value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                        className="md:w-48 bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600"
                    >
                        <option value="">Categoría: Todas</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>

                    <select
                        value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
                        className="md:w-48 bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600"
                    >
                        <option value="">Liga: Todas</option>
                        {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>
            )}

            {/* FORMULARIO DE CREACIÓN */}
            {showForm && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 animate-fade-in-down shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center">
                        <Plus className="mr-2 text-blue-500" /> Alta Rápida de Producto
                    </h3>
                    <form onSubmit={handleSubmitCreate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <label className="text-xs font-bold text-gray-500 uppercase">Nombre</label>
                            <input autoFocus required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400" placeholder="Ej: Camiseta..." value={newProduct.nombre} onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
                            <select required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg outline-none focus:border-blue-400" value={newProduct.categoria_id} onChange={e => setNewProduct({ ...newProduct, categoria_id: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Liga</label>
                            <select className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg outline-none focus:border-blue-400" value={newProduct.categoria_especifica_id} onChange={e => setNewProduct({ ...newProduct, categoria_especifica_id: e.target.value })}>
                                <option value="">(Opcional)</option>
                                {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Precio</label>
                            <input type="number" required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400" placeholder="$" value={newProduct.precio} onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })} />
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Curva</label>
                            <select className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg text-xs font-bold outline-none" value={selectedGridType} onChange={e => setSelectedGridType(e.target.value)}>
                                {Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="text-xs font-bold text-gray-500 uppercase">Stock Ini</label>
                            <input type="number" required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg text-center font-bold outline-none focus:border-blue-400" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
                        </div>
                        <div className="md:col-span-12 mt-2">
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md transition-all active:scale-[0.99]">GUARDAR PRODUCTO</button>
                        </div>
                    </form>
                </div>
            )}

            {/* TABLA DE INVENTARIO */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
                <div className="overflow-auto flex-1">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-center w-16">Foto</th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3 w-32">Precio</th>
                                <th className="px-4 py-3">Variantes & Stock</th>
                                <th className="px-4 py-3 text-center w-24">Nube</th>
                                <th className="px-4 py-3 text-right w-20">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Cargando inventario...</td></tr> :
                                products.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Sin resultados.</td></tr> :
                                    products.map(p => (
                                        <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors group ${processingId === p.id ? 'opacity-50 pointer-events-none' : ''}`}>

                                            {/* FOTO */}
                                            <td className="px-4 py-3 text-center">
                                                <div
                                                    onClick={() => p.imagen && setImageModalSrc(`/api/static/uploads/${p.imagen}`)}
                                                    className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img mx-auto"
                                                >
                                                    {p.imagen ? <img src={`/api/static/uploads/${p.imagen}`} className="h-full w-full object-cover" /> : <Shirt size={16} className="text-gray-300" />}
                                                </div>
                                            </td>

                                            {/* INFO */}
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-800">{p.nombre}</div>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold uppercase">{p.categoria}</span>
                                                    {p.liga !== '-' && <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase">{p.liga}</span>}
                                                </div>
                                            </td>

                                            {/* PRECIO */}
                                            <td className="px-4 py-3 font-mono font-bold text-gray-700">$ {p.precio.toLocaleString()}</td>

                                            {/* VARIANTES (STOCK PILLS) */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.variantes.map(v => (
                                                        <div
                                                            key={v.id_variante}
                                                            onClick={() => { setSelectedVariantForBarcode({ nombre: p.nombre, talle: v.talle, sku: v.sku, precio: p.precio }); setIsBarcodeModalOpen(true); }}
                                                            className={`flex items-center pl-2 pr-1 py-1 rounded-md text-xs cursor-pointer transition-all active:scale-95 shadow-sm border ${getStockColorClass(v.stock)}`}
                                                            title={`SKU: ${v.sku}`}
                                                        >
                                                            <span className="font-bold mr-1.5">{v.talle}</span>
                                                            <span className="font-mono text-[10px] opacity-80 border-l border-current pl-1.5 mr-1">{v.stock}</span>
                                                            <button onClick={(e) => handlePrintSingleLabel(e, p, v)} className="p-0.5 rounded hover:bg-black/10 transition-colors ml-0.5" title="Imprimir Etiqueta">
                                                                <Printer size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {p.variantes.length === 0 && <span className="text-xs text-red-400 italic">Sin variantes</span>}
                                                </div>
                                            </td>

                                            {/* ESTADO NUBE */}
                                            <td className="px-4 py-3 text-center">
                                                {processingId === p.id ? <Loader2 size={18} className="animate-spin text-blue-600 mx-auto" /> :
                                                    p.tiendanube_id ?
                                                        <span className="inline-flex items-center justify-center p-1.5 bg-green-100 text-green-600 rounded-full" title="Sincronizado con Tienda Nube"><Cloud size={16} /></span> :
                                                        <button onClick={() => handlePublish(p)} className="inline-flex items-center justify-center p-1.5 bg-gray-100 text-gray-400 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition-colors" title="Publicar en Tienda Nube"><UploadCloud size={16} /></button>
                                                }
                                            </td>

                                            {/* ACCIONES */}
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => { setEditingProduct(p); setIsEditModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors">
                                                    <Edit size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            }
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="bg-white p-3 border-t border-gray-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-400 font-medium">Pág <span className="text-gray-800 font-bold">{page}</span> de {totalPages}</span>
                    <div className="flex gap-2">
                        <button onClick={() => page > 1 && fetchProducts(page - 1)} disabled={page === 1} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={() => page < totalPages && fetchProducts(page + 1)} disabled={page === totalPages} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* MODALES FLOTANTES */}
            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} product={editingProduct} categories={categories} specificCategories={specificCategories} onUpdate={() => { fetchProducts(page); playSound('success'); }} />
            {imageModalSrc && <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setImageModalSrc(null)}><img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl animate-zoom-in" onClick={e => e.stopPropagation()} /><button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button></div>}
        </div>
    );
};

export default InventoryPage;