import { useEffect, useState } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Tags, Plus, Trash2, Edit2, Save, X, Layers } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const CategoriesPage = () => {
    const { token } = useAuth();

    // Estados
    const [generalCats, setGeneralCats] = useState([]);
    const [specificCats, setSpecificCats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Inputs para crear
    const [newGeneral, setNewGeneral] = useState('');
    const [newSpecific, setNewSpecific] = useState('');

    // Estado para edición { id: 1, type: 'general', value: 'Nombre' }
    const [editing, setEditing] = useState(null);

    // --- CARGA DE DATOS ---
    const fetchData = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const [resGen, resSpec] = await Promise.all([
                api.get('/products/categories', config),
                api.get('/products/specific-categories', config)
            ]);
            setGeneralCats(resGen.data);
            setSpecificCats(resSpec.data);
        } catch (e) { toast.error("Error cargando datos"); }
        finally { setLoading(false); }
    };

    useEffect(() => { if (token) fetchData(); }, [token]);

    // --- ACCIONES GENERALES ---
    const handleCreate = async (type) => {
        const isGen = type === 'general';
        const name = isGen ? newGeneral : newSpecific;
        if (!name.trim()) return;

        try {
            const endpoint = isGen ? '/products/categories' : '/products/specific-categories';
            await api.post(endpoint, { nombre: name });
            toast.success("Creado");
            isGen ? setNewGeneral('') : setNewSpecific('');
            fetchData();
        } catch (e) { toast.error("Error al crear"); }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm("¿Eliminar? Si tiene productos asociados, podría dar error.")) return;
        try {
            const endpoint = type === 'general' ? `/products/categories/${id}` : `/products/specific-categories/${id}`;
            await api.delete(endpoint);
            toast.success("Eliminado");
            fetchData();
        } catch (e) { toast.error("No se pudo eliminar"); }
    };

    const handleUpdate = async (type) => {
        if (!editing.value.trim()) return;
        try {
            const endpoint = type === 'general' ? `/products/categories/${editing.id}` : `/products/specific-categories/${editing.id}`;
            await api.put(endpoint, { nombre: editing.value });
            toast.success("Actualizado");
            setEditing(null);
            fetchData();
        } catch (e) { toast.error("Error al actualizar"); }
    };

    // --- RENDERIZADO DE LISTA ---
    const renderList = (items, type) => (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
            {items.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl shadow-sm hover:shadow-md transition-all group">
                    {editing?.id === item.id && editing?.type === type ? (
                        <div className="flex gap-2 flex-1 mr-2">
                            <input
                                autoFocus
                                className="flex-1 border dark:border-slate-500 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-white p-1.5 rounded-lg text-sm outline-none"
                                value={editing.value}
                                onChange={e => setEditing({ ...editing, value: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && handleUpdate(type)}
                            />
                            <button onClick={() => handleUpdate(type)} className="text-green-600 dark:text-green-400 p-1 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"><Save size={16} /></button>
                            <button onClick={() => setEditing(null)} className="text-red-500 dark:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><X size={16} /></button>
                        </div>
                    ) : (
                        <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{item.nombre}</span>
                    )}

                    {!editing && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditing({ id: item.id, type, value: item.nombre })} className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(type, item.id)} className="p-1.5 text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                    )}
                </div>
            ))}
            {items.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4 italic">Sin registros</p>}
        </div>
    );

    if (loading) return <div className="p-10 text-center text-gray-400 animate-pulse">Cargando...</div>;

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
            <Toaster position="top-center" />

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6 transition-colors">
                <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center">
                    <Layers className="mr-3 text-blue-600 dark:text-blue-400" /> Administración de Categorías
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Organiza cómo se clasifican y filtran tus productos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PANEL 1: CATEGORÍAS GENERALES */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <h2 className="text-lg font-bold text-gray-700 dark:text-white flex items-center"><Layers className="mr-2 text-blue-500" size={20} /> Categorías Generales</h2>
                    </div>

                    {/* Form Crear */}
                    <div className="flex gap-2 mb-4">
                        <input
                            placeholder="Nueva Categoría (Ej: Remeras)"
                            className="flex-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white p-2 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                            value={newGeneral} onChange={e => setNewGeneral(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate('general')}
                        />
                        <button onClick={() => handleCreate('general')} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg shadow transition-colors"><Plus /></button>
                    </div>

                    {renderList(generalCats, 'general')}
                </div>

                {/* PANEL 2: LIGAS / ESPECÍFICAS */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <h2 className="text-lg font-bold text-gray-700 dark:text-white flex items-center"><Tags className="mr-2 text-purple-500" size={20} /> Ligas / Específicas</h2>
                    </div>

                    {/* Form Crear */}
                    <div className="flex gap-2 mb-4">
                        <input
                            placeholder="Nueva Liga (Ej: Bundesliga)"
                            className="flex-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white p-2 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-500 outline-none transition-colors"
                            value={newSpecific} onChange={e => setNewSpecific(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate('specific')}
                        />
                        <button onClick={() => handleCreate('specific')} className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg shadow transition-colors"><Plus /></button>
                    </div>

                    {renderList(specificCats, 'specific')}
                </div>

            </div>
        </div>
    );
};

export default CategoriesPage;