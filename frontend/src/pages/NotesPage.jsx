import { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';
import {
    Plus, Trash2, CheckSquare, Square, Star,
    StickyNote, AlertCircle, Calendar
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const NotesPage = () => {
    const [notes, setNotes] = useState([]);
    const [newContent, setNewContent] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await api.get('/notes/');
            setNotes(res.data);
        } catch (error) {
            console.error("Error cargando notas");
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newContent.trim()) return;

        try {
            const res = await api.post('/notes/', {
                contenido: newContent,
                importante: isUrgent
            });
            setNotes([res.data, ...notes]);
            setNewContent('');
            setIsUrgent(false);
            toast.success("Nota agregada");
        } catch (error) {
            toast.error("Error al guardar");
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            // Optimistic UI Update (Actualizamos visualmente antes de esperar al server)
            setNotes(notes.map(n => n.id === id ? { ...n, completada: !currentStatus } : n));
            await api.put(`/notes/${id}`, { completada: !currentStatus });
        } catch (error) {
            toast.error("Error de conexión");
            fetchNotes(); // Revertir si falla
        }
    };

    const toggleImportant = async (id, currentStatus) => {
        try {
            setNotes(notes.map(n => n.id === id ? { ...n, importante: !currentStatus } : n));
            await api.put(`/notes/${id}`, { importante: !currentStatus });
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Borrar esta nota?")) return;
        try {
            setNotes(notes.filter(n => n.id !== id));
            await api.delete(`/notes/${id}`);
            toast.success("Nota eliminada");
        } catch (error) {
            toast.error("No se pudo borrar");
        }
    };

    // Separamos las pendientes de las completadas para visualización
    const activeNotes = notes.filter(n => !n.completada);
    const completedNotes = notes.filter(n => n.completada);

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen bg-gray-50">
            <Toaster position="top-center" />

            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                        <StickyNote className="text-yellow-500" size={32} />
                        Tablero de Notas
                    </h1>
                    <p className="text-gray-500 mt-1">Recordatorios, faltantes de stock y novedades de caja.</p>
                </div>
            </div>

            {/* INPUT CREAR NOTA */}
            <form onSubmit={handleAdd} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center transition-all focus-within:ring-2 ring-blue-100">
                <div className="flex-1 w-full">
                    <input
                        type="text"
                        placeholder="Escribe una nueva nota aquí... (Ej: Comprar cinta, Faltan $500 en caja)"
                        className="w-full text-lg outline-none placeholder-gray-400 text-gray-700 bg-transparent"
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setIsUrgent(!isUrgent)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all
                            ${isUrgent
                                ? 'bg-red-100 text-red-600 border border-red-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        {isUrgent ? <AlertCircle size={16} /> : <Star size={16} />}
                        {isUrgent ? 'Urgente' : 'Normal'}
                    </button>

                    <button
                        type="submit"
                        disabled={!newContent.trim()}
                        className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={20} /> Agregar
                    </button>
                </div>
            </form>

            {/* LISTA DE NOTAS */}
            {loading ? (
                <div className="text-center py-20 text-gray-400">Cargando tablero...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                    {/* NOTAS ACTIVAS */}
                    {activeNotes.map(note => (
                        <div
                            key={note.id}
                            className={`p-5 rounded-2xl shadow-sm border-l-8 transition-all hover:shadow-md relative group bg-white
                                ${note.importante ? 'border-l-red-500' : 'border-l-yellow-400'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                    <Calendar size={10} /> {note.fecha}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleImportant(note.id, note.importante)}
                                        className={`p-1.5 rounded-full hover:bg-gray-100 ${note.importante ? 'text-yellow-500' : 'text-gray-300'}`}
                                        title="Marcar Importante"
                                    >
                                        <Star size={16} fill={note.importante ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(note.id)}
                                        className="p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <p className="text-gray-800 font-medium text-lg leading-snug mb-4">
                                {note.contenido}
                            </p>

                            <button
                                onClick={() => toggleStatus(note.id, note.completada)}
                                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-green-600 transition-colors"
                            >
                                <Square size={20} /> Marcar como Listo
                            </button>
                        </div>
                    ))}

                    {/* MENSAJE SI NO HAY NOTAS */}
                    {activeNotes.length === 0 && completedNotes.length === 0 && (
                        <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed">
                            <StickyNote size={48} className="mx-auto mb-2 opacity-20" />
                            <p>No hay notas pendientes. ¡Todo en orden!</p>
                        </div>
                    )}

                    {/* SECCIÓN COMPLETADAS (Si existen) */}
                    {completedNotes.length > 0 && (
                        <div className="col-span-full mt-8">
                            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                                <CheckSquare size={16} /> Completadas ({completedNotes.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                                {completedNotes.map(note => (
                                    <div key={note.id} className="bg-gray-100 p-4 rounded-xl border border-gray-200 flex justify-between items-center">
                                        <div>
                                            <p className="text-gray-500 line-through text-sm">{note.contenido}</p>
                                            <span className="text-[10px] text-gray-400">{note.fecha}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => toggleStatus(note.id, note.completada)} title="Reactivar">
                                                <CheckSquare size={18} className="text-green-600" />
                                            </button>
                                            <button onClick={() => handleDelete(note.id)} className="text-gray-400 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotesPage;