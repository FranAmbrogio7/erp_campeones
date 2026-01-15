import { useState, useMemo } from 'react';
import { X, Search, ArrowUp, ArrowDown, Filter } from 'lucide-react';

const ProductStatsModal = ({ isOpen, onClose, data = [], dateRange }) => {
    // 1. Hooks siempre arriba (sin condiciones antes)
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'unidades', direction: 'desc' });

    // Lógica de Ordenamiento y Filtrado
    const processedData = useMemo(() => {
        // Protección: Si no hay data, retornar array vacío para evitar errores
        if (!data) return [];

        let filtered = [...data];

        // 1. Filtrar por nombre
        if (searchTerm) {
            filtered = filtered.filter(item =>
                item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Ordenar
        filtered.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return filtered;
    }, [data, searchTerm, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <Filter size={14} className="ml-1 opacity-20" />;
        return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="ml-1" /> : <ArrowDown size={14} className="ml-1" />;
    };

    // 2. AHORA SÍ: El retorno condicional va DESPUÉS de todos los hooks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-6 bg-slate-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                            📊 Análisis Detallado de Productos
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Período: {dateRange?.start} al {dateRange?.end}
                        </p>
                    </div>
                    <button onClick={onClose} className="bg-white p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm">
                        <X size={24} />
                    </button>
                </div>

                {/* Barra de Herramientas */}
                <div className="p-4 border-b border-gray-100 flex gap-4 bg-white shrink-0">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                        <input
                            placeholder="Buscar producto o categoría..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="font-bold">{processedData.length}</span> resultados
                    </div>
                </div>

                {/* Tabla Scrollable */}
                <div className="flex-1 overflow-auto bg-gray-50 p-4">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('nombre')}>
                                        <div className="flex items-center">Producto {getSortIcon('nombre')}</div>
                                    </th>
                                    <th className="p-4 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('categoria')}>
                                        <div className="flex items-center">Categoría {getSortIcon('categoria')}</div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-gray-200" onClick={() => handleSort('unidades')}>
                                        <div className="flex items-center justify-end">Unidades {getSortIcon('unidades')}</div>
                                    </th>
                                    <th className="p-4 text-right cursor-pointer hover:bg-gray-200" onClick={() => handleSort('ingresos')}>
                                        <div className="flex items-center justify-end">Ingresos {getSortIcon('ingresos')}</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {processedData.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-4 font-medium text-gray-800">{item.nombre}</td>
                                        <td className="p-4">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold border">
                                                {item.categoria}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-bold text-blue-600">{item.unidades}</td>
                                        <td className="p-4 text-right font-mono text-gray-700">$ {item.ingresos.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {processedData.length === 0 && (
                                    <tr><td colSpan="4" className="p-10 text-center text-gray-400">No se encontraron productos.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductStatsModal;