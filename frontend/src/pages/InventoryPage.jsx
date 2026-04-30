import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    Package, Search, Edit, ChevronLeft, ChevronRight,
    Shirt, Filter, X, Cloud, UploadCloud, Loader2,
    Plus, Save, Image as ImageIcon, Printer, RefreshCw,
    AlertTriangle, CheckCircle2, ArrowUpRight,
    Archive, ArchiveRestore, Eye, EyeOff, Tags, TrendingUp, CheckSquare, Square, Trash2,
    Copy, ListFilter, ImageOff, DownloadCloud
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import BulkPriceModal from '../components/BulkPriceModal';
import { useScanDetection } from '../hooks/useScanDetection';
import { toast, Toaster } from 'react-hot-toast';

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

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState('active');
    const [hideOutOfStock, setHideOutOfStock] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');
    const [sortBy, setSortBy] = useState('mas_vendidos');

    const [filterExactStock, setFilterExactStock] = useState('');
    const [filterSize, setFilterSize] = useState('');
    const [filterNoImage, setFilterNoImage] = useState(false);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    const [showForm, setShowForm] = useState(false);

    // --- ESTADO ACTUALIZADO CON TIPO DE ARTÍCULO ---
    const [newProduct, setNewProduct] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: '', descripcion: '', estampa: '', tipo_articulo: 'estandar'
    });

    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [selectedFile, setSelectedFile] = useState(null);

    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [imageModalSrc, setImageModalSrc] = useState(null);

    const [isSelectedPriceModalOpen, setIsSelectedPriceModalOpen] = useState(false);
    const [selectedPriceType, setSelectedPriceType] = useState('percent_increase');
    const [selectedPriceValue, setSelectedPriceValue] = useState('');

    const searchInputRef = useRef(null);
    useScanDetection(searchInputRef);

    const playSound = (type) => {
        try {
            if (SOUNDS[type]) {
                SOUNDS[type].currentTime = 0;
                SOUNDS[type].volume = 0.5;
                SOUNDS[type].play();
            }
        } catch (e) { console.error(e); }
    };

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

    const fetchProducts = async (currentPage = page, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const isSearching = searchTerm.trim() !== '';
            const limit = isSearching ? 200 : 50;
            const targetPage = isSearching ? 1 : currentPage;

            const params = {
                page: targetPage, limit: limit, search: searchTerm,
                category_id: selectedCat || undefined, specific_id: selectedSpec || undefined,
                active: viewMode === 'active' ? 'true' : 'false',
                min_stock: hideOutOfStock ? 1 : undefined,
                exact_stock: filterExactStock !== '' ? filterExactStock : undefined,
                size_filter: filterSize || undefined,
                no_image: filterNoImage ? 'true' : undefined, sort_by: sortBy
            };

            const res = await api.get('/products', { params });
            setProducts(res.data.products);

            if (res.data.meta) {
                setTotalPages(res.data.meta.total_pages);
                setPage(res.data.meta.current_page);
            }
            if (!silent) setSelectedItems(new Set());
        } catch (error) {
            toast.error("Error cargando inventario");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        const delayFn = setTimeout(() => { fetchProducts(1); }, 400);
        return () => clearTimeout(delayFn);
    }, [searchTerm, selectedCat, selectedSpec, viewMode, hideOutOfStock, filterExactStock, filterSize, filterNoImage, sortBy]);

    useEffect(() => {
        const checkActiveSync = async () => {
            try {
                const res = await api.get('/products/sync/status');
                if (res.data && res.data.is_running) {
                    setIsSyncing(true);
                    setSyncProgress(res.data);
                }
            } catch (e) { }
        };
        if (token) checkActiveSync();
    }, [token]);

    useEffect(() => {
        let interval;
        if (isSyncing) {
            interval = setInterval(async () => {
                try {
                    const res = await api.get('/products/sync/status');
                    if (res.data && res.data.is_running) {
                        setSyncProgress(res.data);
                    } else {
                        setIsSyncing(false);
                        setSyncProgress(res.data);
                        playSound('success');
                        toast.success("Sincronización Completada");
                        setTimeout(() => setSyncProgress(null), 8000);
                        clearInterval(interval);
                    }
                } catch (e) {
                    setIsSyncing(false);
                    clearInterval(interval);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isSyncing]);

    const handleForceSync = async () => {
        if (!window.confirm("⚠️ ¿Sincronizar Stock Masivamente?\nEl proceso se ejecutará en segundo plano y podrás seguir usando el sistema.")) return;

        setIsSyncing(true);
        setSyncProgress({ is_running: true, current: 0, total: 1, message: "Iniciando proceso en el servidor..." });

        try {
            await api.post('/products/sync/force-tiendanube');
            toast.success("Sincronización Iniciada");
        } catch (error) {
            toast.error("Error al iniciar sync");
            setIsSyncing(false);
            setSyncProgress(null);
        }
    };

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
            const promises = Array.from(selectedItems).map(id => api.put(`/products/${id}/toggle-status`, { active: viewMode !== 'active' }));
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

    const handleUpdateSelectedPrices = async (e) => {
        e.preventDefault();
        if (!selectedPriceValue) return;

        const toastId = toast.loading("Actualizando precios de seleccionados...");
        try {
            await api.put('/products/bulk-price-selected', {
                ids: Array.from(selectedItems),
                type: selectedPriceType,
                value: parseFloat(selectedPriceValue)
            });

            toast.success("Precios actualizados correctamente", { id: toastId });
            playSound('success');
            setIsSelectedPriceModalOpen(false);
            setSelectedPriceValue('');
            setSelectedItems(new Set());
            fetchProducts(page);
        } catch (error) {
            toast.error("Error al actualizar precios", { id: toastId });
        }
    };

    const handlePublish = async (product) => {
        if (!window.confirm(`¿Publicar "${product.nombre}" en Tienda Nube?`)) return;
        setProcessingId(product.id);
        const toastId = toast.loading("Publicando...");
        try {
            await axios.post(`/api/products/${product.id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
            playSound('success');
            toast.success("¡Publicado!", { id: toastId });
            await fetchProducts(page);
        } catch (error) { playSound('error'); toast.error("Error al publicar", { id: toastId }); } finally { setProcessingId(null); }
    };

    const handleImportImage = async (product) => {
        if (!product.tiendanube_id) return toast.error("El producto no está vinculado a Tienda Nube");
        const toastId = toast.loading("Descargando foto desde Tienda Nube...");
        try {
            await api.post(`/products/${product.id}/import-image-from-cloud`);
            playSound('success');
            toast.success("Imagen importada correctamente", { id: toastId });
            fetchProducts(page);
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.msg || "Error al descargar foto", { id: toastId });
        }
    };

    const handleDuplicate = (product) => {
        setNewProduct({
            nombre: product.nombre + ' (Copia)',
            precio: product.precio,
            stock: 0,
            sku: '',
            categoria_id: product.categoria_id,
            categoria_especifica_id: product.categoria_especifica_id,
            descripcion: product.descripcion,
            estampa: '',
            tipo_articulo: 'estandar'
        });

        const currentSizes = product.variantes.map(v => v.talle).sort().join(',');
        const foundGrid = Object.keys(SIZE_GRIDS).find(key => SIZE_GRIDS[key].slice().sort().join(',') === currentSizes);
        if (foundGrid) { setSelectedGridType(foundGrid); } else { setSelectedGridType('ADULTO'); }

        setShowForm(true);
        setTimeout(() => {
            const formElement = document.getElementById('formCreate');
            if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
            const inputName = document.getElementById('inputName');
            if (inputName) { inputName.focus(); inputName.select(); }
        }, 100);

        toast("Producto duplicado. Revisa los datos.", { icon: '📝' });
    };

    const handleSubmitCreate = async (e) => {
        e.preventDefault();
        if (!newProduct.categoria_id) return toast.error("Falta categoría");
        const toastId = toast.loading("Creando...");
        try {
            const fd = new FormData();
            fd.append('nombre', newProduct.nombre);
            fd.append('precio', newProduct.precio);
            fd.append('stock', newProduct.stock);
            fd.append('categoria_id', newProduct.categoria_id);
            if (newProduct.categoria_especifica_id) fd.append('categoria_especifica_id', newProduct.categoria_especifica_id);
            fd.append('descripcion', newProduct.descripcion);

            // --- LÓGICA INTELIGENTE BASADA EN EL TIPO DE ARTÍCULO ---
            let finalTalle = SIZE_GRIDS[selectedGridType].join(',');
            let finalEstampa = newProduct.estampa || '';

            if (newProduct.tipo_articulo === 'simple') {
                finalTalle = 'U';
                finalEstampa = '';
            } else if (newProduct.tipo_articulo === 'estandar') {
                finalEstampa = '';
            }

            fd.append('talle', finalTalle);
            if (finalEstampa.trim() !== '') {
                fd.append('estampa', finalEstampa);
            }

            if (selectedFile) fd.append('imagen', selectedFile);

            await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success("Producto Creado", { id: toastId });
            playSound('success');
            setShowForm(false);
            setNewProduct({ nombre: '', precio: '', stock: '10', sku: '', categoria_id: '', categoria_especifica_id: '', descripcion: '', estampa: '', tipo_articulo: 'estandar' });
            setSelectedFile(null);
            fetchProducts(1);
        } catch (e) { toast.error("Error creando", { id: toastId }); playSound('error'); }
    };

    const generatePdf = async (items) => {
        const res = await api.post('/products/labels/batch-pdf', { items }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Etiquetas_${Date.now()}.pdf`);
        document.body.appendChild(link); link.click(); link.remove();
    };

    const handlePrintSingleLabel = async (e, product, variant) => {
        e.stopPropagation();
        const toastId = toast.loading("Generando...");
        const talleLabel = variant.talle + (variant.estampa && variant.estampa !== 'Standard' ? ` - ${variant.estampa}` : '');
        try {
            await generatePdf([{ sku: variant.sku || `GEN-${variant.id_variante}`, nombre: product.nombre, talle: talleLabel, cantidad: 1 }]);
            toast.dismiss(toastId);
        } catch (error) { toast.error("Error", { id: toastId }); }
    };

    const handlePrintLabelsSelected = async () => {
        if (selectedItems.size === 0) return toast.error("Selecciona productos");
        const t = toast.loading("Generando...");
        try {
            const items = products
                .filter(p => selectedItems.has(p.id))
                .flatMap(p => p.variantes
                    .filter(v => v.stock > 0)
                    .map(v => ({
                        nombre: p.nombre,
                        sku: v.sku || `GEN-${v.id_variante}`,
                        talle: v.talle + (v.estampa && v.estampa !== 'Standard' ? ` - ${v.estampa}` : ''),
                        cantidad: v.stock
                    }))
                );

            if (items.length === 0) { toast.error("Stock cero", { id: t }); return; }
            const totalLabels = items.reduce((sum, item) => sum + item.cantidad, 0);
            if (totalLabels > 500 && !window.confirm(`⚠️ ${totalLabels} etiquetas en total. ¿Continuar?`)) { toast.dismiss(t); return; }

            await generatePdf(items);
            toast.success("PDF Listo", { id: t });
            setSelectedItems(new Set());
        } catch (e) { toast.error("Error al generar etiquetas", { id: t }); }
    };

    const handlePrintLabelsByFilter = async () => {
        if (!searchTerm && !selectedCat && !selectedSpec) if (!window.confirm("⚠️ ¿Etiquetas de TODO el stock?")) return;
        const t = toast.loading("Procesando...");
        try {
            const params = { search: searchTerm, category_id: selectedCat, specific_id: selectedSpec, active: viewMode === 'active', limit: 5000 };
            const res = await api.get('/products', { params });
            const items = (res.data.products || []).flatMap(p => p.variantes.filter(v => v.stock > 0).map(v => ({
                sku: v.sku || `GEN-${v.id_variante}`,
                nombre: p.nombre,
                talle: v.talle + (v.estampa && v.estampa !== 'Standard' ? ` - ${v.estampa}` : ''),
                cantidad: v.stock
            })));
            if (items.length === 0) { toast.error("Stock 0", { id: t }); return; }
            if (items.length > 500 && !window.confirm(`⚠️ ${items.length} etiquetas. ¿Seguir?`)) { toast.dismiss(t); return; }
            await generatePdf(items);
            toast.success("PDF Listo", { id: t });
        } catch (e) { toast.error("Error", { id: t }); }
    };

    const getStockColorClass = (stock) => {
        if (stock === 0) return "bg-red-100 text-red-700 border-red-200 ring-1 ring-red-50 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 dark:ring-red-900/20";
        if (stock < 3) return "bg-amber-100 text-amber-800 border-amber-200 ring-1 ring-amber-50 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 dark:ring-amber-900/20";
        return "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/50";
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4 bg-gray-100 dark:bg-slate-950 transition-colors duration-300 relative">
            <Toaster position="top-center" />

            {/* HEADER ACCIONES */}
            <div className="flex flex-col gap-4 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400"><Package size={24} /></div>
                        <div>
                            <h1 className="text-xl font-black text-gray-800 dark:text-white">{viewMode === 'active' ? 'Control de Stock' : 'Archivo Discontinuo'}</h1>
                            {viewMode === 'active' && <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400"><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></div>Normal</span><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>Bajo</span><span className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>Agotado</span></div>}
                        </div>
                    </div>
                    <div className="flex bg-gray-100 dark:bg-slate-700 p-1 rounded-xl shadow-inner">
                        <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}>Activos</button>
                        <button onClick={() => setViewMode('archived')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'archived' ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'}`}><Archive size={16} className="mr-2" /> Discontinuos</button>
                    </div>
                </div>

                {viewMode === 'active' && (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end border-t border-gray-100 dark:border-slate-700 pt-3">
                        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all mr-auto ${showAdvancedFilters ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-300'}`}>
                            <ListFilter size={16} className="mr-2" /> {showAdvancedFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}
                        </button>

                        <button onClick={() => setHideOutOfStock(!hideOutOfStock)} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all ${hideOutOfStock ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-300'}`}>{hideOutOfStock ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />} {hideOutOfStock ? 'Sin Stock: Oculto' : 'Sin Stock: Visible'}</button>

                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg animate-fade-in mr-2">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 px-2">{selectedItems.size} sel.</span>
                                <button onClick={() => setIsSelectedPriceModalOpen(true)} className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-emerald-200 transition-colors"><TrendingUp size={14} className="mr-2" /> Precios</button>
                                <button onClick={handlePrintLabelsSelected} className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-black transition-colors"><Printer size={14} className="mr-2" /> Imprimir</button>
                                <button onClick={handleBulkToggleStatus} className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-red-200 transition-colors"><Archive size={14} className="mr-2" /> Archivar</button>
                            </div>
                        )}

                        <div className="h-8 w-px bg-gray-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
                        <button onClick={handlePrintLabelsByFilter} className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-2 rounded-lg flex items-center hover:bg-indigo-100 font-bold text-xs"><Tags size={16} className="mr-2" /> Etiquetas (Filtro)</button>
                        <button onClick={() => setIsBulkModalOpen(true)} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-lg flex items-center hover:bg-emerald-100 font-bold text-xs"><TrendingUp size={16} className="mr-2" /> Aumentos Grales</button>

                        <button onClick={handleForceSync} disabled={isSyncing} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all ${isSyncing ? 'bg-gray-100 dark:bg-slate-800 text-gray-400' : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}>
                            <RefreshCw size={14} className={`mr-2 ${isSyncing ? "animate-spin" : ""}`} /> {isSyncing ? "Sincronizando..." : "Sync Nube"}
                        </button>

                        <button onClick={() => setShowForm(!showForm)} className={`flex items-center px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg transition-all active:scale-95 ${showForm ? 'bg-gray-500 hover:bg-gray-600' : 'bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-700'}`}>{showForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />} {showForm ? "Cancelar" : "Nuevo"}</button>
                    </div>
                )}
            </div>

            {!showForm && (
                <div className="flex flex-col gap-3 z-10">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col md:flex-row gap-2 animate-fade-in transition-colors">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                ref={searchInputRef}
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder={viewMode === 'active' ? "Buscar producto activo..." : "Buscar en archivo..."}
                                className={`w-full pl-10 pr-4 py-2.5 border-transparent focus:border-blue-200 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 rounded-lg outline-none transition-all font-medium text-sm ${viewMode === 'active' ? 'bg-gray-50 dark:bg-slate-700 dark:text-white' : 'bg-red-50 dark:bg-red-900/20 dark:text-red-200'}`}
                            />
                            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                        </div>

                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="md:w-48 bg-gray-50 dark:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-600 focus:border-blue-200 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600 dark:text-slate-200 cursor-pointer">
                            <option value="recientes">Más Recientes</option>
                            <option value="mas_vendidos">Más Vendidos</option>
                            <option value="mayor_stock">Mayor Stock</option>
                            <option value="menor_stock">Menor Stock</option>
                        </select>

                        <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)} className="md:w-56 bg-gray-50 dark:bg-slate-700 border-transparent focus:bg-white dark:focus:bg-slate-600 focus:border-blue-200 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-50 dark:focus:ring-blue-900/30 rounded-lg outline-none px-3 py-2 text-sm font-bold text-gray-600 dark:text-slate-200 cursor-pointer">
                            <option value="">Ligas / Tipos: Todas</option>
                            {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar px-1">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mr-1 shrink-0">Categorías:</span>
                        <button onClick={() => setSelectedCat('')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${selectedCat === '' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Todas</button>
                        {categories.map(c => (
                            <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${selectedCat == c.id ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                                {c.nombre}
                            </button>
                        ))}
                    </div>

                    {showAdvancedFilters && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex flex-wrap gap-4 items-center animate-fade-in-down transition-colors">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Stock Exacto:</label>
                                <input type="number" min="0" placeholder="Ej: 0" className="w-20 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-800 dark:text-white" value={filterExactStock} onChange={e => setFilterExactStock(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase">Talle:</label>
                                <input type="text" placeholder="Ej: S, 40..." className="w-24 p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-indigo-300 bg-white dark:bg-slate-800 dark:text-white uppercase" value={filterSize} onChange={e => setFilterSize(e.target.value)} />
                            </div>
                            <button
                                onClick={() => setFilterNoImage(!filterNoImage)}
                                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filterNoImage ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                            >
                                <ImageOff size={14} className="mr-2" /> {filterNoImage ? 'Viendo Sin Imagen' : 'Filtrar Sin Imagen'}
                            </button>
                            {(filterExactStock || filterSize || filterNoImage) && (
                                <button onClick={() => { setFilterExactStock(''); setFilterSize(''); setFilterNoImage(false); }} className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline font-bold">Limpiar Avanzados</button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div id="formCreate" className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-blue-100 dark:border-slate-700 animate-fade-in-down shrink-0 relative overflow-hidden transition-colors">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                    <h3 className="font-bold text-lg mb-4 text-gray-800 dark:text-white flex items-center"><Plus className="mr-2 text-blue-500" /> Alta Rápida de Producto</h3>

                    <form onSubmit={handleSubmitCreate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        {/* --- FILA 1 --- */}
                        <div className="md:col-span-3">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Nombre</label>
                            <input id="inputName" autoFocus required className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white" placeholder="Ej: Camiseta..." value={newProduct.nombre} onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })} />
                        </div>

                        {/* NUEVO: TIPO DE ARTÍCULO */}
                        <div className="md:col-span-3">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Tipo de Artículo</label>
                            <select className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white" value={newProduct.tipo_articulo || 'estandar'} onChange={e => setNewProduct({ ...newProduct, tipo_articulo: e.target.value })}>
                                <option value="simple">📦 Simple (Llaveros, etc)</option>
                                <option value="estandar">👕 Estándar (Buzos, Shorts)</option>
                                <option value="personalizable">⭐ Personalizable (Camisetas)</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Categoría</label>
                            <select required className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white" value={newProduct.categoria_id} onChange={e => setNewProduct({ ...newProduct, categoria_id: e.target.value })}><option value="">Seleccionar...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Liga</label>
                            <select className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white" value={newProduct.categoria_especifica_id} onChange={e => setNewProduct({ ...newProduct, categoria_especifica_id: e.target.value })}><option value="">(Opcional)</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Plantilla TN</label>
                            <select className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white text-xs font-bold" value={newProduct.descripcion} onChange={e => setNewProduct({ ...newProduct, descripcion: e.target.value })}>
                                <option value="">(Genérica)</option>
                                <option value="Camisetas Nacionales">Camisetas Nacionales</option>
                                <option value="Camisetas Retro">Camisetas Retro</option>
                                <option value="Camisetas G5 Importadas">Camisetas G5 Importadas</option>
                                <option value="Conjuntos">Conjuntos</option>
                                <option value="Buzos">Buzos</option>
                                <option value="Camperas">Camperas</option>
                                <option value="Pantalones Largos">Pantalones Largos</option>
                                <option value="Shorts">Shorts</option>
                            </select>
                        </div>

                        {/* --- FILA 2 --- */}
                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Precio</label>
                            <input type="number" required className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white px-2" placeholder="$" value={newProduct.precio} onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })} />
                        </div>

                        {/* VISIBILIDAD CONDICIONAL: CURVA DE TALLES */}
                        {newProduct.tipo_articulo !== 'simple' && (
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Curva</label>
                                <select className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg text-xs font-bold outline-none dark:text-white px-1" value={selectedGridType} onChange={e => setSelectedGridType(e.target.value)}>{Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}</select>
                            </div>
                        )}

                        {/* VISIBILIDAD CONDICIONAL: ESTAMPA */}
                        {newProduct.tipo_articulo === 'personalizable' && (
                            <div className="md:col-span-3">
                                <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Estampa (Jugador)</label>
                                <input className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg font-bold outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white px-2" placeholder="Ej: Messi 10..." value={newProduct.estampa || ''} onChange={e => setNewProduct({ ...newProduct, estampa: e.target.value })} />
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">Stock {newProduct.tipo_articulo !== 'simple' ? 'x Talle' : 'Total'}</label>
                            <input type="number" required className="w-full border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2.5 rounded-lg text-center font-bold outline-none focus:border-blue-400 dark:focus:border-blue-600 dark:text-white px-1" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
                        </div>

                        {/* ESPACIO DINÁMICO DEL BOTÓN */}
                        <div className={`mt-2 ${newProduct.tipo_articulo === 'simple' ? 'md:col-span-8' : (newProduct.tipo_articulo === 'estandar' ? 'md:col-span-6' : 'md:col-span-3')}`}>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-md transition-all active:scale-[0.99]">GUARDAR PRODUCTO</button>
                        </div>
                    </form>
                </div>
            )}

            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border flex-1 flex flex-col overflow-hidden relative transition-colors ${viewMode === 'active' ? 'border-gray-200 dark:border-slate-700' : 'border-red-200 dark:border-red-900'}`}>
                {viewMode === 'archived' && <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-xs font-bold p-2 text-center border-b border-red-100 dark:border-red-900/50">VISTA DE ARCHIVO</div>}

                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 transition-colors">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">{selectedItems.size === products.length && products.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
                                <th className="px-4 py-3 text-center w-16">Foto</th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3 w-32">Precio</th>
                                <th className="px-4 py-3">Variantes & Stock</th>
                                <th className="px-4 py-3 text-center w-24">Nube</th>
                                <th className="px-4 py-3 text-right w-20">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Cargando...</td></tr> : products.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-gray-400 italic">Sin resultados.</td></tr> : products.map(p => (
                                <tr key={p.id} className={`hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group ${processingId === p.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <td className="px-4 py-3 text-center"><button onClick={() => toggleSelect(p.id)} className={`transition-colors ${selectedItems.has(p.id) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400'}`}>{selectedItems.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                                    <td className="px-4 py-3 text-center"><div onClick={() => p.imagen && setImageModalSrc(`/api/static/uploads/${p.imagen}`)} className="h-10 w-10 rounded-lg bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img mx-auto">{p.imagen ? <img src={`/api/static/uploads/${p.imagen}`} className="h-full w-full object-cover" /> : <Shirt size={16} className="text-gray-300 dark:text-slate-500" />}</div></td>
                                    <td className="px-4 py-3"><div className="font-bold text-gray-800 dark:text-white">{p.nombre}</div><div className="flex gap-2 mt-1"><span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded font-bold uppercase">{p.categoria}</span>{p.liga !== '-' && <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded font-bold uppercase">{p.liga}</span>}</div></td>
                                    <td className="px-4 py-3 font-mono font-bold text-gray-700 dark:text-slate-300">$ {p.precio.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {p.variantes.map(v => (
                                                <div key={v.id_variante} onClick={() => { setSelectedVariantForBarcode({ nombre: p.nombre, talle: v.talle, sku: v.sku, precio: p.precio }); setIsBarcodeModalOpen(true); }} className={`flex items-center pl-2 pr-1 py-1 rounded-md text-xs cursor-pointer transition-all active:scale-95 shadow-sm border ${getStockColorClass(v.stock)}`} title={`SKU: ${v.sku}`}>
                                                    <span className="font-bold mr-1.5 flex items-center">
                                                        {v.talle}
                                                        {v.estampa && v.estampa !== 'Standard' && (
                                                            <span className="ml-1.5 text-[9px] bg-white/60 text-indigo-800 dark:bg-black/30 dark:text-indigo-200 px-1 rounded shadow-sm border border-current opacity-90 uppercase truncate max-w-[80px]">
                                                                {v.estampa}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-mono text-[10px] opacity-80 border-l border-current pl-1.5 mr-1">{v.stock}</span>
                                                    <button onClick={(e) => handlePrintSingleLabel(e, p, v)} className="p-0.5 rounded hover:bg-black/10 transition-colors ml-0.5" title="Imprimir"><Printer size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">{processingId === p.id ? <Loader2 size={18} className="animate-spin text-blue-600 mx-auto" /> : p.tiendanube_id ? <span className="inline-flex items-center justify-center p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full" title="Sincronizado"><Cloud size={16} /></span> : <button onClick={() => handlePublish(p)} className="inline-flex items-center justify-center p-1.5 bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Publicar"><UploadCloud size={16} /></button>}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            {viewMode === 'active' ? (
                                                <>
                                                    {p.tiendanube_id && (
                                                        <button onClick={() => handleImportImage(p)} className="text-sky-500 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 p-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg" title="Importar Imagen de Tienda Nube"><DownloadCloud size={18} /></button>
                                                    )}
                                                    <button onClick={() => handleDuplicate(p)} className="text-gray-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg" title="Duplicar"><Copy size={18} /></button>
                                                    <button onClick={() => handleToggleStatus(p)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Archivar"><Archive size={18} /></button>
                                                    <button onClick={() => { setEditingProduct(p); setIsEditModalOpen(true); }} className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Editar"><Edit size={18} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleToggleStatus(p)} className="text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 p-2 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg" title="Restaurar"><ArchiveRestore size={18} /></button>
                                                    <button onClick={() => handleDelete(p.id)} className="text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg" title="Eliminar"><Trash2 size={18} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white dark:bg-slate-800 p-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between shrink-0 transition-colors">
                    {searchTerm.trim() !== '' ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Mostrando <span className="text-gray-800 dark:text-white font-bold">{products.length}</span> resultados de la búsqueda
                        </span>
                    ) : (
                        <>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                Pág <span className="text-gray-800 dark:text-white font-bold">{page}</span> de {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={() => page > 1 && fetchProducts(page - 1)} disabled={page === 1} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"><ChevronLeft size={16} /></button>
                                <button onClick={() => page < totalPages && fetchProducts(page + 1)} disabled={page === totalPages} className="p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"><ChevronRight size={16} /></button>
                            </div>
                        </>
                    )}
                    {loading && <Loader2 className="animate-spin text-blue-500 absolute left-1/2" size={16} />}
                </div>
            </div>

            {syncProgress && (
                <div className="fixed bottom-6 right-6 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-2xl border border-blue-100 dark:border-slate-700 z-[100] w-80 animate-fade-in-up transition-colors">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center">
                            {syncProgress.is_running ? <RefreshCw size={16} className="mr-2 animate-spin text-blue-500" /> : <Cloud size={16} className="mr-2 text-green-500" />}
                            Sincronización Nube
                        </h4>
                        {!syncProgress.is_running && <button onClick={() => setSyncProgress(null)}><X size={16} className="text-gray-400 hover:text-red-500" /></button>}
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
                        <div className={`h-3 rounded-full transition-all duration-500 ${syncProgress.is_running ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, (syncProgress.current / syncProgress.total) * 100 || 0)}%` }}></div>
                    </div>

                    <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                        <span>{syncProgress.current} / {syncProgress.total} items</span>
                        <span>{Math.round((syncProgress.current / syncProgress.total) * 100 || 0)}%</span>
                    </div>

                    <p className="text-[10px] text-slate-400 truncate font-medium mt-2" title={syncProgress.message}>{syncProgress.message}</p>
                </div>
            )}

            {isSelectedPriceModalOpen && (
                <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsSelectedPriceModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-xl mb-4 text-gray-800 dark:text-white flex items-center">
                            <TrendingUp className="mr-2 text-emerald-500" /> Precios ({selectedItems.size} ítems)
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 leading-tight">Aplica una actualización rápida de precio a los {selectedItems.size} productos que seleccionaste.</p>

                        <form onSubmit={handleUpdateSelectedPrices}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2">Tipo de Actualización</label>
                                <select
                                    value={selectedPriceType}
                                    onChange={e => setSelectedPriceType(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 rounded-xl font-bold outline-none focus:border-emerald-500 dark:text-white"
                                >
                                    <option value="percent_increase">Aumento por Porcentaje (%)</option>
                                    <option value="percent_decrease">Descuento por Porcentaje (%)</option>
                                    <option value="fixed">Establecer Precio Fijo ($)</option>
                                </select>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2">Valor ({selectedPriceType === 'fixed' ? '$' : '%'})</label>
                                <input
                                    type="number" required min="0" step="0.01" autoFocus
                                    placeholder={selectedPriceType === 'fixed' ? 'Ej: 15000' : 'Ej: 10'}
                                    value={selectedPriceValue} onChange={e => setSelectedPriceValue(e.target.value)}
                                    className="w-full p-3 border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 rounded-xl font-black text-xl outline-none focus:border-emerald-500 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsSelectedPriceModalOpen(false)} className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-bold bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-transform active:scale-95">Aplicar a {selectedItems.size}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} product={editingProduct} categories={categories} specificCategories={specificCategories} onUpdate={() => { fetchProducts(page, true); playSound('success'); }} />
            <BulkPriceModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onUpdate={() => fetchProducts(page)} categories={categories} specificCategories={specificCategories} />
            {imageModalSrc && <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in" onClick={() => setImageModalSrc(null)}><img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl animate-zoom-in" onClick={e => e.stopPropagation()} /><button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button></div>}
        </div>
    );
};

export default InventoryPage;