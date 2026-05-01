import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import {
    Package, Search, Edit, ChevronLeft, ChevronRight,
    Shirt, Filter, X, Cloud, UploadCloud, Loader2,
    Plus, Save, Image as ImageIcon, Printer, RefreshCw,
    AlertTriangle, CheckCircle2, ArrowUpRight,
    Archive, ArchiveRestore, Eye, EyeOff, Tags, TrendingUp,
    CheckSquare, Square, Trash2, Copy, ListFilter, ImageOff,
    DownloadCloud, Sparkles, Box, ChevronDown
} from 'lucide-react';
import ModalBarcode from '../components/ModalBarcode';
import EditProductModal from '../components/EditProductModal';
import BulkPriceModal from '../components/BulkPriceModal';
import TNPriceModal from '../components/TNPriceModal';
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

// =========================================================================
// SUB-COMPONENTE 1: Agrupador de Variantes
// =========================================================================
const VariantStockGroup = ({ variants, onOpenDetails }) => {
    const groupedVariants = variants.reduce((acc, v) => {
        if (!acc[v.talle]) {
            acc[v.talle] = { talle: v.talle, totalStock: 0, detalles: [] };
        }
        acc[v.talle].totalStock += v.stock;

        const estampaName = (!v.estampa || v.estampa === 'Standard') ? 'Sin Estampa' : v.estampa;
        acc[v.talle].detalles.push({ ...v, estampaName });
        return acc;
    }, {});

    const getStockColorClass = (stock) => {
        if (stock === 0) return "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50";
        if (stock < 3) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50";
        return "bg-emerald-50/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50";
    };

    return (
        <div className="flex flex-wrap gap-1.5 items-center w-full min-w-[280px] py-1">
            {Object.values(groupedVariants).map((grupo) => {
                const hasEstampas = grupo.detalles.some(d => d.estampaName !== 'Sin Estampa');
                return (
                    <div
                        key={grupo.talle}
                        onClick={() => onOpenDetails(grupo)}
                        className={`flex items-center pl-2 pr-1 py-1 rounded-md text-[11px] cursor-pointer shadow-sm border shrink-0 ${getStockColorClass(grupo.totalStock)} transition-all hover:shadow-md active:scale-95`}
                        title="Clic para ver detalle de estampas"
                    >
                        <span className="font-bold mr-1.5 flex items-center">
                            {grupo.talle}
                            {hasEstampas && <Sparkles size={10} className="ml-1 text-indigo-400" />}
                        </span>
                        <span className="font-mono text-[9px] font-black opacity-80 border-l border-current pl-1.5 pr-1 flex items-center h-full">
                            {grupo.totalStock}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

// =========================================================================
// SUB-COMPONENTE 2: El Nuevo Modal de Detalles
// =========================================================================
const VariantDetailsModal = ({ isOpen, onClose, grupo, onPrintVariant, onOpenBarcode }) => {
    if (!isOpen || !grupo) return null;

    const detallesOrdenados = [...grupo.detalles].sort((a, b) =>
        a.estampaName === 'Sin Estampa' ? -1 : b.estampaName === 'Sin Estampa' ? 1 : 0
    );

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-2xl text-slate-800 dark:text-white flex items-center">
                            Talle {grupo.talle}
                            <span className="ml-3 text-xs font-bold text-indigo-700 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300 px-3 py-1 rounded-lg">Total: {grupo.totalStock}</span>
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium truncate max-w-[250px]">{grupo.productName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full shadow-sm border border-slate-200 dark:border-slate-600 transition-all active:scale-95">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-4 px-2 tracking-widest">
                        <span>Estampa / Jugador</span>
                        <span>Stock Disponible</span>
                    </div>
                    <div className="space-y-2.5">
                        {detallesOrdenados.map(det => (
                            <div key={det.id_variante} className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all shadow-sm hover:shadow-md group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${det.stock > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{det.estampaName}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-mono font-black text-sm px-3 py-1 rounded-xl shadow-inner ${det.stock > 0 ? 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
                                        {det.stock}
                                    </span>
                                    <div className="flex gap-1.5 border-l border-slate-100 dark:border-slate-700 pl-4">
                                        <button onClick={() => onPrintVariant(det)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all" title="Imprimir Etiqueta">
                                            <Printer size={16} />
                                        </button>
                                        <button onClick={() => onOpenBarcode(det)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-xl transition-all" title="Ver Código de Barras">
                                            <Search size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// =========================================================================
// PÁGINA PRINCIPAL
// =========================================================================
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

    // ESTADOS DE PROGRESO DE BACKGROUND
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);
    const [marginProgress, setMarginProgress] = useState(null); 

    const [processingId, setProcessingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [newProduct, setNewProduct] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: '', descripcion: '', estampa: '', tipo_articulo: 'estandar'
    });

    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [selectedFile, setSelectedFile] = useState(null);

    // Estados de Modales
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [selectedVariantForBarcode, setSelectedVariantForBarcode] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isTNModalOpen, setIsTNModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [imageModalSrc, setImageModalSrc] = useState(null);
    const [isSelectedPriceModalOpen, setIsSelectedPriceModalOpen] = useState(false);
    const [selectedPriceType, setSelectedPriceType] = useState('percent_increase');
    const [selectedPriceValue, setSelectedPriceValue] = useState('');

    const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
    const [selectedVariantGroup, setSelectedVariantGroup] = useState(null);

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

    // EFECTO POLLING MEJORADO PARA SYNC DE STOCK
    useEffect(() => {
        const checkActiveSync = async () => {
            try {
                const res = await api.get('/products/sync/status');
                setSyncProgress(prev => {
                    if (prev && prev.is_running && !res.data.is_running) {
                        playSound('success');
                        toast.success("Sincronización Completada", { duration: 4000 });
                        setTimeout(() => setSyncProgress(null), 8000);
                        return res.data;
                    }
                    if (res.data.is_running || (prev && prev.is_running)) {
                        setIsSyncing(true);
                        return res.data;
                    }
                    setIsSyncing(false);
                    return null;
                });
            } catch (e) { }
        };
        
        checkActiveSync(); 
        const interval = setInterval(checkActiveSync, 3000);
        return () => clearInterval(interval);
    }, [token]);

    // EFECTO POLLING MEJORADO PARA MÁRGENES/PRECIOS
    useEffect(() => {
        const checkMarginStatus = async () => {
            try {
                const res = await api.get('/products/tiendanube/margen/status');
                setMarginProgress(prev => {
                    if (prev && prev.is_running && !res.data.is_running) {
                        playSound('success');
                        toast.success("¡Todos los precios fueron actualizados en Tienda Nube!", { duration: 6000 });
                        setTimeout(() => setMarginProgress(null), 6000);
                        return res.data;
                    }
                    if (res.data.is_running || (prev && prev.is_running)) {
                        return res.data;
                    }
                    return null;
                });
            } catch (e) { }
        };

        checkMarginStatus(); 
        const interval = setInterval(checkMarginStatus, 4000);
        return () => clearInterval(interval);
    }, [token]);

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

        const toastId = toast.loading("Actualizando precios...");
        try {
            await api.put('/products/bulk-price-selected', {
                ids: Array.from(selectedItems),
                type: selectedPriceType,
                value: parseFloat(selectedPriceValue)
            });

            toast.success("Precios actualizados", { id: toastId });
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
        if (!product.tiendanube_id) return toast.error("El producto no está vinculado");
        const toastId = toast.loading("Descargando foto...");
        try {
            await api.post(`/products/${product.id}/import-image-from-cloud`);
            playSound('success');
            toast.success("Imagen importada", { id: toastId });
            fetchProducts(page);
        } catch (error) {
            playSound('error');
            toast.error(error.response?.data?.msg || "Error al descargar foto", { id: toastId });
        }
    };

    const handleDuplicate = (product) => {
        let inferredTipo = 'estandar';
        if (product.variantes && product.variantes.length > 0) {
            const hasTalle = product.variantes.some(v => v.talle && !['U', 'UNICO', 'ÚNICO'].includes(v.talle.toUpperCase()));
            const hasEstampa = product.variantes.some(v => v.estampa && v.estampa !== 'Standard' && v.estampa !== 'Sin Estampa');
            const isCamiseta = (product.nombre || '').toUpperCase().includes('CAMISETA');

            if (isCamiseta || hasEstampa) inferredTipo = 'personalizable';
            else if (!hasTalle && !hasEstampa) inferredTipo = 'simple';
            else inferredTipo = 'estandar';
        }

        setNewProduct({
            nombre: product.nombre + ' (Copia)',
            precio: product.precio,
            stock: 0,
            sku: '',
            categoria_id: product.categoria_id || '',
            categoria_especifica_id: product.categoria_especifica_id || '',
            descripcion: product.descripcion || '',
            estampa: '',
            tipo_articulo: inferredTipo
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

        toast("Producto duplicado. Revisa los datos.", { icon: '✨' });
    };

    const handleSubmitCreate = async (e) => {
        e.preventDefault();
        if (!newProduct.categoria_id) return toast.error("Falta categoría");
        const toastId = toast.loading("Creando producto...");
        try {
            const fd = new FormData();
            fd.append('nombre', newProduct.nombre);
            fd.append('precio', newProduct.precio);
            fd.append('stock', newProduct.stock);
            fd.append('categoria_id', newProduct.categoria_id);
            if (newProduct.categoria_especifica_id) fd.append('categoria_especifica_id', newProduct.categoria_especifica_id);
            fd.append('descripcion', newProduct.descripcion);

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
                fd.append('estampa', finalEstampa.toUpperCase());
            }

            if (selectedFile) fd.append('imagen', selectedFile);

            await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success("¡Producto Creado!", { id: toastId });
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
        const t = toast.loading("Generando lote...");
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
        const t = toast.loading("Procesando catálogo...");
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

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-3 md:p-4 max-w-[1600px] mx-auto gap-3 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative font-sans">
            <Toaster position="top-center" toastOptions={{ style: { borderRadius: '10px', fontSize: '13px', fontWeight: 'bold' } }} />

            {/* HEADER COMPACTADO */}
            <div className="flex flex-col gap-3 shrink-0 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-inner">
                            <Box size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{viewMode === 'active' ? 'Inventario Central' : 'Archivo'}</h1>
                            {viewMode === 'active' && (
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] mr-1"></div>Normal</span>
                                    <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] mr-1"></div>Bajo</span>
                                    <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] mr-1"></div>Agotado</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl shadow-inner border border-slate-200/50 dark:border-slate-700/50">
                        <button onClick={() => setViewMode('active')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${viewMode === 'active' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>Activos</button>
                        <button onClick={() => setViewMode('archived')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center ${viewMode === 'archived' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}><Archive size={14} className="mr-1.5" /> Discontinuos</button>
                    </div>
                </div>

                {viewMode === 'active' && (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all mr-auto ${showAdvancedFilters ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 shadow-inner' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}>
                            <ListFilter size={14} className="mr-1.5" /> {showAdvancedFilters ? 'Ocultar' : 'Avanzados'}
                        </button>

                        <button onClick={() => setHideOutOfStock(!hideOutOfStock)} className={`flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${hideOutOfStock ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 shadow-inner' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}>{hideOutOfStock ? <EyeOff size={14} className="mr-1.5" /> : <Eye size={14} className="mr-1.5" />} {hideOutOfStock ? 'Sin Stock: Oculto' : 'Sin Stock: Visible'}</button>

                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-1 rounded-lg animate-fade-in mr-1 shadow-sm">
                                <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 px-2">{selectedItems.size} sel.</span>
                                <button onClick={() => setIsSelectedPriceModalOpen(true)} className="bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-100 dark:border-emerald-900/50 px-2 py-1 rounded-md text-[11px] font-bold flex items-center hover:bg-emerald-50 transition-colors"><TrendingUp size={12} className="mr-1" /> Precios</button>
                                <button onClick={handlePrintLabelsSelected} className="bg-slate-800 dark:bg-slate-700 text-white shadow-sm px-2 py-1 rounded-md text-[11px] font-bold flex items-center hover:bg-slate-900 transition-colors"><Printer size={12} className="mr-1" /> Imprimir</button>
                                <button onClick={handleBulkToggleStatus} className="bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 shadow-sm border border-red-100 dark:border-red-900/50 px-2 py-1 rounded-md text-[11px] font-bold flex items-center hover:bg-red-50 transition-colors"><Archive size={12} className="mr-1" /> Archivar</button>
                            </div>
                        )}

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>
                        <button onClick={handlePrintLabelsByFilter} className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center hover:bg-slate-50 font-bold text-[11px] transition-all"><Tags size={14} className="mr-1.5 text-slate-400" /> ETIQUETAS</button>
                        <button onClick={() => setIsBulkModalOpen(true)} className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center hover:bg-slate-50 font-bold text-[11px] transition-all"><TrendingUp size={14} className="mr-1.5 text-emerald-500" /> AUMENTOS</button>

                        <button onClick={() => setIsTNModalOpen(true)} className="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 px-3 py-1.5 rounded-lg flex items-center hover:bg-sky-100 font-bold text-[11px] transition-all active:scale-95 shadow-sm">
                            <Cloud size={14} className="mr-1.5" /> MARGEN NUBE
                        </button>

                        <button onClick={handleForceSync} disabled={isSyncing} className={`flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all shadow-sm ${isSyncing ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-wait' : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}>
                            <RefreshCw size={12} className={`mr-1.5 ${isSyncing ? "animate-spin" : ""}`} /> {isSyncing ? "SYNC..." : "SYNC NUBE"}
                        </button>

                        <button onClick={() => setShowForm(!showForm)} className={`flex items-center px-4 py-1.5 rounded-lg text-[11px] font-bold text-white shadow-md transition-all duration-300 active:scale-95 ${showForm ? 'bg-slate-600 hover:bg-slate-700' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700'}`}>
                            {showForm ? <X size={14} className="mr-1.5" /> : <Plus size={14} className="mr-1.5" />} {showForm ? "CANCELAR" : "NUEVO"}
                        </button>
                    </div>
                )}
            </div>

            {/* BÚSQUEDA Y FILTROS */}
            {!showForm && (
                <div className="flex flex-col gap-2 z-10 relative">
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-2 animate-fade-in transition-colors relative z-20">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                ref={searchInputRef}
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                placeholder={viewMode === 'active' ? "Buscar por nombre, SKU o marca..." : "Buscar en archivo..."}
                                className={`w-full pl-10 pr-3 py-2 border-transparent focus:border-indigo-300 dark:focus:border-indigo-600 focus:ring-2 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 rounded-lg outline-none transition-all font-medium text-xs ${viewMode === 'active' ? 'bg-slate-50 dark:bg-slate-800 dark:text-white' : 'bg-red-50 dark:bg-red-900/20 dark:text-red-200'}`}
                            />
                            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-700 rounded-full p-0.5"><X size={12} /></button>}
                        </div>

                        <div className="flex gap-2 relative">
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full md:w-40 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 rounded-lg outline-none px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer appearance-none">
                                <option value="recientes">Más Recientes</option>
                                <option value="mas_vendidos">Más Vendidos</option>
                                <option value="mayor_stock">Mayor Stock</option>
                                <option value="menor_stock">Menor Stock</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="flex gap-2 relative">
                            <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)} className="w-full md:w-48 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 rounded-lg outline-none px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer appearance-none">
                                <option value="">Ligas / Tipos: Todas</option>
                                {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar px-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1 shrink-0">Cat:</span>
                        <button onClick={() => setSelectedCat('')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap shrink-0 shadow-sm ${selectedCat === '' ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-800'}`}>TODAS</button>
                        {categories.map(c => (
                            <button key={c.id} onClick={() => setSelectedCat(selectedCat === c.id ? '' : c.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all duration-300 whitespace-nowrap shrink-0 shadow-sm ${selectedCat == c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'}`}>
                                {c.nombre}
                            </button>
                        ))}
                    </div>

                    {showAdvancedFilters && (
                        <div className="bg-indigo-50/80 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-wrap gap-4 items-center animate-fade-in-down transition-colors backdrop-blur-sm shadow-inner">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">Stock</label>
                                <input type="number" min="0" placeholder="Ej: 0" className="w-16 p-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-800 dark:text-white" value={filterExactStock} onChange={e => setFilterExactStock(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">Talle</label>
                                <input type="text" placeholder="Ej: S" className="w-16 p-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-800 dark:text-white uppercase" value={filterSize} onChange={e => setFilterSize(e.target.value)} />
                            </div>
                            <button onClick={() => setFilterNoImage(!filterNoImage)} className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all shadow-sm ${filterNoImage ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                                <ImageOff size={12} className="mr-1.5" /> {filterNoImage ? 'Sin Imagen' : 'Filtro Imagen'}
                            </button>
                            {(filterExactStock || filterSize || filterNoImage) && (
                                <button onClick={() => { setFilterExactStock(''); setFilterSize(''); setFilterNoImage(false); }} className="ml-auto text-[10px] text-indigo-600 hover:text-indigo-800 underline font-bold tracking-wide">Limpiar</button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* FORMULARIO ALTA RÁPIDA */}
            {showForm && (
                <div id="formCreate" className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl border border-indigo-100 dark:border-slate-800 animate-fade-in-down shrink-0 relative overflow-hidden transition-colors z-20">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-blue-500"></div>
                    <h3 className="font-black text-xl mb-4 text-slate-800 dark:text-white flex items-center tracking-tight"><Plus className="mr-2 text-indigo-500" size={24} /> Nuevo Producto</h3>

                    <form onSubmit={handleSubmitCreate} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nombre del Producto</label>
                            <input id="inputName" autoFocus required className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-indigo-400 dark:text-white transition-all" placeholder="Ej: Camiseta Titular..." value={newProduct.nombre} onChange={e => setNewProduct({ ...newProduct, nombre: e.target.value })} />
                        </div>

                        <div className="md:col-span-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tipo de Artículo</label>
                            <div className="relative">
                                <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-8 rounded-lg text-sm font-bold outline-none focus:border-indigo-400 dark:text-white appearance-none cursor-pointer" value={newProduct.tipo_articulo || 'estandar'} onChange={e => setNewProduct({ ...newProduct, tipo_articulo: e.target.value })}>
                                    <option value="simple">📦 Simple</option>
                                    <option value="estandar">👕 Estándar</option>
                                    <option value="personalizable">⭐ Personalizable</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Categoría</label>
                            <div className="relative">
                                <select required className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-8 rounded-lg text-sm font-bold outline-none focus:border-indigo-400 dark:text-white appearance-none cursor-pointer" value={newProduct.categoria_id} onChange={e => setNewProduct({ ...newProduct, categoria_id: e.target.value })}><option value="">Seleccione...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="md:col-span-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Liga / Torneo</label>
                            <div className="relative">
                                <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-8 rounded-lg text-sm font-bold outline-none focus:border-indigo-400 dark:text-white appearance-none cursor-pointer" value={newProduct.categoria_especifica_id} onChange={e => setNewProduct({ ...newProduct, categoria_especifica_id: e.target.value })}><option value="">(Opcional)</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Precio Venta</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 font-black text-emerald-600 dark:text-emerald-400">$</span>
                                <input type="number" required className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pl-7 rounded-lg text-sm font-black text-emerald-700 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white transition-all" placeholder="0.00" value={newProduct.precio} onChange={e => setNewProduct({ ...newProduct, precio: e.target.value })} />
                            </div>
                        </div>

                        {newProduct.tipo_articulo !== 'simple' && (
                            <div className="md:col-span-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Curva Talles</label>
                                <div className="relative">
                                    <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-8 rounded-lg font-bold text-xs outline-none focus:border-indigo-400 dark:text-white appearance-none cursor-pointer" value={selectedGridType} onChange={e => setSelectedGridType(e.target.value)}>{Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}</select>
                                    <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        {newProduct.tipo_articulo === 'personalizable' && (
                            <div className="md:col-span-3">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Estampa (Jugador)</label>
                                <input className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white dark:text-white transition-all uppercase placeholder-slate-300" placeholder="Ej: MESSI 10" value={newProduct.estampa || ''} onChange={e => setNewProduct({ ...newProduct, estampa: e.target.value.toUpperCase() })} />
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Stock {newProduct.tipo_articulo !== 'simple' ? 'x Talle' : 'Total'}</label>
                            <input type="number" required className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg text-sm text-center font-black outline-none focus:border-indigo-400 focus:bg-white dark:text-white transition-all" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })} />
                        </div>

                        <div className="md:col-span-3">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Plantilla Nube</label>
                            <div className="relative">
                                <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-8 rounded-lg font-bold text-xs outline-none focus:border-indigo-400 dark:text-white appearance-none cursor-pointer" value={newProduct.descripcion} onChange={e => setNewProduct({ ...newProduct, descripcion: e.target.value })}>
                                    <option value="">(Vacía)</option>
                                    <option value="Camisetas Nacionales">C. Nacionales</option>
                                    <option value="Camisetas Retro">C. Retro</option>
                                    <option value="Camisetas G5 Importadas">C. G5</option>
                                    <option value="Conjuntos">Conjuntos</option>
                                    <option value="Buzos">Buzos</option>
                                    <option value="Camperas">Camperas</option>
                                    <option value="Pantalones Largos">Pantalones</option>
                                    <option value="Shorts">Shorts</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className={`mt-2 md:col-span-12`}>
                            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-3 rounded-lg font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.99] flex items-center justify-center tracking-wide">
                                <Save className="mr-2" size={18} /> GUARDAR PRODUCTO EN INVENTARIO
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TABLA PRINCIPAL - GANA ESPACIO */}
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border flex-1 flex flex-col overflow-hidden relative transition-colors z-0 ${viewMode === 'active' ? 'border-slate-100 dark:border-slate-800' : 'border-red-200 dark:border-red-900'}`}>
                {viewMode === 'archived' && <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-[10px] font-black p-2 text-center border-b border-red-100 dark:border-red-900/50 tracking-widest uppercase shadow-inner">VISTA DE ARCHIVO (SOLO LECTURA)</div>}

                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10 transition-colors border-b border-slate-200 dark:border-slate-800 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center"><button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">{selectedItems.size === products.length && products.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}</button></th>
                                <th className="px-4 py-3 text-center w-14">Foto</th>
                                <th className="px-4 py-3 w-1/4">Producto & Categoría</th>
                                <th className="px-4 py-3 w-20">Precio</th>
                                <th className="px-4 py-3 min-w-[300px]">Agrupación de Variantes</th>
                                <th className="px-4 py-3 text-center w-16">Nube</th>
                                <th className="px-4 py-3 text-right w-32">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? <tr><td colSpan="7" className="p-10 text-center text-slate-400 font-bold flex-col items-center"><Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" /> Cargando...</td></tr> : products.length === 0 ? <tr><td colSpan="7" className="p-10 text-center text-slate-400 italic text-xs">No se encontraron resultados para la búsqueda actual.</td></tr> : products.map(p => (
                                <tr key={p.id} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-all duration-200 group ${processingId === p.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <td className="px-4 py-3 text-center"><button onClick={() => toggleSelect(p.id)} className={`transition-transform active:scale-90 ${selectedItems.has(p.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}>{selectedItems.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>

                                    <td className="px-4 py-3 text-center">
                                        <div onClick={() => p.imagen && setImageModalSrc(`/api/static/uploads/${p.imagen}`)} className="h-10 w-10 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img mx-auto shadow-sm">
                                            {p.imagen ? <img src={`/api/static/uploads/${p.imagen}`} className="h-full w-full object-cover transform group-hover/img:scale-110 transition-transform duration-300" /> : <Shirt size={16} className="text-slate-300" />}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 w-1/4 max-w-[150px] md:max-w-[200px]">
                                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate" title={p.nombre}>{p.nombre}</div>
                                        <div className="flex gap-1 mt-1 overflow-hidden">
                                            <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded font-black uppercase tracking-wider whitespace-nowrap">{p.categoria}</span>
                                            {p.liga && p.liga !== '-' && <span className="text-[8px] px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded font-black uppercase tracking-wider whitespace-nowrap">{p.liga}</span>}
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 font-mono font-black text-sm text-emerald-700 dark:text-emerald-400 tracking-tight whitespace-nowrap">
                                        $ {p.precio.toLocaleString()}
                                    </td>

                                    <td className="px-4 py-3 min-w-max">
                                        <VariantStockGroup
                                            variants={p.variantes}
                                            onOpenDetails={(grupo) => {
                                                setSelectedVariantGroup({ ...grupo, productName: p.nombre, productData: p });
                                                setIsVariantModalOpen(true);
                                            }}
                                        />
                                    </td>

                                    <td className="px-4 py-3 text-center">
                                        {processingId === p.id ? <Loader2 size={16} className="animate-spin text-indigo-600 mx-auto" /> : p.tiendanube_id ? <span className="inline-flex items-center justify-center p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-full shadow-sm" title="Vinculado"><Cloud size={14} /></span> : <button onClick={() => handlePublish(p)} className="inline-flex items-center justify-center p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full hover:text-indigo-600 transition-all shadow-sm active:scale-95"><UploadCloud size={14} /></button>}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {viewMode === 'active' ? (
                                                <>
                                                    {p.tiendanube_id && (
                                                        <button onClick={() => handleImportImage(p)} className="text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 p-1.5 rounded-lg transition-colors"><DownloadCloud size={16} /></button>
                                                    )}
                                                    <button onClick={() => handleDuplicate(p)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded-lg transition-colors"><Copy size={16} /></button>
                                                    <button onClick={() => handleToggleStatus(p)} className="text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 p-1.5 rounded-lg transition-colors"><Archive size={16} /></button>
                                                    <button onClick={() => { setEditingProduct(p); setIsEditModalOpen(true); }} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1.5 rounded-lg transition-colors"><Edit size={16} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleToggleStatus(p)} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 p-1.5 rounded-lg transition-colors"><ArchiveRestore size={16} /></button>
                                                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/80 p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors">
                    {searchTerm.trim() !== '' ? (
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <span className="text-indigo-600 dark:text-indigo-400 text-sm">{products.length}</span> res
                        </span>
                    ) : (
                        <>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Pág <span className="text-slate-800 dark:text-white text-sm">{page}</span> de {totalPages}
                            </span>
                            <div className="flex gap-1.5">
                                <button onClick={() => page > 1 && fetchProducts(page - 1)} disabled={page === 1} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all"><ChevronLeft size={14} className="text-slate-600" /></button>
                                <button onClick={() => page < totalPages && fetchProducts(page + 1)} disabled={page === totalPages} className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 shadow-sm transition-all"><ChevronRight size={14} className="text-slate-600" /></button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <VariantDetailsModal
                isOpen={isVariantModalOpen}
                onClose={() => setIsVariantModalOpen(false)}
                grupo={selectedVariantGroup}
                onPrintVariant={(v) => handlePrintSingleLabel(new Event('click'), selectedVariantGroup.productData, v)}
                onOpenBarcode={(v) => {
                    setIsVariantModalOpen(false);
                    setTimeout(() => {
                        setSelectedVariantForBarcode({
                            nombre: selectedVariantGroup.productName,
                            talle: v.talle,
                            sku: v.sku,
                            precio: selectedVariantGroup.productData.precio
                        });
                        setIsBarcodeModalOpen(true);
                    }, 100);
                }}
            />

            {/* BARRAS DE ESTADO FIJAS */}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
                {syncProgress && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 w-72 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center uppercase tracking-wider">
                                {syncProgress.is_running ? <RefreshCw size={14} className="mr-2 animate-spin text-indigo-500" /> : <Cloud size={14} className="mr-2 text-emerald-500" />}
                                Sincronizando Stock
                            </h4>
                            {!syncProgress.is_running && <button onClick={() => setSyncProgress(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={14} className="text-slate-400" /></button>}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-1.5 overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ${syncProgress.is_running ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (syncProgress.current / syncProgress.total) * 100 || 0)}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>{syncProgress.current} / {syncProgress.total}</span>
                            <span className={syncProgress.is_running ? 'text-indigo-500' : 'text-emerald-500'}>{Math.round((syncProgress.current / syncProgress.total) * 100 || 0)}%</span>
                        </div>
                    </div>
                )}

                {marginProgress && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 w-72 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center uppercase tracking-wider">
                                {marginProgress.is_running ? <TrendingUp size={14} className="mr-2 animate-bounce text-emerald-500" /> : <CheckCircle2 size={14} className="mr-2 text-emerald-500" />}
                                Subiendo Precios TN
                            </h4>
                            {!marginProgress.is_running && <button onClick={() => setMarginProgress(null)} className="p-1 hover:bg-slate-100 rounded-full"><X size={14} className="text-slate-400" /></button>}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-1.5 overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-500 ${marginProgress.is_running ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, (marginProgress.current / marginProgress.total) * 100 || 0)}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>{marginProgress.current} / {marginProgress.total}</span>
                            <span className="text-emerald-500">{Math.round((marginProgress.current / marginProgress.total) * 100 || 0)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {isSelectedPriceModalOpen && (
                <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsSelectedPriceModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm p-8 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-xl mb-4 text-slate-800 dark:text-white flex items-center tracking-tight">
                            <TrendingUp className="mr-3 text-emerald-500" size={24} /> Editar Precios
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Actualizando <span className="font-black text-indigo-600">{selectedItems.size} productos</span>.</p>

                        <form onSubmit={handleUpdateSelectedPrices}>
                            <div className="mb-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo de Operación</label>
                                <div className="relative">
                                    <select value={selectedPriceType} onChange={e => setSelectedPriceType(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 dark:text-white appearance-none cursor-pointer">
                                        <option value="percent_increase">Aumento por Porcentaje (%)</option>
                                        <option value="percent_decrease">Descuento por Porcentaje (%)</option>
                                        <option value="fixed">Establecer Precio Fijo ($)</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor ({selectedPriceType === 'fixed' ? '$' : '%'})</label>
                                <input type="number" required min="0" step="0.01" autoFocus placeholder="0" value={selectedPriceValue} onChange={e => setSelectedPriceValue(e.target.value)} className="w-full p-3 border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl font-black text-xl outline-none focus:border-emerald-500 text-emerald-600 dark:text-emerald-400 text-center" />
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setIsSelectedPriceModalOpen(false)} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl transition-all active:scale-95">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 text-white font-black text-sm rounded-xl shadow-lg transition-all active:scale-95">Aplicar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ModalBarcode isOpen={isBarcodeModalOpen} onClose={() => setIsBarcodeModalOpen(false)} productData={selectedVariantForBarcode} />
            <EditProductModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} product={editingProduct} categories={categories} specificCategories={specificCategories} onUpdate={() => { fetchProducts(page, true); playSound('success'); }} />
            <BulkPriceModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onUpdate={() => fetchProducts(page)} categories={categories} specificCategories={specificCategories} />
            <TNPriceModal isOpen={isTNModalOpen} onClose={() => setIsTNModalOpen(false)} />

            {imageModalSrc && (
                <div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm animate-fade-in" onClick={() => setImageModalSrc(null)}>
                    <img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl animate-zoom-in border-4 border-white/10" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-md transition-all"><X size={24} /></button>
                </div>
            )}
        </div>
    );
};

export default InventoryPage;