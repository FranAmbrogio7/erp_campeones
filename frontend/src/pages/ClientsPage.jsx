import { useState, useEffect, useMemo } from 'react';
import { useAuth, api } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import {
    Users, Search, Plus, Edit, Trash2, MapPin,
    Phone, FileText, X, IdCard, Mail
} from 'lucide-react';

const ClientsPage = () => {
    const { token } = useAuth();

    // --- ESTADOS ---
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // --- ESTADOS DEL MODAL ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [formData, setFormData] = useState({
        nombre: '',
        dni: '',
        telefono: '',
        email: '',
        localidad: '',
        direccion: '',
        observaciones: ''
    });

    // --- CARGAR CLIENTES ---
    const fetchClients = async () => {
        setLoading(true);
        try {
            const res = await api.get('/clients');
            setClients(res.data);
        } catch (error) {
            console.error("Error cargando clientes:", error);
            toast.error("Error al cargar la lista de clientes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchClients();
    }, [token]);

    // --- FILTRADO LOCAL ---
    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        const term = searchTerm.toLowerCase();
        return clients.filter(c =>
            (c.nombre || '').toLowerCase().includes(term) ||
            (c.dni || '').toLowerCase().includes(term) ||
            (c.telefono || '').toLowerCase().includes(term) ||
            (c.localidad || '').toLowerCase().includes(term)
        );
    }, [clients, searchTerm]);

    // --- MANEJO DEL FORMULARIO ---
    const handleOpenModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                nombre: client.nombre || '',
                dni: client.dni || '',
                telefono: client.telefono || '',
                email: client.email || '',
                localidad: client.localidad || '',
                direccion: client.direccion || '',
                observaciones: client.observaciones || ''
            });
        } else {
            setEditingClient(null);
            setFormData({ nombre: '', dni: '', telefono: '', email: '', localidad: '', direccion: '', observaciones: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }

        const toastId = toast.loading(editingClient ? "Actualizando..." : "Guardando...");
        try {
            if (editingClient) {
                await api.put(`/clients/${editingClient.id_cliente}`, formData);
                toast.success("Cliente actualizado", { id: toastId });
            } else {
                await api.post('/clients', formData);
                toast.success("Cliente creado", { id: toastId });
            }
            setIsModalOpen(false);
            fetchClients();
        } catch (error) {
            toast.error(error.response?.data?.msg || "Error al guardar", { id: toastId });
        }
    };

    const handleDelete = async (id, nombre) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${nombre}? Esta acción no se puede deshacer.`)) return;

        try {
            await api.delete(`/clients/${id}`);
            toast.success("Cliente eliminado");
            fetchClients();
        } catch (error) {
            toast.error("Error al eliminar el cliente");
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 max-w-[1400px] mx-auto gap-4 bg-gray-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
            <Toaster position="top-center" />

            {/* --- HEADER Y BUSCADOR --- */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 shrink-0 transition-colors flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 dark:text-white">Directorio de Clientes</h1>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{clients.length} clientes registrados</p>
                    </div>
                </div>

                <div className="flex flex-1 w-full md:max-w-md gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, DNI, teléfono..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-900 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all font-medium text-sm dark:text-white"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 shrink-0"
                    >
                        <Plus size={18} className="mr-1" /> Nuevo
                    </button>
                </div>
            </div>

            {/* --- TABLA DE CLIENTES --- */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden transition-colors">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Nombre / DNI</th>
                                <th className="px-6 py-4">Contacto</th>
                                <th className="px-6 py-4">Ubicación</th>
                                <th className="px-6 py-4">Observaciones</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic">Cargando directorio...</td></tr>
                            ) : filteredClients.length === 0 ? (
                                <tr><td colSpan="5" className="p-10 text-center text-gray-400 italic">No se encontraron clientes.</td></tr>
                            ) : (
                                filteredClients.map(c => (
                                    <tr key={c.id_cliente} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 dark:text-white text-base">{c.nombre}</div>
                                            {c.dni && <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center"><IdCard size={12} className="mr-1" /> {c.dni}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.telefono && <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center mb-1"><Phone size={14} className="mr-2 text-gray-400" /> {c.telefono}</div>}
                                            {c.email && <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center"><Mail size={12} className="mr-2" /> {c.email}</div>}
                                            {!c.telefono && !c.email && <span className="text-gray-300 dark:text-slate-600 text-xs italic">-</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.localidad && <div className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1 flex items-center"><MapPin size={14} className="mr-1 text-red-400" /> {c.localidad}</div>}
                                            {c.direccion && <div className="text-xs text-gray-500 dark:text-slate-400">{c.direccion}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate" title={c.observaciones}>
                                                {c.observaciones || <span className="text-gray-300 dark:text-slate-600 italic">Sin observaciones</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenModal(c)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors" title="Editar">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(c.id_cliente, c.nombre)} className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-1" title="Eliminar">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL CREAR / EDITAR CLIENTE --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col transition-colors" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center">
                                {editingClient ? <Edit className="mr-2 text-blue-500" /> : <Plus className="mr-2 text-blue-500" />}
                                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 p-1"><X size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Nombre Completo *</label>
                                    <input autoFocus required type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="Ej: Juan Pérez" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">DNI / CUIT</label>
                                    <input type="text" value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="Ej: 35123456" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Teléfono</label>
                                    <input type="text" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="Ej: 351 123 4567" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Email</label>
                                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="correo@ejemplo.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Localidad / Ciudad</label>
                                    <input type="text" value={formData.localidad} onChange={e => setFormData({ ...formData, localidad: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="Ej: Córdoba Capital" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1">Dirección</label>
                                    <input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" placeholder="Ej: San Martín 123" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-1 flex items-center"><FileText size={14} className="mr-1" /> Observaciones / Notas</label>
                                <textarea rows="3" value={formData.observaciones} onChange={e => setFormData({ ...formData, observaciones: e.target.value })} className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white font-medium resize-none custom-scrollbar" placeholder="Talles preferidos, compras habituales, etc..."></textarea>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-700 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                                    {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsPage;