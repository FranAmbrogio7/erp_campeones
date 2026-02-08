import { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar, DollarSign, CreditCard, ShoppingBag,
  Printer, Eye, X, Package, Filter, Search, XCircle, ChevronDown
} from 'lucide-react';

const SalesHistoryPage = () => {
  const { token } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // --- ESTADOS DE FILTROS ---
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ date: '', method: '', search: '' });

  // --- ESTADOS PARA MODALES ---
  const [viewingSale, setViewingSale] = useState(null);
  const [ticketData, setTicketData] = useState(null);

  // --- IMPRESIÓN ---
  const ticketRef = useRef(null);
  const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });

  const prepareAndPrint = (venta) => {
    const dataForTicket = {
      id_venta: venta.id,
      fecha: venta.fecha,
      items: venta.items_detail || [],
      total: venta.total,
      cliente: "Consumidor Final"
    };
    setTicketData(dataForTicket);
    setTimeout(() => { if (reactToPrintFn) reactToPrintFn(); }, 150);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resSales, resMethods] = await Promise.all([
          api.get('/sales/history'),
          api.get('/sales/payment-methods')
        ]);
        setSales(resSales.data.history);
        setPaymentMethods(resMethods.data);
      } catch (error) { toast.error('Error al cargar historial'); } finally { setLoading(false); }
    };
    if (token) fetchData();
  }, [token]);

  // --- LÓGICA DE FILTRADO ---
  const filteredSales = useMemo(() => {
    return sales.filter(venta => {
      let dateMatch = true;
      if (filters.date) {
        const [y, m, d] = filters.date.split('-');
        const searchStr = `${d}/${m}/${y}`;
        dateMatch = venta.fecha.startsWith(searchStr);
      }
      let methodMatch = true;
      if (filters.method) methodMatch = venta.metodo === filters.method;

      let searchMatch = true;
      if (filters.search) {
        const term = filters.search.toLowerCase();
        searchMatch = venta.id.toString().includes(term) || venta.items.toLowerCase().includes(term);
      }
      return dateMatch && methodMatch && searchMatch;
    });
  }, [sales, filters]);

  const summary = useMemo(() => {
    const total = filteredSales.reduce((sum, v) => sum + v.total, 0);
    const count = filteredSales.length;
    return { total, count };
  }, [filteredSales]);

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const clearFilters = () => setFilters({ date: '', method: '', search: '' });

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-950 h-screen">Cargando historial...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col p-6 max-w-7xl mx-auto w-full bg-gray-50 dark:bg-slate-950 transition-colors duration-300 min-h-screen">
      <Toaster position="top-center" />
      <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
        <div ref={ticketRef}><Ticket saleData={ticketData} /></div>
      </div>

      {/* --- MODAL DETALLE --- */}
      {viewingSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
            <div className="bg-slate-50 dark:bg-slate-900 p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl text-gray-800 dark:text-white">Venta #{viewingSale.id}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{viewingSale.fecha} • {viewingSale.metodo}</p>
              </div>
              <button onClick={() => setViewingSale(null)} className="text-gray-400 hover:text-red-500 p-1"><X size={24} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 uppercase text-xs sticky top-0">
                  <tr>
                    <th className="p-4">Producto / Talle</th>
                    <th className="p-4 text-center">Cant.</th>
                    <th className="p-4 text-right">Precio</th>
                    <th className="p-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {viewingSale.items_detail?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20">
                      <td className="p-4">
                        <p className="font-bold text-gray-800 dark:text-white">{item.nombre}</p>
                        <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded border dark:border-slate-600 dark:text-slate-300">Talle: {item.talle}</span>
                      </td>
                      <td className="p-4 text-center font-medium dark:text-gray-300">{item.cantidad}</td>
                      <td className="p-4 text-right text-gray-500 dark:text-gray-400">$ {item.precio.toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-gray-800 dark:text-white">$ {item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <button onClick={() => prepareAndPrint(viewingSale)} className="flex items-center text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                <Printer size={18} className="mr-2" /> Reimprimir
              </button>
              <div className="text-right">
                <span className="text-gray-500 dark:text-gray-400 text-sm mr-4 uppercase font-bold">Total</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">$ {viewingSale.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER Y BOTÓN FILTRO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
            <Calendar className="mr-2 text-blue-600 dark:text-blue-400" /> Historial de Ventas
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filters.date ? `Mostrando ventas del ${filters.date.split('-').reverse().join('/')}` : 'Registro de operaciones recientes'}
          </p>
        </div>

        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center px-4 py-2 rounded-lg font-bold border transition-colors ${showFilters || filters.date || filters.method ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'}`}>
          <Filter size={18} className="mr-2" /> {showFilters ? 'Ocultar Filtros' : 'Filtrar'}
          {(filters.date || filters.method) && <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">!</span>}
        </button>
      </div>

      {/* PANEL DE FILTROS */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in-down transition-colors">
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Fecha</label>
            <input type="date" name="date" value={filters.date} onChange={handleFilterChange} className="w-full border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-white p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Medio de Pago</label>
            <div className="relative">
              <select name="method" value={filters.method} onChange={handleFilterChange} className="w-full border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-white p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                <option value="">Todos</option>
                {paymentMethods.map(m => (<option key={m.id} value={m.nombre}>{m.nombre}</option>))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Buscar</label>
            <div className="relative">
              <input name="search" placeholder="#ID o Producto..." value={filters.search} onChange={handleFilterChange} className="w-full border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-700 dark:text-white p-2 pl-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-sm font-bold flex items-center justify-center transition-colors">
              <XCircle size={16} className="mr-2" /> Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* TARJETAS KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-blue-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute right-0 top-0 h-full w-1 bg-green-500"></div>
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4"><DollarSign size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{filters.date ? 'Total Filtrado' : 'Total (Vista Actual)'}</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white">$ {summary.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-blue-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute right-0 top-0 h-full w-1 bg-blue-500"></div>
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4"><ShoppingBag size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Cantidad Ventas</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white">{summary.count}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-blue-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
          <div className="absolute right-0 top-0 h-full w-1 bg-purple-500"></div>
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4"><CreditCard size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ticket Promedio</p>
            <p className="text-2xl font-black text-gray-800 dark:text-white">$ {summary.count > 0 ? (summary.total / summary.count).toFixed(0) : 0}</p>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden transition-colors">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Resumen Items</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Método</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredSales.length === 0 ? (
                <tr><td colSpan="6" className="p-10 text-center text-gray-400 dark:text-gray-500">No hay ventas que coincidan con los filtros.</td></tr>
              ) : (
                filteredSales.map(venta => (
                  <tr key={venta.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">#{venta.id}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{venta.fecha}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                        <Package size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                        <p className="truncate" title={venta.items}>{venta.items}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${(venta.metodo || '').includes('Efectivo') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                        (venta.metodo || '').includes('Tarjeta') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                          'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600'
                        }`}>
                        {venta.metodo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-gray-800 dark:text-white">$ {venta.total.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setViewingSale(venta)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all mr-1" title="Ver detalle">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => prepareAndPrint(venta)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-all" title="Reimprimir Ticket">
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 dark:bg-slate-900 p-2 border-t border-gray-200 dark:border-slate-700 text-center text-xs text-gray-400">
          Mostrando {filteredSales.length} registros
        </div>
      </div>
    </div>
  );
};

export default SalesHistoryPage;