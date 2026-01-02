import { useState, useEffect, useRef } from 'react';
import { api } from '../context/AuthContext';
import { FileText, CheckCircle, XCircle, Search, Plus, Save, X, Printer } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CreditNoteTicket from '../components/CreditNoteTicket'; // Asegúrate de que este componente exista en la ruta

const CreditNotesPage = () => {
    const [notas, setNotas] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estado del Formulario
    const [formData, setFormData] = useState({ monto: '', observaciones: '' });
    const [loading, setLoading] = useState(false);

    // --- LÓGICA DE IMPRESIÓN (Idéntica a SalesHistoryPage) ---
    const [printData, setPrintData] = useState(null);
    const ticketRef = useRef(null);

    const reactToPrintFn = useReactToPrint({
        contentRef: ticketRef,
    });

    const handleReprint = (nota) => {
        // 1. Guardamos los datos de la nota a imprimir
        setPrintData(nota);

        // 2. Esperamos un instante a que React renderice el componente oculto
        setTimeout(() => {
            if (reactToPrintFn) {
                reactToPrintFn();
            }
        }, 150);
    };
    // ---------------------------------------------------------

    useEffect(() => {
        fetchNotas();
    }, []);

    const fetchNotas = async () => {
        try {
            const res = await api.get('/sales/notas-credito');
            setNotas(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando notas");
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/sales/notas-credito/crear', {
                monto: formData.monto,
                observaciones: formData.observaciones
            });

            toast.success("Nota de Crédito Generada!");

            // Imprimir automáticamente al crear (Opcional)
            const nuevaNota = { ...res.data.nota, fecha: new Date().toLocaleDateString() };
            handleReprint(nuevaNota);

            setFormData({ monto: '', observaciones: '' });
            setIsModalOpen(false);
            fetchNotas();

        } catch (error) {
            toast.error(error.response?.data?.msg || "Error al crear nota");
        } finally {
            setLoading(false);
        }
    };

    const filtered = notas.filter(n =>
        n.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.observaciones && n.observaciones.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-4rem)] overflow-y-auto">
            <Toaster position="top-center" />

            {/* --- COMPONENTE OCULTO PARA IMPRESIÓN --- */}
            {/* Usamos position absolute para sacarlo de la vista pero mantenerlo en el DOM */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={ticketRef}>
                    <CreditNoteTicket data={printData} />
                </div>
            </div>
            {/* ---------------------------------------- */}

            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                        <FileText className="mr-3 text-blue-600" size={32} />
                        Notas de Crédito
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Administra devoluciones y saldos a favor</p>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar código..."
                            className="pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 w-full shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold flex items-center shadow-lg transition-transform active:scale-95 whitespace-nowrap"
                    >
                        <Plus size={20} className="mr-2" /> Nueva Nota
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4">Código</th>
                            <th className="p-4">Monto Original</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4">Fecha Emisión</th>
                            <th className="p-4">Motivo / Observaciones</th>
                            <th className="p-4 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map(n => (
                            <tr key={n.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 font-mono font-bold text-lg text-blue-600 select-all cursor-pointer" title="Click para copiar" onClick={() => { navigator.clipboard.writeText(n.codigo); toast.success("Código copiado") }}>
                                    {n.codigo}
                                </td>
                                <td className="p-4 font-bold text-gray-800 text-base">$ {n.monto.toLocaleString()}</td>
                                <td className="p-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1 border
                                        ${n.estado === 'activa'
                                            ? 'bg-green-100 text-green-700 border-green-200'
                                            : 'bg-gray-100 text-gray-500 line-through border-gray-200'}`}>
                                        {n.estado === 'activa' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                        {n.estado.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-500">{n.fecha}</td>
                                <td className="p-4 text-gray-500 italic max-w-xs truncate">{n.observaciones || '-'}</td>

                                {/* BOTÓN DE REIMPRIMIR */}
                                <td className="p-4 text-center">
                                    <button
                                        onClick={() => handleReprint(n)}
                                        className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-all"
                                        title="Imprimir Comprobante"
                                    >
                                        <Printer size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan="6" className="p-10 text-center text-gray-400">No se encontraron notas de crédito.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- MODAL NUEVA NOTA --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold text-gray-800 mb-1">Generar Nota de Crédito</h2>
                        <p className="text-sm text-gray-500 mb-5">Crea un saldo a favor para un cliente.</p>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Monto ($)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    className="w-full p-3 border rounded-xl text-2xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0.00"
                                    value={formData.monto}
                                    onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Motivo / Observación</label>
                                <textarea
                                    rows="3"
                                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Ej: Devolución camiseta talle M..."
                                    value={formData.observaciones}
                                    onChange={e => setFormData({ ...formData, observaciones: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Generando...' : <><Save size={20} /> Generar Nota</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditNotesPage;