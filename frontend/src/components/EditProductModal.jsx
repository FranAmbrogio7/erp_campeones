import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
// 1. IMPORTAMOS EL ICONO LOADER2
import { X, Save, Trash2, Plus, Image as ImageIcon, Shirt, Loader2 } from 'lucide-react';

const EditProductModal = ({ isOpen, onClose, product, onUpdate, categories, specificCategories }) => {
    const { token } = useAuth();

    // Estado para datos generales
    const [formData, setFormData] = useState({
        nombre: '',
        precio: '',
        categoria_id: '',
        categoria_especifica_id: ''
    });

    // Estado para la NUEVA imagen seleccionada
    const [newImageFile, setNewImageFile] = useState(null);
    // Estado para la imagen ACTUAL (preview)
    const [currentImage, setCurrentImage] = useState(null);

    const [variants, setVariants] = useState([]);
    const [newSize, setNewSize] = useState('M');
    const [newStock, setNewStock] = useState(0);

    // 2. NUEVO ESTADO PARA CONTROLAR LA CARGA
    const [isSaving, setIsSaving] = useState(false);

    // Cargar datos al abrir
    useEffect(() => {
        if (product && isOpen) {
            setFormData({
                nombre: product.nombre || '',
                precio: product.precio || '',
                categoria_id: product.categoria_id || '',
                categoria_especifica_id: product.categoria_especifica_id || ''
            });
            setCurrentImage(product.imagen);
            setNewImageFile(null);
            setVariants(product.variantes.map(v => ({ ...v })));
            setIsSaving(false); // Reseteamos el estado de carga al abrir
        }
    }, [product, isOpen]);

    if (!isOpen || !product) return null;

    // --- 1. GUARDAR DATOS GENERALES E IMAGEN (CON FEEDBACK) ---
    const handleUpdateInfo = async () => {
        // A. ACTIVAMOS MODO CARGANDO
        setIsSaving(true);

        try {
            const dataToSend = new FormData();
            dataToSend.append('nombre', formData.nombre);
            dataToSend.append('precio', formData.precio);
            dataToSend.append('categoria_id', formData.categoria_id);
            dataToSend.append('categoria_especifica_id', formData.categoria_especifica_id);

            if (newImageFile) {
                dataToSend.append('imagen', newImageFile);
            }

            await axios.put(`http://localhost:5000/api/products/${product.id}`, dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Feedback opcional (puedes cambiar alert por toast si lo usas aquí)
            // alert('Información e imagen actualizadas'); 

            onUpdate();
            onClose();
            // Nota: No hace falta setIsSaving(false) aquí porque el componente se desmonta al cerrar.

        } catch (e) {
            // B. SI FALLA, DESACTIVAMOS MODO CARGANDO PARA QUE PUEDA REINTENTAR
            setIsSaving(false);
            alert("Error actualizando producto: " + (e.response?.data?.msg || e.message));
        }
    };

    // --- 2. ACTUALIZAR STOCK ---
    const handleUpdateVariant = async (variantId, newStock, newSku) => {
        try {
            await axios.put(`http://localhost:5000/api/products/variants/${variantId}`,
                { stock: newStock, sku: newSku },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) { console.error("Error updating variant", e); }
    };

    // --- 3. AGREGAR VARIANTE ---
    const handleAddVariant = async () => {
        try {
            await axios.post(`http://localhost:5000/api/products/variants`, {
                id_producto: product.id, talla: newSize, stock: newStock
            }, { headers: { Authorization: `Bearer ${token}` } });
            onUpdate(); setNewStock(0); onClose();
        } catch (e) { alert("Error: " + (e.response?.data?.msg || "Error al agregar")); }
    };

    // --- 4. BORRAR VARIANTE ---
    const handleDeleteVariant = async (id) => {
        if (!window.confirm("¿Borrar este talle?")) return;
        try {
            await axios.delete(`http://localhost:5000/api/products/variants/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVariants(prev => prev.filter(v => v.id_variante !== id));
            onUpdate();
        } catch (e) { alert("Error borrando"); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center">
                        <Shirt className="mr-2 text-blue-600" /> Editar Producto: {product.nombre}
                    </h3>
                    {/* Bloqueamos el botón cerrar si está guardando */}
                    <button
                        onClick={!isSaving ? onClose : undefined}
                        className={`transition-colors bg-white rounded-full p-1 shadow-sm border
                ${isSaving ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-500 hover:shadow'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">

                    {/* SECCIÓN 1: INFORMACIÓN BÁSICA E IMAGEN */}
                    <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-4 text-sm uppercase tracking-wider border-b border-blue-200 pb-2">Información y Multimedia</h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 animate-fade-in-down">
                            {/* Columna Izquierda: Datos */}
                            <div className="md:col-span-2 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nombre del Producto</label>
                                    <input className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium text-slate-700"
                                        value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} disabled={isSaving} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoría</label>
                                        <select className="w-full border border-slate-300 p-2.5 rounded-lg outline-none bg-white"
                                            value={formData.categoria_id || ''} onChange={e => setFormData({ ...formData, categoria_id: e.target.value })} disabled={isSaving}>
                                            <option value="">Seleccionar...</option>
                                            {categories?.map(cat => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cat. Específica</label>
                                        <select className="w-full border border-slate-300 p-2.5 rounded-lg outline-none bg-white"
                                            value={formData.categoria_especifica_id || ''} onChange={e => setFormData({ ...formData, categoria_especifica_id: e.target.value })} disabled={isSaving}>
                                            <option value="">(Ninguna)</option>
                                            {specificCategories?.map(cat => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Precio de Venta</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span>
                                        <input className="w-full border border-slate-300 pl-8 p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white font-bold text-green-700" type="number"
                                            value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value })} disabled={isSaving} />
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: Imagen */}
                            <div className="md:col-span-1 flex flex-col items-center justify-start p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block w-full text-center">Imagen Actual</label>

                                {/* Preview */}
                                <div className={`w-32 h-32 mb-4 rounded-lg border-2 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center relative group ${isSaving ? 'opacity-50' : ''}`}>
                                    {newImageFile ? (
                                        <img src={URL.createObjectURL(newImageFile)} alt="Nueva" className="w-full h-full object-cover" />
                                    ) : currentImage ? (
                                        <img src={`http://localhost:5000/static/uploads/${currentImage}`} alt="Actual" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Error'; }} />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={40} />
                                    )}

                                    {!isSaving && (
                                        <label htmlFor="imageUploadEdit" className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            <ImageIcon size={24} className="mb-1" />
                                            <span className="text-[10px] font-bold uppercase">Cambiar Foto</span>
                                        </label>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    id="imageUploadEdit"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={isSaving}
                                    onChange={(e) => {
                                        if (e.target.files[0]) setNewImageFile(e.target.files[0]);
                                    }}
                                />

                                {newImageFile && <p className="text-[10px] text-blue-600 truncate w-full text-center">{newImageFile.name}</p>}
                                <p className="text-[10px] text-slate-400 text-center mt-2">Click en la imagen para cambiar</p>
                            </div>
                        </div>

                        {/* 3. BOTÓN CON FEEDBACK VISUAL DE CARGA */}
                        <button
                            onClick={handleUpdateInfo}
                            disabled={isSaving}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center transition-all shadow-md 
                    ${isSaving
                                    ? 'bg-blue-400 text-blue-50 cursor-wait' // Estilos al cargar
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:scale-95' // Estilos normales
                                }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    Guardando cambios...
                                </>
                            ) : (
                                <>
                                    <Save size={18} className="mr-2" />
                                    Guardar Cambios e Imagen
                                </>
                            )}
                        </button>
                    </div>

                    {/* SECCIÓN 2: VARIANTES (STOCK) */}
                    <div className={`bg-slate-50 p-5 rounded-xl border border-slate-200 ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider border-b border-slate-200 pb-2">Gestión de Talles y Stock</h4>

                        <table className="w-full text-sm text-left mb-4">
                            <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3 rounded-l-lg">Talle</th>
                                    <th className="p-3">SKU (Código)</th>
                                    <th className="p-3">Stock Físico</th>
                                    <th className="p-3 text-right rounded-r-lg">Eliminar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {variants.map((v) => (
                                    <tr key={v.id_variante} className="hover:bg-white transition-colors">
                                        <td className="p-3 font-black text-slate-700">{v.talle}</td>
                                        <td className="p-3">
                                            <input className="border border-slate-300 p-1.5 rounded-md w-full md:w-32 text-xs font-mono uppercase focus:ring-2 focus:ring-blue-400 outline-none"
                                                defaultValue={v.sku} onBlur={(e) => handleUpdateVariant(v.id_variante, v.stock, e.target.value)} />
                                        </td>
                                        <td className="p-3">
                                            <input type="number" className={`border p-1.5 rounded-md w-20 text-center font-bold focus:ring-2 outline-none ${v.stock < 2 ? 'border-red-300 text-red-600 focus:ring-red-400' : 'border-slate-300 text-slate-700 focus:ring-blue-400'}`}
                                                defaultValue={v.stock} onBlur={(e) => handleUpdateVariant(v.id_variante, e.target.value, v.sku)} />
                                        </td>
                                        <td className="p-3 text-right">
                                            <button onClick={() => handleDeleteVariant(v.id_variante)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="bg-white p-3 rounded-lg border-2 border-dashed border-slate-300 flex flex-wrap items-end gap-3 animate-fade-in">
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">Nuevo Talle</label>
                                <select className="border border-slate-300 p-2 rounded-md text-sm w-24 font-bold text-slate-700 outline-none" value={newSize} onChange={e => setNewSize(e.target.value)}>
                                    {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4', '6', '8', '10', '12', '14', '16'].map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">Stock Inicial</label>
                                <input type="number" className="border border-slate-300 p-2 rounded-md text-sm w-24 font-bold text-slate-700 outline-none" value={newStock} onChange={e => setNewStock(e.target.value)} />
                            </div>
                            <button onClick={handleAddVariant} className="bg-green-500 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-green-600 flex items-center h-10 shadow-sm hover:shadow transition-all active:scale-95 ml-auto">
                                <Plus size={16} className="mr-1" /> Agregar Variante
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className={`px-6 py-2.5 border rounded-lg font-bold transition-colors
                ${isSaving ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                    >
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditProductModal;