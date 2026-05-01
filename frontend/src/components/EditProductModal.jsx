import { useState, useEffect, useCallback, memo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { X, Save, Trash2, Plus, Image as ImageIcon, Shirt, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// =========================================================================
// 1. SUB-COMPONENTE OPTIMIZADO
// =========================================================================
const VariantRow = memo(({ v, onUpdateVariant, onDeleteVariant }) => {
    return (
        <tr className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors group border-b border-slate-50 dark:border-slate-800/50 last:border-0">
            <td className="py-2.5 px-4 font-black text-slate-700 dark:text-slate-200">{v.talle}</td>
            <td className="py-2.5 px-4">
                <input
                    className="border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg w-full md:w-36 text-xs font-bold text-indigo-700 dark:text-indigo-400 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 outline-none bg-white dark:bg-slate-900 transition-all placeholder-slate-300 dark:placeholder-slate-600 uppercase"
                    placeholder="Sin Estampa"
                    defaultValue={v.estampa === 'Standard' ? '' : v.estampa}
                    onBlur={(e) => {
                        e.target.value = e.target.value.toUpperCase(); // Fuerza visual al salir
                        onUpdateVariant(v.id_variante, v.stock, v.sku, e.target.value);
                    }}
                />
            </td>
            <td className="py-2.5 px-4">
                <input
                    className="border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg w-full md:w-36 text-xs font-mono uppercase focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 outline-none bg-white dark:bg-slate-900 dark:text-slate-300 transition-all"
                    defaultValue={v.sku}
                    onBlur={(e) => onUpdateVariant(v.id_variante, v.stock, e.target.value, v.estampa)}
                />
            </td>
            <td className="py-2.5 px-4 text-center">
                <input
                    type="number"
                    className={`border p-1.5 rounded-lg w-20 text-center font-black focus:ring-2 outline-none mx-auto block bg-white dark:bg-slate-900 transition-all ${v.stock < 2 ? 'border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 focus:ring-red-100 dark:focus:ring-red-900/30' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-emerald-100 dark:focus:ring-emerald-900/30'}`}
                    defaultValue={v.stock}
                    onBlur={(e) => onUpdateVariant(v.id_variante, e.target.value, v.sku, v.estampa)}
                />
            </td>
            <td className="py-2.5 px-4 text-right">
                <button onClick={() => onDeleteVariant(v.id_variante)} className="text-slate-300 dark:text-slate-600 group-hover:text-red-500 dark:group-hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all active:scale-90">
                    <Trash2 size={16} />
                </button>
            </td>
        </tr>
    );
});
VariantRow.displayName = 'VariantRow';

// =========================================================================
// 2. COMPONENTE PRINCIPAL DEL MODAL
// =========================================================================
const EditProductModal = ({ isOpen, onClose, product, onUpdate, categories, specificCategories }) => {
    const { token } = useAuth();

    const [formData, setFormData] = useState({
        nombre: '', precio: '', categoria_id: '', categoria_especifica_id: '', descripcion: ''
    });

    const [newImageFile, setNewImageFile] = useState(null);
    const [currentImage, setCurrentImage] = useState(null);
    const [variants, setVariants] = useState([]);
    const [newSize, setNewSize] = useState('S,M,L,XL,XXL');
    const [newStock, setNewStock] = useState(0);
    const [newEstampa, setNewEstampa] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isAddingVariant, setIsAddingVariant] = useState(false);

    const refreshLocalData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const res = await axios.get(`/api/products`, {
                params: { search: product.nombre, limit: 1 },
                headers: { Authorization: `Bearer ${token}` }
            });
            const updatedProduct = res.data.products.find(p => p.id === product.id);
            if (updatedProduct) {
                setVariants(updatedProduct.variantes.map(v => ({ ...v })));
            }
        } catch (err) {
            console.error("Error refrescando variantes:", err);
        } finally {
            setIsRefreshing(false);
        }
    }, [product, token]);

    useEffect(() => {
        if (product && isOpen) {
            setFormData({
                nombre: product.nombre || '',
                precio: product.precio || '',
                categoria_id: product.categoria_id || '',
                categoria_especifica_id: product.categoria_especifica_id || '',
                descripcion: product.descripcion || ''
            });
            setCurrentImage(product.imagen);
            setNewImageFile(null);
            setVariants(product.variantes.map(v => ({ ...v })));
            setNewEstampa('');
            setNewSize('S,M,L,XL,XXL');
            setNewStock(0);
            setIsSaving(false);
            setIsAddingVariant(false);
        }
    }, [product, isOpen]);

    const handleUpdateVariant = useCallback(async (variantId, newStock, newSku, newEstampa) => {
        try {
            // DOBLE CANDADO LÓGICO PARA EDICIÓN
            const estampaFinal = newEstampa && newEstampa.trim() !== '' ? newEstampa.toUpperCase() : 'Standard';
            
            await axios.put(`/api/products/variants/${variantId}`,
                { stock: newStock, sku: newSku, estampa: estampaFinal },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) { console.error("Error updating variant", e); }
    }, [token]);

    const handleDeleteVariant = useCallback(async (id) => {
        if (!window.confirm("¿Borrar este talle?")) return;
        try {
            await axios.delete(`/api/products/variants/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVariants(prev => prev.filter(v => v.id_variante !== id));
            onUpdate();
        } catch (e) { alert("Atención: " + (e.response?.data?.msg || "Error")); }
    }, [token, onUpdate]);

    const handleUpdateInfo = async () => {
        setIsSaving(true);
        try {
            const dataToSend = new FormData();
            dataToSend.append('nombre', formData.nombre);
            dataToSend.append('precio', formData.precio);
            dataToSend.append('categoria_id', formData.categoria_id);
            dataToSend.append('categoria_especifica_id', formData.categoria_especifica_id);
            dataToSend.append('descripcion', formData.descripcion);
            if (newImageFile) dataToSend.append('imagen', newImageFile);

            await axios.put(`/api/products/${product.id}`, dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onUpdate();
            onClose();
        } catch (e) {
            setIsSaving(false);
            alert("Error: " + (e.response?.data?.msg || e.message));
        }
    };

    const handleAddVariant = async () => {
        setIsAddingVariant(true);
        const isMultiple = newSize.includes(',');
        const toastId = toast.loading(isMultiple ? "Creando curva y sincronizando con TN..." : "Agregando talle...");

        try {
            // DOBLE CANDADO LÓGICO PARA CREACIÓN
            const estampaFinal = newEstampa.trim() !== '' ? newEstampa.toUpperCase() : 'Standard';

            await axios.post(`/api/products/variants`, {
                id_producto: product.id,
                talla: newSize,
                stock: newStock,
                estampa: estampaFinal
            }, { headers: { Authorization: `Bearer ${token}` } });

            toast.success("Variante/s agregada/s correctamente", { id: toastId });
            onUpdate();
            await refreshLocalData();
            setNewStock(0);
            setNewEstampa('');
        } catch (e) {
            toast.error(e.response?.data?.msg || "Error al agregar", { id: toastId });
        } finally {
            setIsAddingVariant(false);
        }
    };

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">

                {/* --- HEADER --- */}
                <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 relative z-20">
                    <h3 className="font-black text-lg md:text-xl text-slate-800 dark:text-white flex items-center tracking-tight truncate pr-4">
                        <Shirt className="mr-3 text-indigo-500 shrink-0" size={24}/> 
                        <span className="truncate">Editar: {product.nombre}</span>
                        {isRefreshing && <RefreshCw size={16} className="ml-3 animate-spin text-indigo-400 shrink-0" />}
                    </h3>
                    <button onClick={!isSaving && !isAddingVariant ? onClose : undefined} className={`transition-all bg-white dark:bg-slate-800 rounded-full p-2 shadow-sm border border-slate-200 dark:border-slate-700 active:scale-90 shrink-0 ${isSaving || isAddingVariant ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-400 dark:text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800'}`}>
                        <X size={20} />
                    </button>
                </div>

                {/* --- CUERPO SCROLLABLE --- */}
                <div className="p-5 md:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar will-change-scroll bg-slate-50/50 dark:bg-slate-900/50 relative z-0">
                    
                    {/* INFO Y MULTIMEDIA */}
                    <div className="bg-white dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                        <h4 className="font-bold text-slate-800 dark:text-slate-300 mb-4 text-xs uppercase tracking-widest flex items-center">
                            Información Base
                            <span className="flex-1 h-px bg-slate-100 dark:bg-slate-700/50 ml-3"></span>
                        </h4>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-4">
                            <div className="lg:col-span-3 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Nombre del Producto</label>
                                    <input className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg focus:border-indigo-400 dark:focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 dark:text-white transition-all disabled:opacity-50" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} disabled={isSaving || isAddingVariant} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Categoría</label>
                                        <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg focus:border-indigo-400 dark:focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50 cursor-pointer" value={formData.categoria_id || ''} onChange={e => setFormData({ ...formData, categoria_id: e.target.value })} disabled={isSaving || isAddingVariant}>
                                            <option value="">Seleccionar...</option>
                                            {categories?.map(cat => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Plantilla TN</label>
                                        <select className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg focus:border-indigo-400 dark:focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 dark:text-slate-300 transition-all disabled:opacity-50 cursor-pointer" value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} disabled={isSaving || isAddingVariant}>
                                            <option value="">(Genérica)</option>
                                            <option value="Camisetas Nacionales">Camisetas Nacionales</option>
                                            <option value="Camisetas Retro">Camisetas Retro</option>
                                            <option value="Camisetas G5 Importadas">Camisetas G5</option>
                                            <option value="Conjuntos">Conjuntos</option>
                                            <option value="Buzos">Buzos</option>
                                            <option value="Camperas">Camperas</option>
                                            <option value="Pantalones Largos">Pantalones</option>
                                            <option value="Shorts">Shorts</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Precio de Venta</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-emerald-600 dark:text-emerald-500 font-bold">$</span>
                                        <input className="w-full border border-slate-200 dark:border-slate-700 pl-8 p-2.5 rounded-lg focus:border-emerald-500 dark:focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 text-sm font-bold text-emerald-700 dark:text-emerald-400 transition-all disabled:opacity-50" type="number" value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value })} disabled={isSaving || isAddingVariant} />
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 block text-center">Foto Principal</label>
                                <div className={`w-28 h-28 mb-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center relative group transition-all ${isSaving || isAddingVariant ? 'opacity-50' : 'hover:border-indigo-400 dark:hover:border-indigo-500'}`}>
                                    {newImageFile ? <img src={URL.createObjectURL(newImageFile)} className="w-full h-full object-cover" /> : currentImage ? <img src={`/api/static/uploads/${currentImage}`} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300 dark:text-slate-600" size={32} />}
                                    {!isSaving && !isAddingVariant && (
                                        <label htmlFor="imageUploadEdit" className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                                            <ImageIcon size={20} className="mb-1" />
                                            <span className="text-[9px] font-bold uppercase tracking-wider">Cambiar</span>
                                        </label>
                                    )}
                                </div>
                                <input type="file" id="imageUploadEdit" accept="image/*" className="hidden" disabled={isSaving || isAddingVariant} onChange={(e) => e.target.files[0] && setNewImageFile(e.target.files[0])} />
                            </div>
                        </div>

                        <button onClick={handleUpdateInfo} disabled={isSaving || isAddingVariant} className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all shadow-sm active:scale-[0.99] tracking-wide ${isSaving ? 'bg-indigo-400 dark:bg-indigo-800 text-white cursor-wait' : 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'}`}>
                            {isSaving ? <><Loader2 size={18} className="mr-2 animate-spin" /> Guardando...</> : <><Save size={16} className="mr-2" /> Actualizar Datos Base</>}
                        </button>
                    </div>

                    {/* TALLES Y VARIANTES */}
                    <div className={`bg-white dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm transition-opacity duration-300 ${isSaving || isAddingVariant ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-300 text-xs uppercase tracking-widest">Variantes y Stock</h4>
                            <button onClick={refreshLocalData} className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md" title="Refrescar lista desde la Base de Datos">
                                <RefreshCw size={12} className={`mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Sincronizar
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 mb-5 bg-slate-50/50 dark:bg-slate-900">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-widest border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="p-3">Talle</th>
                                        <th className="p-3">Estampa / Jugador</th>
                                        <th className="p-3">SKU Nube</th>
                                        <th className="p-3 text-center">Stock</th>
                                        <th className="p-3 text-right">Borrar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variants.map((v) => (
                                        <VariantRow
                                            key={v.id_variante}
                                            v={v}
                                            onUpdateVariant={handleUpdateVariant}
                                            onDeleteVariant={handleDeleteVariant}
                                        />
                                    ))}
                                    {variants.length === 0 && (
                                        <tr><td colSpan="5" className="p-6 text-center text-slate-400 text-xs italic">No hay variantes cargadas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* PANEL DE AGREGAR VARIANTE */}
                        <div className={`bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex flex-wrap items-end gap-4 relative overflow-hidden transition-all ${isAddingVariant ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`}>

                            {isAddingVariant && (
                                <div className="absolute inset-0 z-10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                                    <div className="flex items-center text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/50 px-4 py-2 rounded-full shadow-sm border border-emerald-200 dark:border-emerald-800 uppercase tracking-widest text-[10px]">
                                        <Loader2 size={14} className="animate-spin mr-2" />
                                        Subiendo a Tienda Nube...
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Nuevo Talle/Curva</label>
                                <select disabled={isAddingVariant} className="border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-sm w-40 font-medium text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-400 dark:focus:border-emerald-500 bg-white dark:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer" value={newSize} onChange={e => setNewSize(e.target.value)}>
                                    <optgroup label="⚡ Crear Curva Completa">
                                        <option value="S,M,L,XL,XXL">ADULTOS (S al XXL)</option>
                                        <option value="4,6,8,10,12,14,16">NIÑOS (4 al 16)</option>
                                        <option value="0,1,2,3,4,5">BEBÉS (0 al 5)</option>
                                    </optgroup>
                                    <optgroup label="👕 Talles Individuales">
                                        {['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6', '8', '10', '12', '14', '16', 'U'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Estampa (Opcional)</label>
                                {/* DOBLE CANDADO VISUAL: onChange fuerza a mayúsculas mientras el usuario escribe */}
                                <input type="text" disabled={isAddingVariant} placeholder="Ej: MESSI 10" className="border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-sm w-full font-medium text-slate-700 dark:text-white outline-none focus:border-emerald-400 dark:focus:border-emerald-500 bg-white dark:bg-slate-800 transition-all disabled:opacity-50 uppercase placeholder-slate-300 dark:placeholder-slate-600" value={newEstampa} onChange={e => setNewEstampa(e.target.value.toUpperCase())} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Stock</label>
                                <input type="number" disabled={isAddingVariant} className="border border-slate-200 dark:border-slate-700 p-2 rounded-lg text-sm w-20 text-center font-bold text-slate-700 dark:text-white outline-none focus:border-emerald-400 dark:focus:border-emerald-500 bg-white dark:bg-slate-800 transition-all disabled:opacity-50" value={newStock} onChange={e => setNewStock(e.target.value)} />
                            </div>
                            <button
                                onClick={handleAddVariant}
                                disabled={isAddingVariant}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ml-auto active:scale-95 ${isAddingVariant ? 'bg-emerald-400 text-emerald-50 cursor-wait' : 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50'}`}
                            >
                                {isAddingVariant ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} className="mr-1" /> Añadir</>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- FOOTER SÓLIDO (Cubre todo al scrollear) --- */}
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0 z-10 relative">
                    <button onClick={onClose} disabled={isSaving || isAddingVariant} className={`px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-all ${isSaving || isAddingVariant ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm'}`}>Cerrar Ventana</button>
                </div>
            </div>
        </div>
    );
};

export default EditProductModal;