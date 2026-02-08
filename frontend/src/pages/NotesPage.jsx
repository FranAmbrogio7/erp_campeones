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
            // Optimistic UI Update
            setNotes(prev => prev.map(n => n.id === id ? { ...n, completada: !currentStatus } : n));
            await api.put(`/notes/${id}`, { completada: !currentStatus });
        } catch (e) {
            fetchNotes(); // Revertir si falla
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Borrar nota?")) return;
        try {
            setNotes(prev => prev.filter(n => n.id !== id));
            await api.delete(`/notes/${id}`);
            toast.success("Nota eliminada");
        } catch (e) { fetchNotes(); }
    };

    const activeNotes = notes.filter(n => !n.completada);
    const completedNotes = notes.filter(n => n.completada);

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
            <Toaster position="top-center" />

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-800 dark:text-white flex items-center">
                        <StickyNote className="mr-2 text-yellow-500" /> Notas y Recordatorios
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Organiza tareas pendientes del local.</p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-3xl font-black text-slate-200 dark:text-slate-800">{activeNotes.length}</p>
                    <p className="text-xs font-bold text-gray-400 dark:text-slate-600 uppercase">Pendientes</p>
                </div>
            </div>

            {/* INPUT AREA */}
            <form onSubmit={handleAdd} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-start transition-colors">
                <div className="flex-1 w-full">
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Escribe una nueva nota..."
                        className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 text-gray-700 dark:text-white resize-none transition-colors"
                        rows="2"
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAdd(e); }}
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => setIsUrgent(!isUrgent)}
                        className={`flex-1 md:flex-none p-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center ${isUrgent ? 'border-red-400 bg-red-50 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                        title="Marcar como Urgente"
                    >
                        <AlertCircle size={20} className={isUrgent ? "animate-pulse" : ""} />
                        <span className="ml-2 md:hidden">Urgente</span>
                    </button>
                    <button
                        type="submit"
                        disabled={!newContent.trim()}
                        className="flex-1 md:flex-none bg-slate-900 dark:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-black dark:hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus size={20} className="mr-2" /> Agregar
                    </button>
                </div>
            </form>

            {/* LISTA DE NOTAS */}
            {loading ? (
                <div className="text-center py-10 text-gray-400 animate-pulse">Cargando notas...</div>
            ) : (
                <div className="space-y-8">
                    {/* ACTIVAS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeNotes.map(note => (
                            <div
                                key={note.id}
                                className={`p-5 rounded-2xl shadow-sm border transition-all hover:shadow-md group relative ${note.importante
                                    ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-700/50'
                                    : 'bg-white border-gray-200 dark:bg-slate-800 dark:border-slate-700'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        {note.importante && <Star size={16} className="text-yellow-500 fill-yellow-500" />}
                                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 flex items-center">
                                            <Calendar size={10} className="mr-1" /> {note.fecha}
                                        </span>
                                    </div>
                                    <button onClick={() => toggleStatus(note.id, note.completada)} className="text-gray-300 dark:text-slate-600 hover:text-green-500 dark:hover:text-green-400 transition-colors">
                                        <Square size={22} />
                                    </button>
                                </div>
                                <p className={`text-sm font-medium leading-relaxed whitespace-pre-wrap ${note.importante ? 'text-yellow-900 dark:text-yellow-100' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {note.contenido}
                                </p>
                                <button
                                    onClick={() => handleDelete(note.id)}
                                    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 dark:text-red-900 dark:hover:text-red-400 transition-all p-2"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {activeNotes.length === 0 && (
                        <div className="text-center py-12 text-gray-300 dark:text-slate-600">
                            <CheckSquare size={48} className="mx-auto mb-2 opacity-50" />
                            <p>¡Todo al día! No hay notas pendientes.</p>
                        </div>
                    )}

                    {/* COMPLETADAS */}
                    {completedNotes.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-slate-800 pb-2">Completadas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60 hover:opacity-100 transition-opacity">
                                {completedNotes.map(note => (
                                    <div key={note.id} className="bg-gray-100 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 flex justify-between items-center transition-colors">
                                        <div>
                                            <p className="text-gray-500 dark:text-slate-500 line-through text-sm">{note.contenido}</p>
                                            <span className="text-[10px] text-gray-400 dark:text-slate-600">{note.fecha}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => toggleStatus(note.id, note.completada)} title="Reactivar">
                                                <CheckSquare size={18} className="text-green-600 dark:text-green-500" />
                                            </button>
                                            <button onClick={() => handleDelete(note.id)} className="text-gray-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400">
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