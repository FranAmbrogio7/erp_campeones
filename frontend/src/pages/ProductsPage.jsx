import { useEffect, useState, useRef } from 'react';
import BulkPriceModal from '../components/BulkPriceModal';
import {
    Plus, Trash2, Shirt, Save, ChevronLeft, ChevronRight, Search,
    Image as ImageIcon, X, TrendingUp, Filter, Edit3, Printer,
    CheckSquare, Square, ArrowUpRight, RotateCcw, Cloud, Tags,
    Archive, ArchiveRestore, Eye, EyeOff
} from 'lucide-react';
import { useAuth, api } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

// --- DEFINICIÓN DE CURVAS DE TALLES ---
const SIZE_GRIDS = {
    'ADULTO': ['S', 'M', 'L', 'XL', 'XXL'],
    'NIÑOS': ['4', '6', '8', '10', '12', '14', '16'],
    'BEBÉ': ['0', '1', '2', '3', '4', '5'],
    'ÚNICO': ['U'],
    'CALZADO': ['NIÑO', 'JUVENIL', 'ADULTO'],
    'TALLES ESPECIALES': ['6', '7', '8', '9', '10']
};

const ProductsPage = () => {
    const { token } = useAuth();

    // --- DATOS ---
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [specificCategories, setSpecificCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- ESTADOS DE VISTA ---
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'
    const [hideOutOfStock, setHideOutOfStock] = useState(false);

    // --- FILTROS Y PAGINACIÓN ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');

    // --- SELECCIÓN MÚLTIPLE ---
    const [selectedItems, setSelectedItems] = useState(new Set());

    // --- FORMULARIO ---
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const formRef = useRef(null);

    const [formData, setFormData] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: ''
    });
    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [selectedFile, setSelectedFile] = useState(null);

    // --- MODALES ---
    const [imageModalSrc, setImageModalSrc] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

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
            } catch (e) { console.error("Error cargando categorías", e); }
        };
        if (token) fetchDropdowns();
    }, [token]);

    // 2. CARGAR PRODUCTOS
    const fetchProducts = async (currentPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: 15,
                search: searchTerm,
                active: viewMode === 'active' ? 'true' : 'false',
                min_stock: hideOutOfStock ? 1 : undefined
            };
            if (selectedCat) params.category_id = selectedCat;
            if (selectedSpec) params.specific_id = selectedSpec;

            const res = await api.get('/products', { params });
            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);
            setSelectedItems(new Set());
        } catch (error) {
            console.error(error);
            toast.error("Error cargando productos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchProducts(1);
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedCat, selectedSpec, viewMode, hideOutOfStock]);

    // --- SELECCIÓN ---
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

    // --- ACCIONES INDIVIDUALES ---
    const handleToggleStatus = async (product) => {
        const action = viewMode === 'active' ? 'discontinuar' : 'restaurar';
        if (!window.confirm(`¿${action === 'discontinuar' ? 'Archivar' : 'Reactivar'} "${product.nombre}"?`)) return;
        try {
            await api.put(`/products/${product.id}/toggle-status`, { active: viewMode !== 'active' });
            toast.success(`Producto ${action === 'discontinuar' ? 'archivado' : 'restaurado'}`);
            fetchProducts(page);
        } catch (e) { toast.error("Error al cambiar estado"); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿ELIMINAR DEFINITIVAMENTE?\nEsta acción no se puede deshacer.")) return;
        try {
            await api.delete(`/products/${id}`);
            toast.success("Producto eliminado");
            fetchProducts(page);
        } catch (e) { toast.error("Error al borrar"); }
    };

    // --- NUEVO: ACCIÓN MASIVA (ARCHIVAR / RESTAURAR SELECCIÓN) ---
    const handleBulkToggleStatus = async () => {
        const action = viewMode === 'active' ? 'discontinuar' : 'restaurar';
        const actionLabel = viewMode === 'active' ? 'Archivar' : 'Restaurar';

        if (!window.confirm(`¿Seguro que deseas ${actionLabel} los ${selectedItems.size} productos seleccionados?`)) return;

        const loadToast = toast.loading(`Procesando masivo (${actionLabel})...`);

        try {
            // Ejecutamos las peticiones en paralelo para mayor velocidad
            const promises = Array.from(selectedItems).map(id =>
                api.put(`/products/${id}/toggle-status`, {
                    active: viewMode !== 'active'
                })
            );

            await Promise.all(promises);

            toast.success(`${selectedItems.size} productos ${action === 'discontinuar' ? 'archivados' : 'restaurados'}`, { id: loadToast });
            setSelectedItems(new Set());
            fetchProducts(page);
        } catch (e) {
            console.error(e);
            toast.error("Error en proceso masivo", { id: loadToast });
        }
    };

    // --- MANEJO DE FORMULARIO ---
    const handleEdit = (product) => {
        setIsEditing(true);
        setEditId(product.id);
        setFormData({
            nombre: product.nombre,
            precio: product.precio,
            stock: 0,
            sku: '',
            categoria_id: product.categoria_id || '',
            categoria_especifica_id: product.categoria_especifica_id || ''
        });
        setShowForm(true);
        setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); document.getElementById('inputName')?.focus(); }, 100);
    };

    const resetForm = () => {
        setFormData({ nombre: '', precio: '', stock: '10', sku: '', categoria_id: '', categoria_especifica_id: '' });
        setSelectedGridType('ADULTO'); setSelectedFile(null); setIsEditing(false); setEditId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoria_id) return toast.error("Selecciona una categoría");
        const toastId = toast.loading(isEditing ? "Actualizando..." : "Creando...");
        try {
            const data = new FormData();
            data.append('nombre', formData.nombre);
            data.append('precio', formData.precio);
            data.append('categoria_id', formData.categoria_id);
            if (formData.categoria_especifica_id) data.append('categoria_especifica_id', formData.categoria_especifica_id);
            if (selectedFile) data.append('imagen', selectedFile);

            if (isEditing) {
                await api.put(`/products/${editId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
                toast.success("Actualizado", { id: toastId });
            } else {
                data.append('talle', SIZE_GRIDS[selectedGridType].join(','));
                data.append('stock', formData.stock);
                await api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
                toast.success("Creado", { id: toastId });
            }
            setShowForm(false); resetForm(); fetchProducts(page);
        } catch (e) { toast.error("Error", { id: toastId }); }
    };

    // --- ETIQUETAS ---
    const handlePrintLabelsSelected = async () => {
        if (selectedItems.size === 0) return toast.error("Selecciona productos");
        const loadToast = toast.loading("Generando etiquetas...");
        try {
            const itemsToPrint = products.filter(p => selectedItems.has(p.id)).flatMap(p => p.variantes.map(v => ({ nombre: p.nombre, sku: v.sku, talle: v.talle, cantidad: 1 })));
            if (itemsToPrint.length === 0) throw new Error("Sin variantes");
            await generatePdf(itemsToPrint);
            toast.success("PDF generado", { id: loadToast });
            setSelectedItems(new Set());
        } catch (e) { toast.error("Error PDF", { id: loadToast }); }
    };

    const handlePrintLabelsByFilter = async () => {
        if (!searchTerm && !selectedCat && !selectedSpec) { if (!window.confirm("⚠️ ¿Etiquetas de TODO el stock?")) return; }
        const loadToast = toast.loading("Procesando...");
        try {
            const params = { search: searchTerm, category_id: selectedCat, specific_id: selectedSpec, active: viewMode === 'active' ? 'true' : 'false', limit: 5000 };
            const res = await api.get('/products', { params });
            const itemsToPrint = (res.data.products || []).flatMap(p => p.variantes.filter(v => v.stock > 0).map(v => ({ sku: v.sku || `GEN-${v.id_variante}`, nombre: p.nombre, talle: v.talle, cantidad: v.stock })));
            if (itemsToPrint.length === 0) { toast.error("Stock 0", { id: loadToast }); return; }
            if (itemsToPrint.reduce((acc, i) => acc + i.cantidad, 0) > 300 && !window.confirm(`⚠️ ${itemsToPrint.length} etiquetas. ¿Seguir?`)) { toast.dismiss(loadToast); return; }
            await generatePdf(itemsToPrint);
            toast.success("PDF Descargado", { id: loadToast });
        } catch (e) { toast.error("Error", { id: loadToast }); }
    };

    const generatePdf = async (items) => {
        const res = await api.post('/products/labels/batch-pdf', { items }, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a'); link.href = url; link.setAttribute('download', `Etiquetas_${Date.now()}.pdf`);
        document.body.appendChild(link); link.click(); link.remove();
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="flex flex-col gap-4 shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 flex items-center">
                            <Shirt className="mr-3 text-blue-600" /> {viewMode === 'active' ? 'Inventario Maestro' : 'Archivo Discontinuo'}
                        </h1>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
                        <button onClick={() => setViewMode('active')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}>Activos</button>
                        <button onClick={() => setViewMode('archived')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'archived' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}><Archive size={16} className="mr-2" /> Discontinuos</button>
                    </div>
                </div>

                {viewMode === 'active' && (
                    <div className="flex flex-wrap items-center gap-2 w-full justify-end border-t border-gray-100 pt-3">
                        <button onClick={() => setHideOutOfStock(!hideOutOfStock)} className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold border transition-all mr-auto md:mr-2 ${hideOutOfStock ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                            {hideOutOfStock ? <EyeOff size={16} className="mr-2" /> : <Eye size={16} className="mr-2" />} {hideOutOfStock ? 'Sin Stock: Oculto' : 'Sin Stock: Visible'}
                        </button>

                        {/* ACCIONES DE SELECCIÓN MASIVA */}
                        {selectedItems.size > 0 && (
                            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg animate-fade-in mr-2">
                                <span className="text-xs font-bold text-slate-600 px-2">{selectedItems.size} sel.</span>

                                <button onClick={handlePrintLabelsSelected} className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-black transition-colors" title="Imprimir etiquetas selección">
                                    <Printer size={14} className="mr-2" /> Imprimir
                                </button>

                                {/* BOTÓN NUEVO: ARCHIVAR MASIVO */}
                                <button onClick={handleBulkToggleStatus} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-red-200 transition-colors" title="Archivar seleccionados">
                                    <Archive size={14} className="mr-2" /> Archivar
                                </button>
                            </div>
                        )}

                        <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
                        <button onClick={handlePrintLabelsByFilter} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg flex items-center hover:bg-indigo-100 font-bold text-xs"><Tags size={16} className="mr-2" /> Etiquetas (Filtro)</button>
                        <button onClick={() => setIsBulkModalOpen(true)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg flex items-center hover:bg-emerald-100 font-bold text-xs"><TrendingUp size={16} className="mr-2" /> Precios</button>
                        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className={`px-4 py-2 rounded-lg flex items-center font-bold text-xs shadow-md active:scale-95 ${showForm ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>{showForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />} {showForm ? 'Cancelar' : 'Nuevo'}</button>
                    </div>
                )}

                {/* BARRA ACCIONES EN MODO DISCONTINUO */}
                {viewMode === 'archived' && selectedItems.size > 0 && (
                    <div className="flex w-full justify-end border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg animate-fade-in">
                            <span className="text-xs font-bold text-red-600 px-2">{selectedItems.size} seleccionados</span>
                            {/* BOTÓN NUEVO: RESTAURAR MASIVO */}
                            <button onClick={handleBulkToggleStatus} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-green-200 transition-colors" title="Restaurar seleccionados">
                                <ArchiveRestore size={14} className="mr-2" /> Restaurar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FORMULARIO */}
            {showForm && (
                <div ref={formRef} className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 shrink-0 relative overflow-hidden animate-fade-in-down">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isEditing ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                    <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center">{isEditing ? <Edit3 className="mr-2 text-orange-500" /> : <Plus className="mr-2 text-blue-500" />} {isEditing ? 'Editar' : 'Nuevo'} Producto</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                        <div className="md:col-span-4"><label className="block text-xs font-bold text-gray-500 mb-1">NOMBRE</label><input required className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl font-bold" id="inputName" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} /></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">CATEGORIA</label><select required className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl" value={formData.categoria_id} onChange={e => setFormData({ ...formData, categoria_id: e.target.value })}><option value="">Select...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">LIGA</label><select className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl" value={formData.categoria_especifica_id} onChange={e => setFormData({ ...formData, categoria_especifica_id: e.target.value })}><option value="">(Opcional)</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-500 mb-1">PRECIO</label><input required type="number" className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl font-bold" value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value })} /></div>
                        {!isEditing && <><div className="md:col-span-1"><label className="block text-xs font-bold text-gray-500 mb-1">CURVA</label><select className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl text-xs font-bold" value={selectedGridType} onChange={e => setSelectedGridType(e.target.value)}>{Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}</select></div><div className="md:col-span-1"><label className="block text-xs font-bold text-gray-500 mb-1">STOCK</label><input required type="number" className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl text-center font-bold" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} /></div></>}
                        <div className="md:col-span-12 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300 mt-2 flex items-center"><ImageIcon size={20} className="text-gray-400 mr-3" /><input type="file" accept="image/*" onChange={(e) => setSelectedFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 cursor-pointer" /></div>
                        <div className="md:col-span-12 mt-2"><button type="submit" className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg active:scale-95 flex justify-center items-center ${isEditing ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}><Save size={20} className="mr-2" /> GUARDAR</button></div>
                    </form>
                </div>
            )}

            {/* FILTROS Y TABLA */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 items-center z-10">
                <div className="flex items-center text-gray-400 px-2"><Filter size={20} /></div>
                <div className="relative w-full md:w-48"><select value={selectedCat} onChange={e => setSelectedCat(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-4 pr-8 rounded-xl font-bold text-sm outline-none"><option value="">Categorías...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="relative w-full md:w-48"><select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-4 pr-8 rounded-xl font-bold text-sm outline-none"><option value="">Ligas...</option>{specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="relative flex-1 w-full"><input type="text" placeholder={viewMode === 'active' ? "Buscar activo..." : "Buscar discontinuo..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 font-medium ${viewMode === 'active' ? 'bg-gray-50 focus:bg-white focus:ring-blue-100' : 'bg-red-50 focus:bg-white focus:ring-red-100'}`} /><Search className="absolute left-3 top-3 text-gray-400" size={18} />{(searchTerm || selectedCat || selectedSpec) && (<button onClick={() => { setSearchTerm(''); setSelectedCat(''); setSelectedSpec(''); }} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"><X size={16} /></button>)}</div>
            </div>

            <div className={`bg-white rounded-2xl shadow-sm border flex-1 flex flex-col overflow-hidden relative ${viewMode === 'active' ? 'border-gray-200' : 'border-red-200'}`}>
                {viewMode === 'archived' && <div className="bg-red-50 text-red-800 text-xs font-bold p-2 text-center border-b border-red-100">ARCHIVO DISCONTINUO</div>}
                <div className="overflow-auto flex-1">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase text-xs sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center"><button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">{selectedItems.size === products.length && products.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}</button></th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3">Info</th>
                                <th className="px-4 py-3">Precio</th>
                                <th className="px-4 py-3 text-center">Stock</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading ? <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Cargando...</td></tr> : products.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Sin resultados.</td></tr> : products.map(p => (
                                <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedItems.has(p.id) ? 'bg-blue-50' : ''}`}>
                                    <td className="px-4 py-3 text-center"><button onClick={() => toggleSelect(p.id)} className={`transition-colors ${selectedItems.has(p.id) ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}>{selectedItems.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button></td>
                                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden cursor-zoom-in shrink-0" onClick={(e) => { if (p.imagen) { e.stopPropagation(); setImageModalSrc(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); } }}>{p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="h-full w-full object-cover" /> : <Shirt size={18} className="text-gray-300" />}</div><div><p className="font-bold text-gray-800 flex items-center gap-2">{p.nombre}{p.tiendanube_id && <Cloud size={16} className="text-blue-500 fill-blue-50" />}</p><p className="text-xs text-gray-400">ID: {p.id}</p></div></div></td>
                                    <td className="px-4 py-3"><div className="flex flex-col items-start gap-1"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase">{p.categoria || '-'}</span>{p.liga && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{p.liga}</span>}</div></td>
                                    <td className="px-4 py-3 font-mono font-bold text-gray-700">$ {p.precio.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center"><span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.stock_total > 5 ? 'bg-green-100 text-green-700' : p.stock_total > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{p.stock_total} u.</span></td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {viewMode === 'active' ? (
                                                <>
                                                    <button onClick={() => handleToggleStatus(p)} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg" title="Archivar"><Archive size={18} /></button>
                                                    {p.tiendanube_id && <button onClick={async (e) => { e.stopPropagation(); if (!window.confirm("¿Descargar foto?")) return; try { await api.post(`/products/${p.id}/import-image-from-cloud`); toast.success("Foto OK"); fetchProducts(page); } catch { toast.error("Error"); } }} className="p-1.5 text-indigo-500 hover:bg-indigo-50" title="Foto Nube"><ImageIcon size={18} /></button>}
                                                    <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Editar"><Edit3 size={18} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => handleToggleStatus(p)} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg" title="Restaurar"><ArchiveRestore size={18} /></button>
                                                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg" title="Eliminar"><Trash2 size={18} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* PAGINACIÓN */}
                <div className="bg-white p-3 border-t border-gray-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-400 font-medium">Pag <span className="text-gray-800 font-bold">{page}</span> de {totalPages}</span>
                    <div className="flex gap-2"><button onClick={() => { if (page > 1) fetchProducts(page - 1) }} disabled={page === 1} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronLeft size={16} /></button><button onClick={() => { if (page < totalPages) fetchProducts(page + 1) }} disabled={page === totalPages} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ChevronRight size={16} /></button></div>
                </div>
            </div>

            <BulkPriceModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onUpdate={fetchProducts} categories={categories} specificCategories={specificCategories} />
            {imageModalSrc && <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setImageModalSrc(null)}><img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-lg" /><button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button></div>}
        </div>
    );
};

export default ProductsPage;