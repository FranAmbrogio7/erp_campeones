import { useEffect, useState, useRef } from 'react';
import BulkPriceModal from '../components/BulkPriceModal';
import {
    Plus, Trash2, Shirt, Save, ChevronLeft, ChevronRight, Search,
    Image as ImageIcon, X, TrendingUp, Filter, Edit3, Printer,
    CheckSquare, Square, ArrowUpRight, RotateCcw
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

    // --- FILTROS Y PAGINACIÓN ---
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCat, setSelectedCat] = useState('');
    const [selectedSpec, setSelectedSpec] = useState('');

    // --- SELECCIÓN MÚLTIPLE (Para etiquetas) ---
    const [selectedItems, setSelectedItems] = useState(new Set());

    // --- FORMULARIO (CREAR / EDITAR) ---
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const formRef = useRef(null);

    // Estado del formulario
    const [formData, setFormData] = useState({
        nombre: '', precio: '', stock: '10', sku: '',
        categoria_id: '', categoria_especifica_id: ''
    });
    const [selectedGridType, setSelectedGridType] = useState('ADULTO');
    const [selectedFile, setSelectedFile] = useState(null);

    // --- MODALES ---
    const [imageModalSrc, setImageModalSrc] = useState(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // 1. CARGA INICIAL DE LISTAS
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

    // 2. CARGAR PRODUCTOS (Con Filtros)
    const fetchProducts = async (currentPage = 1) => {
        setLoading(true);
        try {
            const params = {
                page: currentPage,
                limit: 10,
                search: searchTerm
            };
            if (selectedCat) params.category_id = selectedCat;
            if (selectedSpec) params.specific_id = selectedSpec;

            const res = await api.get('/products', { params });
            setProducts(res.data.products);
            setTotalPages(res.data.meta.total_pages);
            setPage(res.data.meta.current_page);

            // Limpiar selección al cambiar de página/filtro para evitar errores
            setSelectedItems(new Set());
        } catch (error) {
            console.error(error);
            toast.error("Error cargando productos");
        } finally {
            setLoading(false);
        }
    };

    // 3. EFECTO DE BÚSQUEDA (Debounce + Filtros)
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchProducts(1);
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, selectedCat, selectedSpec]);

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

    // --- ACCIONES DE PRODUCTO ---
    const handleDelete = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar este producto?")) return;
        try {
            await api.delete(`/products/${id}`);
            toast.success("Producto eliminado");
            fetchProducts(page);
        } catch (e) {
            toast.error("Error al borrar: " + (e.response?.data?.msg || "Error desconocido"));
        }
    };

    const handleEdit = (product) => {
        setIsEditing(true);
        setEditId(product.id);
        setFormData({
            nombre: product.nombre,
            precio: product.precio,
            stock: 0, // No editamos stock total directo aquí, solo info base
            sku: '',
            categoria_id: product.categoria_id || '',
            categoria_especifica_id: product.categoria_especifica_id || ''
        });
        // No seteamos la curva de talles porque es un producto existente
        setShowForm(true);
        // Scroll suave hacia el formulario
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth' });
            // Foco en el nombre
            document.getElementById('inputName')?.focus();
        }, 100);
    };

    const resetForm = () => {
        setFormData({
            nombre: '', precio: '', stock: '10', sku: '',
            categoria_id: '', categoria_especifica_id: ''
        });
        setSelectedGridType('ADULTO');
        setSelectedFile(null);
        setIsEditing(false);
        setEditId(null);
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
                // EDITAR (PUT)
                await api.put(`/products/${editId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
                toast.success("Producto actualizado", { id: toastId });
            } else {
                // CREAR (POST)
                data.append('talle', SIZE_GRIDS[selectedGridType].join(','));
                data.append('stock', formData.stock);
                await api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
                toast.success("Producto creado", { id: toastId });
            }

            setShowForm(false);
            resetForm();
            fetchProducts(page);

        } catch (e) {
            toast.error("Error: " + (e.response?.data?.msg || "Error desconocido"), { id: toastId });
        }
    };

    // --- IMPRESIÓN MASIVA DE ETIQUETAS ---
    const handlePrintLabels = async () => {
        if (selectedItems.size === 0) return toast.error("Selecciona productos primero");

        const loadToast = toast.loading("Generando etiquetas...");
        try {
            // Preparamos los items seleccionados. 
            // Nota: Para hacerlo simple, imprimiremos 1 etiqueta por variante del producto seleccionado
            // O, si prefieres, 1 etiqueta genérica por producto. 
            // Aquí haremos: Buscar el producto completo para obtener sus variantes y mandar a imprimir.

            // Recopilamos la info de la tabla actual
            const itemsToPrint = products
                .filter(p => selectedItems.has(p.id))
                .flatMap(p =>
                    // Mapeamos las variantes de cada producto seleccionado
                    p.variantes.map(v => ({
                        nombre: p.nombre,
                        sku: v.sku,
                        talle: v.talle,
                        cantidad: 1 // 1 etiqueta por cada variante existente
                    }))
                );

            if (itemsToPrint.length === 0) throw new Error("No hay variantes para imprimir");

            const res = await api.post('/products/labels/batch-pdf', { items: itemsToPrint }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'etiquetas_seleccion.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success("PDF generado", { id: loadToast });
            setSelectedItems(new Set()); // Limpiar selección

        } catch (e) {
            console.error(e);
            toast.error("Error generando PDF", { id: loadToast });
        }
    };


    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 max-w-[1600px] mx-auto gap-4">
            <Toaster position="top-center" />

            {/* HEADER & ACCIONES SUPERIORES */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 flex items-center">
                        <Shirt className="mr-3 text-blue-600" /> Inventario Maestro
                    </h1>
                    <p className="text-sm text-gray-500 hidden md:block">Gestiona precios, stock y etiquetas.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">

                    {/* Botones de Acción Masiva */}
                    {selectedItems.size > 0 && (
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg animate-fade-in">
                            <span className="text-xs font-bold text-slate-600 px-2">{selectedItems.size} seleccionados</span>
                            <button
                                onClick={handlePrintLabels}
                                className="bg-slate-800 text-white px-3 py-1.5 rounded-md text-xs font-bold flex items-center hover:bg-black transition-colors"
                            >
                                <Printer size={14} className="mr-2" /> Etiquetas
                            </button>
                        </div>
                    )}

                    <div className="h-8 w-px bg-gray-300 mx-2 hidden md:block"></div>

                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl flex items-center hover:bg-emerald-100 transition-colors font-bold text-sm"
                    >
                        <TrendingUp size={18} className="mr-2" /> Ajustar Precios
                    </button>

                    <button
                        onClick={() => { resetForm(); setShowForm(!showForm); }}
                        className={`px-4 py-2.5 rounded-xl flex items-center font-bold text-sm shadow-lg transition-all active:scale-95 ${showForm ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        {showForm ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                        {showForm ? 'Cancelar' : 'Nuevo Producto'}
                    </button>
                </div>
            </div>

            {/* FORMULARIO DESPLEGABLE */}
            {showForm && (
                <div ref={formRef} className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 animate-fade-in-down shrink-0 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${isEditing ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-gray-800 flex items-center">
                            {isEditing ? <Edit3 className="mr-2 text-orange-500" /> : <Plus className="mr-2 text-blue-500" />}
                            {isEditing ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                        </h3>
                        {isEditing && (
                            <button onClick={() => { setShowForm(false); resetForm(); }} className="text-xs text-gray-400 hover:text-red-500 underline">Cancelar Edición</button>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
                        {/* Nombre */}
                        <div className="md:col-span-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nombre del Artículo</label>
                            <input
                                id="inputName"
                                className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-bold text-gray-700"
                                required
                                placeholder="Ej: Camiseta Titular 2024"
                                value={formData.nombre}
                                onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            />
                        </div>

                        {/* Categorías */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Categoría</label>
                            <select
                                className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none focus:border-blue-400 cursor-pointer"
                                required
                                value={formData.categoria_id}
                                onChange={e => setFormData({ ...formData, categoria_id: e.target.value })}
                            >
                                <option value="">Seleccionar...</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Liga / Tipo</label>
                            <select
                                className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none focus:border-blue-400 cursor-pointer"
                                value={formData.categoria_especifica_id}
                                onChange={e => setFormData({ ...formData, categoria_especifica_id: e.target.value })}
                            >
                                <option value="">(Opcional)</option>
                                {specificCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                            </select>
                        </div>

                        {/* Precio */}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Precio Venta</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3.5 text-gray-400 font-bold">$</span>
                                <input
                                    className="w-full pl-8 border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none focus:border-green-400 focus:text-green-700 font-bold text-lg"
                                    required
                                    type="number"
                                    value={formData.precio}
                                    onChange={e => setFormData({ ...formData, precio: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Talles y Stock (Solo Visible en CREAR) */}
                        {!isEditing && (
                            <>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Curva Talles</label>
                                    <select
                                        className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none text-xs font-bold"
                                        value={selectedGridType}
                                        onChange={e => setSelectedGridType(e.target.value)}
                                    >
                                        {Object.keys(SIZE_GRIDS).map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Stock Inicial</label>
                                    <input
                                        className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl outline-none focus:border-blue-400 text-center font-bold"
                                        required
                                        type="number"
                                        value={formData.stock}
                                        onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                    />
                                </div>
                            </>
                        )}

                        {/* Imagen */}
                        <div className="md:col-span-12 bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300 mt-2 flex items-center">
                            <ImageIcon size={20} className="text-gray-400 mr-3" />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setSelectedFile(e.target.files[0])}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                            />
                        </div>

                        {/* Botón Guardar */}
                        <div className="md:col-span-12 mt-2">
                            <button
                                type="submit"
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex justify-center items-center ${isEditing ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                            >
                                <Save size={20} className="mr-2" />
                                {isEditing ? 'GUARDAR CAMBIOS' : 'REGISTRAR PRODUCTO'}
                            </button>
                        </div>
                    </form>
                </div>
            )}


            {/* BARRA DE FILTROS & BÚSQUEDA */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-3 items-center z-10">
                <div className="flex items-center text-gray-400 px-2"><Filter size={20} /></div>

                {/* Filtro Categoría */}
                <div className="relative w-full md:w-48">
                    <select
                        value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold text-sm"
                    >
                        <option value="">Todas las Categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"><ChevronRight className="rotate-90" size={14} /></div>
                </div>

                {/* Filtro Liga */}
                <div className="relative w-full md:w-48">
                    <select
                        value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)}
                        className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold text-sm"
                    >
                        <option value="">Todas las Ligas</option>
                        {specificCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"><ChevronRight className="rotate-90" size={14} /></div>
                </div>

                {/* Input Buscador */}
                <div className="relative flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    />
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    {(searchTerm || selectedCat || selectedSpec) && (
                        <button onClick={() => { setSearchTerm(''); setSelectedCat(''); setSelectedSpec(''); }} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>


            {/* TABLA DE PRODUCTOS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden relative">
                <div className="overflow-auto flex-1">
                    <table className="min-w-full text-left">
                        <thead className="bg-gray-50/90 text-gray-500 font-bold uppercase text-xs sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th className="px-4 py-3 w-10 text-center">
                                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">
                                        {selectedItems.size === products.length && products.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">Producto</th>
                                <th className="px-4 py-3">Info</th>
                                <th className="px-4 py-3">Precio</th>
                                <th className="px-4 py-3 text-center">Stock Total</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {loading ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">Cargando inventario...</td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan="6" className="p-10 text-center text-gray-400 italic">No se encontraron productos.</td></tr>
                            ) : (
                                products.map(p => (
                                    <tr key={p.id} className={`hover:bg-blue-50/30 transition-colors group ${selectedItems.has(p.id) ? 'bg-blue-50' : ''}`}>

                                        {/* CHECKBOX */}
                                        <td className="px-4 py-3 text-center">
                                            <button onClick={() => toggleSelect(p.id)} className={`transition-colors ${selectedItems.has(p.id) ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}>
                                                {selectedItems.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                        </td>

                                        {/* IMAGEN Y NOMBRE */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden cursor-zoom-in relative group/img shrink-0"
                                                    onClick={(e) => { if (p.imagen) { e.stopPropagation(); setImageModalSrc(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); } }}
                                                >
                                                    {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="h-full w-full object-cover" /> : <Shirt size={18} className="text-gray-300" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{p.nombre}</p>
                                                    <p className="text-xs text-gray-400">ID: {p.id}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* BADGES */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wider">{p.categoria || '-'}</span>
                                                {p.liga && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-wider">{p.liga}</span>}
                                            </div>
                                        </td>

                                        {/* PRECIO */}
                                        <td className="px-4 py-3 font-mono font-bold text-gray-700">$ {p.precio.toLocaleString()}</td>

                                        {/* STOCK */}
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${p.stock_total > 5 ? 'bg-green-100 text-green-700' : p.stock_total > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                {p.stock_total} u.
                                            </span>
                                        </td>

                                        {/* ACCIONES */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">

                                                {/* --- PEGAR ESTE BLOQUE NUEVO AQUÍ --- */}
                                                {p.tiendanube_id && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!window.confirm("¿Descargar foto desde Tienda Nube?")) return;
                                                            const t = toast.loading("Trayendo foto...");
                                                            try {
                                                                await api.post(`/products/${p.id}/import-image-from-cloud`);
                                                                toast.success("Foto actualizada", { id: t });
                                                                fetchProducts(page); // Recargar para ver la foto
                                                            } catch (err) {
                                                                toast.error("Error al descargar", { id: t });
                                                            }
                                                        }}
                                                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg transition-colors"
                                                        title="Traer foto de Tienda Nube"
                                                    >
                                                        <ImageIcon size={18} />
                                                    </button>
                                                )}
                                                {/* ------------------------------------ */}

                                                <button onClick={() => handleEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                                                    <Edit3 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="bg-white p-3 border-t border-gray-200 flex items-center justify-between shrink-0">
                    <span className="text-xs text-gray-400 font-medium">
                        Pag <span className="text-gray-800 font-bold">{page}</span> de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={() => { if (page > 1) fetchProducts(page - 1) }} disabled={page === 1} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={() => { if (page < totalPages) fetchProducts(page + 1) }} disabled={page === totalPages} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* MODALES EXTRA */}
            <BulkPriceModal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} onUpdate={fetchProducts} categories={categories} specificCategories={specificCategories} />

            {imageModalSrc && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-fade-in cursor-zoom-out" onClick={() => setImageModalSrc(null)}>
                    <img src={imageModalSrc} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
                    <button className="absolute top-5 right-5 text-white/50 hover:text-white"><X size={32} /></button>
                </div>
            )}
        </div>
    );
};

export default ProductsPage;