import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    Package, Search, Edit, ChevronLeft, ChevronRight,
    Shirt, Filter, X, Cloud, UploadCloud, Loader2,
    Plus, Save, Image as ImageIcon, Printer, RefreshCw,
    AlertTriangle, CheckCircle2, ArrowUpRight,
    Archive, ArchiveRestore, Eye, EyeOff, Tags, TrendingUp, CheckSquare, Square, Trash2
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import BulkPriceModal from '../components/BulkPriceModal';
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

    // --- ESTADOS DE VISTA (NUEVO) ---
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'
    const [hideOutOfStock, setHideOutOfStock] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());

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
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false); // Nuevo Modal Precios
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

    // 2. CARGA DE PRODUCTOS (Con Filtros Nuevos)
    const fetchProducts = async (currentPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: 15,
                search: searchTerm,
                category_id: selectedCat || undefined,
                specific_id: selectedSpec || undefined,
                // Filtros nuevos:
                active: viewMode === 'active' ? 'true' : 'false',
                min_stock: hideOutOfStock ? 1 : undefined
            };

            const res = await api.get('/products', { params });
            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);

            // Limpiamos selección al cambiar página/filtros
            setSelectedItems(new Set());
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
    }, [searchTerm, selectedCat, selectedSpec, viewMode, hideOutOfStock]);

    // --- MANEJO DE SELECCIÓN ---
    const toggleSelect = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === products.length) setSelectedItems(new Set());
        else setSelectedItems(new Set(products.map(p => p.id)));
    };

    // --- ACCIONES DE ESTADO (ARCHIVAR / RESTAURAR) ---
    const handleToggleStatus = async (product) => {
        const action = viewMode === 'active' ? 'discontinuar' : 'restaurar';
        if (!window.confirm(`¿${action === 'discontinuar' ? 'Archivar' : 'Reactivar'} "${product.nombre}"?`)) return;
        try {
            await api.put(`/products/${product.id}/toggle-status`, { active: viewMode !== 'active' });
            toast.success(`Producto ${action === 'discontinuar' ? 'archivado' : 'restaurado'}`);
            fetchProducts(page);
        } catch (e) { toast.error("Error al cambiar estado"); }
    };

    const handleBulkToggleStatus = async () => {
        const action = viewMode === 'active' ? 'discontinuar' : 'restaurar';
        if (!window.confirm(`¿${action === 'discontinuar' ? 'Archivar' : 'Restaurar'} ${selectedItems.size} productos?`)) return;

        const t = toast.loading("Procesando...");
        try {
            const promises = Array.from(selectedItems).map(id =>
                api.put(`/products/${id}/toggle-status`, { active: viewMode !== 'active' })
            );
            await Promise.all(promises);
            toast.success("Proceso completado", { id: t });
            setSelectedItems(new Set());
            fetchProducts(page);
        } catch (e) { toast.error("Error masivo", { id: t }); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿ELIMINAR DEFINITIVAMENTE?\nEsta acción no se puede deshacer.")) return;
        try {
            await api.delete(`/products/${id}`);
            toast.success("Producto eliminado");
            fetchProducts(page);
        } catch (e) { toast.error("Error al borrar"); }
    };

    // --- ACCIONES DE STOCK Y WEB ---
    const handleForceSync = async () => {
        if (!window.confirm("⚠️ ¿Sincronizar Stock Masivamente?\n\nEsto enviará el stock actual de CADA producto del ERP hacia Tienda Nube.")) return;
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
            await axios.post(`/api/products/${product.id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
            playSound('success');
            toast.success("¡Publicado exitosamente!", { id: toastId });
            await fetchProducts(page);
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.msg || "Error al publicar", { id: toastId });
        } finally { setProcessingId(null); }
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
    const generatePdf = async (items) => {
        const res = await api.post('/products/labels/batch-pdf', { items }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Etiquetas_${Date.now()}.pdf`);
        document.body.appendChild(link); link.click(); link.remove();
    };

    const handlePrintSingleLabel = async (e, product, variant) => {
        e.stopPropagation();
        const toastId = toast.loading("Generando etiqueta...");
        try {
            await generatePdf([{ sku: variant.sku || `GEN-${variant.id_variante}`, nombre: product.nombre, talle: variant.talle, cantidad: 1 }]);
            toast.dismiss(toastId);
        } catch (error) { toast.error("Error al imprimir", { id: toastId }); }
    };

    const handlePrintLabelsSelected = async () => {
        if (selectedItems.size === 0) return toast.error("Selecciona productos");
        const t = toast.loading("Generando...");
        try {
            const items = products.filter(p => selectedItems.has(p.id)).flatMap(p => p.variantes.map(v => ({ nombre: p.nombre, sku: v.sku, talle: v.talle, cantidad: 1 })));
            if (items.length === 0) throw new Error("Sin variantes");
            await generatePdf(items);
            toast.success("PDF Listo", { id: t });
            setSelectedItems(new Set());
        } catch (e) { toast.error("Error", { id: t }); }
    };

    const handlePrintLabelsByFilter = async () => {
        if (!searchTerm && !selectedCat && !selectedSpec) if (!window.confirm("⚠️ ¿Etiquetas de TODO el stock?")) return;
        const t = toast.loading("Procesando...");
        try {
            const params = { search: searchTerm, category_id: selectedCat, specific_id: selectedSpec, active: viewMode === 'active', limit: 5000 };
            const res = await api.get('/products', { params });
            const items = (res.data.products || []).flatMap(p => p.variantes.filter(v => v.stock > 0).map(v => ({ sku: v.sku || `GEN-${v.id_variante}`, nombre: p.nombre, talle: v.talle, cantidad: v.stock })));
            if (items.length === 0) { toast.error("Stock 0", { id: t }); return; }
            if (items.length > 500 && !window.confirm(`⚠️ ${items.length} etiquetas. ¿Seguir?`)) { toast.dismiss(t); return; }
            await generatePdf(items);
            toast.success("PDF Listo", { id: t });
        } catch (e) { toast.error("Error", { id: t }); }
    };

    // Helper de Colores
    const getStockColorClass = (stock) => {
        if (stock === 0) return "bg-red-100 text-red-700 border-red-200 ring-1 ring-red-50";
        if (stock < 3) return "bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-50";
        return "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100";
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* HEADER & ACCIONES SUPERIORES */}
            <div className="flex flex-col gap-4 shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><Package size={24} /></div>
                        <div>
                            <h1 className="text-xl font-black text-gray-800">{viewMode === 'active' ? 'Control de Stock' : 'Archivo Discontinuo'}</h1>
                            {viewMode === 'active' && <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>Normal</span><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>Bajo</span><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>Agotado</span></div>}
                        </div>
                    </div>

                    {/* TABS DE MODO */}
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
                        <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Activos</button>
                        <button onClick={() => setViewMode('archived')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'archived' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}><Archive size={16} className="mr-2" /> Discontinuos</button>
                    </div>
                </div>

                {viewMode === 'active' && (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end border-t border-gray-100 pt-3">

                        <button onClick={() => setHideOutOfStock(!hideOutOfStock)} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all mr-auto ${hideOutOfStock ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-500'}`}>{hideOutOfStock ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />} {hideOutOfStock ? 'Sin Stock: Oculto' : 'Sin Stock: Visible'}</button>

                        {/* ACCIONES SELECCIÓN */}
                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg animate-fade-in mr-2">
                                <span className="text-xs font-bold text-slate-600 px-2">{selectedItems.size} sel.</span>
                                <button onClick={handlePrintLabelsSelected} className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-black transition-colors"><Printer size={14} className="mr-2" /> Imprimir</button>
                                <button onClick={handleBulkToggleStatus} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-red-200 transition-colors"><Archive size={14} className="mr-2" /> Archivar</button>
                            </div>
                        )}

                        <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>

                        {/* BOTONES GLOBALES */}
                        <button onClick={handlePrintLabelsByFilter} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg flex items-center hover:bg-indigo-100 font-bold text-xs"><Tags size={16} className="mr-2" /> Etiquetas (Filtro)</button>
                        <button onClick={() => setIsBulkModalOpen(true)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg flex items-center hover:bg-emerald-100 font-bold text-xs"><TrendingUp size={16} className="mr-2" /> Precios</button>
                        <button onClick={handleForceSync} disabled={isSyncing} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all ${isSyncing ? 'bg-gray-100 text-gray-400' : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}><RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} /> {isSyncing ? "Sync..." : "Sync Nube"}</button>
                        <button onClick={() => setShowForm(!showForm)} className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg transition-all active:scale-95 ${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-slate-900 hover:bg-black'}`}>{showForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />} {showForm ? "Cancelar" : "Nuevo"}</button>
                    </div>
                )}

                {viewMode === 'archived' && selectedItems.size > 0 && (
                    <div className="flex w-full justify-end border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg animate-fade-in">
                            <span className="text-xs font-bold text-red-600 px-2">{selectedItems.size} seleccionados</span>
                            <button onClick={handleBulkToggleStatus} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-green-200 transition-colors"><ArchiveRestore size={14} className="mr-2" /> Restaurar</button>
                        </div>
                    </div>
                )}
            </div>

            {/* FILTROS SECUNDARIOS Y FORMULARIO */}
            {!showForm && (
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-2 animate-fade-in z-10">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={viewMode === 'active' ? "Buscar producto activo..." : "Buscar en archivo..."} className={`w-full pl-10 pr-4 py-2.5 border-transparent focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none transition-all font-medium text-sm ${viewMode === 'active' ? 'bg-gray-50' : 'bg-red-50'}`} />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                    </div>
                    <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="md:w-48 bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600"><option value="">Categoría: Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                    <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)} className="md:w-48 bg-gray-50 border-transparent focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600"><option value="">Liga: Todas</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                </div>
            )}

            {/* FORMULARIO DE CREACIÓN */}
            {showForm && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 animate-fade-in-down shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center"><Plus className="mr-2 text-blue-500" /> Alta Rápida de Producto</h3>
                    <form onSubmit={handleSubmitCreate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4"><label className="text-xs font-bold text-gray-500 uppercase">Nombre</label><input autoFocus required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400" placeholder="Ej: Camiseta..." value={newProduct.nombre} onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })} /></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Categoría</label><select required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg outline-none focus:border-blue-400" value={newProduct.categoria_id} onChange={e => setNewProduct({ ...newProduct, categoria_id: e.target.value })}><option value="">Seleccionar...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Liga</label><select className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg outline-none focus:border-blue-400" value={newProduct.categoria_especifica_id} onChange={e => setNewProduct({ ...newProduct, categoria_especifica_id: e.target.value })}><option value="">(Opcional)</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                        <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Precio</label><input type="number" required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400" placeholder="$" value={newProduct.precio} onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })} /></div>
                        <div className="md:col-span-1"><label className="text-xs font-bold text-gray-500 uppercase">Curva</label><select className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg text-xs font-bold outline-none" value={selectedGridType} onChange={e => setSelectedGridType(e.target.value)}>{Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                        <div className="md:col-span-1"><label className="text-xs font-bold text-gray-500 uppercase">Stock Ini</label><input type="number" required className="w-full border-2 border-gray-100 bg-gray-50 p-2.5 rounded-lg text-center font-bold outline-none focus:border-blue-400" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} /></div>
                        <div className="md:col-span-12 mt-2"><button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md transition-all active:scale-[0.99]">GUARDAR PRODUCTO</button></div>
                    </form>
                </div>
            )}

            {/* TABLA DE INVENTARIO */}
            <div className={`bg-white rounded-2xl shadow-sm border flex-1 flex flex-col overflow-hidden relative ${viewMode === 'active' ? 'border-gray-200' : 'border-red-200'}`}>
                {viewMode === 'archived' && <div className="bg-red-50 text-red-800 text-xs font-bold p-2 text-center border-b border-red-100">VISTA DE ARCHIVO</div>}

                <div className="overflow-auto flex-1">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">{selectedItems.size === products.length && products.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
                                <th className="px-4 py-3 text-center w-16">Foto</th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3 w-32">Precio</th>
                                <th className="px-4 py-3">Variantes & Stock</th>
                                <th className="px-4 py-3 text-center w-24">Nube</th>
                                <th className="px-4 py-3 text-right w-20">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Cargando...</td></tr> :
                                products.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Sin resultados.</td></tr> :
                                    products.map(p => (
                                        <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors group ${processingId === p.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <td className="px-4 py-3 text-center"><button onClick={() => toggleSelect(p.id)} className={`transition-colors ${selectedItems.has(p.id) ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}>{selectedItems.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>

                                            <td className="px-4 py-3 text-center">
                                                <div onClick={() => p.imagen && setImageModalSrc(`/api/static/uploads/${p.imagen}`)} className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img mx-auto">
                                                    {p.imagen ? <img src={`/api/static/uploads/${p.imagen}`} className="h-full w-full object-cover" /> : <Shirt size={16} className="text-gray-300" />}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="font-bold text-gray-800">{p.nombre}</div>
                                                <div className="flex gap-2 mt-1"><span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold uppercase">{p.categoria}</span>{p.liga !== '-' && <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold uppercase">{p.liga}</span>}</div>
                                            </td>

                                            <td className="px-4 py-3 font-mono font-bold text-gray-700">$ {p.precio.toLocaleString()}</td>

                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.variantes.map(v => (
                                                        <div key={v.id_variante} onClick={() => { setSelectedVariantForBarcode({ nombre: p.nombre, talle: v.talle, sku: v.sku, precio: p.precio }); setIsBarcodeModalOpen(true); }} className={`flex items-center pl-2 pr-1 py-1 rounded-md text-xs cursor-pointer transition-all active:scale-95 shadow-sm border ${getStockColorClass(v.stock)}`} title={`SKU: ${v.sku}`}>
                                                            <span className="font-bold mr-1.5">{v.talle}</span><span className="font-mono text-[10px] opacity-80 border-l border-current pl-1.5 mr-1">{v.stock}</span>
                                                            <button onClick={(e) => handlePrintSingleLabel(e, p, v)} className="p-0.5 rounded hover:bg-black/10 transition-colors ml-0.5" title="Imprimir"><Printer size={10} /></button>
                                                        </div>
                                                    ))}
                                                    {p.variantes.length === 0 && <span className="text-xs text-red-400 italic">Sin variantes</span>}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {processingId === p.id ? <Loader2 size={18} className="animate-spin text-blue-600 mx-auto" /> : p.tiendanube_id ? <span className="inline-flex items-center justify-center p-1.5 bg-green-100 text-green-600 rounded-full" title="Sincronizado"><Cloud size={16} /></span> : <button onClick={() => handlePublish(p)} className="inline-flex items-center justify-center p-1.5 bg-gray-100 text-gray-400 rounded-full hover:bg-indigo-100 hover:text-indigo-600 transition-colors" title="Publicar"><UploadCloud size={16} /></button>}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    {viewMode === 'active' ? (
                                                        <>
                                                            <button onClick={() => handleToggleStatus(p)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg" title="Archivar"><Archive size={18} /></button>
                                                            <button onClick={() => { setEditingProduct(p); setIsEditModalOpen(true); }} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg" title="Editar"><Edit size={18} /></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleToggleStatus(p)} className="text-green-500 hover:text-green-700 p-2 hover:bg-green-50 rounded-lg" title="Restaurar"><ArchiveRestore size={18} /></button>
                                                            <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg" title="Eliminar"><Trash2 size={18} /></button>
                                                        </>
                                                    )}
                                                </div>
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
                    <div className="flex gap-2"><button onClick={() => page > 1 && fetchProducts(page - 1)} disabled={page === 1} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16} /></button><button onClick={() => page < totalPages && fetchProducts(page + 1)} disabled={page === totalPages} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16} /></button></div>
                </div>
            </div>

            {/* MODALES FLOTANTES */}
            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} product={editingProduct} categories={categories} specificCategories={specificCategories} onUpdate={() => { fetchProducts(page); playSound('success'); }} />
            <BulkPriceModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onUpdate={() => fetchProducts(page)} categories={categories} specificCategories={specificCategories} />
            {imageModalSrc && <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setImageModalSrc(null)}><img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl animate-zoom-in" onClick={e => e.stopPropagation()} /><button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button></div>}
        </div>
    );
};

export default InventoryPage;