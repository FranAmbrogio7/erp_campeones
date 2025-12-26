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
  const [paymentMethods, setPaymentMethods] = useState([]); // Para el select de filtros

  // --- ESTADOS DE FILTROS ---
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    date: '',      // Formato YYYY-MM-DD del input date
    method: '',    // Nombre del método de pago
    search: ''     // Búsqueda por ID o items
  });

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

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resSales, resMethods] = await Promise.all([
          api.get('/sales/history'),
          api.get('/sales/payment-methods')
        ]);
        setSales(resSales.data.history);
        setPaymentMethods(resMethods.data);
      } catch (error) {
        console.error(error);
        toast.error('Error al cargar historial');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchData();
  }, [token]);

  // --- LÓGICA DE FILTRADO ---
  const filteredSales = useMemo(() => {
    return sales.filter(venta => {
      // 1. Filtro Fecha (Input date devuelve YYYY-MM-DD, backend DD/MM/YYYY)
      let dateMatch = true;
      if (filters.date) {
        const [y, m, d] = filters.date.split('-'); // 2023-12-25
        const searchStr = `${d}/${m}/${y}`; // 25/12/2023
        dateMatch = venta.fecha.startsWith(searchStr);
      }

      // 2. Filtro Método
      let methodMatch = true;
      if (filters.method) {
        methodMatch = venta.metodo === filters.method;
      }

      // 3. Filtro Texto (ID o Items)
      let searchMatch = true;
      if (filters.search) {
        const term = filters.search.toLowerCase();
        searchMatch =
          venta.id.toString().includes(term) ||
          venta.items.toLowerCase().includes(term);
      }

      return dateMatch && methodMatch && searchMatch;
    });
  }, [sales, filters]);

  // --- CÁLCULO DE RESUMEN (KPIs) DINÁMICO ---
  const summary = useMemo(() => {
    const total = filteredSales.reduce((sum, v) => sum + v.total, 0);
    const count = filteredSales.length;
    return { total, count };
  }, [filteredSales]);

  // Manejadores de filtro
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({ date: '', method: '', search: '' });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando historial...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <Toaster position="top-center" />

      {/* Ticket oculto */}
      <div style={{ position: 'absolute', left: '-9999px', top: '0' }}>
        <div ref={ticketRef}><Ticket saleData={ticketData} /></div>
      </div>

      {/* --- MODAL DETALLE --- */}
      {viewingSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-50 p-5 border-b flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl text-gray-800">Venta #{viewingSale.id}</h3>
                <p className="text-sm text-gray-500">{viewingSale.fecha} • {viewingSale.metodo}</p>
              </div>
              <button onClick={() => setViewingSale(null)} className="text-gray-400 hover:text-red-500 p-1"><X size={24} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-500 uppercase text-xs sticky top-0">
                  <tr>
                    <th className="p-4">Producto / Talle</th>
                    <th className="p-4 text-center">Cant.</th>
                    <th className="p-4 text-right">Precio</th>
                    <th className="p-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {viewingSale.items_detail?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30">
                      <td className="p-4">
                        <p className="font-bold text-gray-800">{item.nombre}</p>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded border">Talle: {item.talle}</span>
                      </td>
                      <td className="p-4 text-center font-medium">{item.cantidad}</td>
                      <td className="p-4 text-right text-gray-500">$ {item.precio.toLocaleString()}</td>
                      <td className="p-4 text-right font-bold text-gray-800">$ {item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-5 bg-slate-50 border-t flex justify-between items-center">
              <button onClick={() => prepareAndPrint(viewingSale)} className="flex items-center text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-bold text-sm">
                <Printer size={18} className="mr-2" /> Reimprimir
              </button>
              <div className="text-right">
                <span className="text-gray-500 text-sm mr-4 uppercase font-bold">Total</span>
                <span className="text-2xl font-black text-gray-900">$ {viewingSale.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER Y BOTÓN FILTRO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Calendar className="mr-2 text-blue-600" /> Historial de Ventas
          </h1>
          <p className="text-sm text-gray-500">
            {filters.date ? `Mostrando ventas del ${filters.date.split('-').reverse().join('/')}` : 'Registro de operaciones recientes'}
          </p>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center px-4 py-2 rounded-lg font-bold border transition-colors ${showFilters || filters.date || filters.method ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
            }`}
        >
          <Filter size={18} className="mr-2" /> {showFilters ? 'Ocultar Filtros' : 'Filtrar'}
          {(filters.date || filters.method) && <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">!</span>}
        </button>
      </div>

      {/* PANEL DE FILTROS */}
      {showFilters && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in-down">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Fecha</label>
            <input
              type="date"
              name="date"
              value={filters.date}
              onChange={handleFilterChange}
              className="w-full border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Medio de Pago</label>
            <div className="relative">
              <select
                name="method"
                value={filters.method}
                onChange={handleFilterChange}
                className="w-full border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              >
                <option value="">Todos</option>
                {paymentMethods.map(m => (
                  <option key={m.id} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Buscar</label>
            <div className="relative">
              <input
                name="search"
                placeholder="#ID o Producto..."
                value={filters.search}
                onChange={handleFilterChange}
                className="w-full border p-2 pl-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold flex items-center justify-center transition-colors">
              <XCircle size={16} className="mr-2" /> Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* TARJETAS KPI (DINÁMICAS SEGÚN FILTRO) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-green-500"></div>
          <div className="p-3 rounded-full bg-green-100 text-green-600 mr-4"><DollarSign size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">
              {filters.date ? 'Total Filtrado' : 'Total (Vista Actual)'}
            </p>
            <p className="text-2xl font-black text-gray-800">$ {summary.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-blue-500"></div>
          <div className="p-3 rounded-full bg-blue-100 text-blue-600 mr-4"><ShoppingBag size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Cantidad Ventas</p>
            <p className="text-2xl font-black text-gray-800">{summary.count}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex items-center relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1 bg-purple-500"></div>
          <div className="p-3 rounded-full bg-purple-100 text-purple-600 mr-4"><CreditCard size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase">Ticket Promedio</p>
            <p className="text-2xl font-black text-gray-800">$ {summary.count > 0 ? (summary.total / summary.count).toFixed(0) : 0}</p>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Resumen Items</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Método</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {filteredSales.length === 0 ? (
                <tr><td colSpan="6" className="p-10 text-center text-gray-400">No hay ventas que coincidan con los filtros.</td></tr>
              ) : (
                filteredSales.map(venta => (
                  <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">#{venta.id}</td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">{venta.fecha}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-sm text-gray-700 max-w-xs">
                        <Package size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                        <p className="truncate" title={venta.items}>{venta.items}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${(venta.metodo || '').includes('Efectivo') ? 'bg-green-50 text-green-700 border-green-200' :
                        (venta.metodo || '').includes('Tarjeta') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                        {venta.metodo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-black text-gray-800">
                      $ {venta.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => setViewingSale(venta)} className="text-gray-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-all mr-1" title="Ver detalle">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => prepareAndPrint(venta)} className="text-gray-400 hover:text-green-600 p-2 hover:bg-green-50 rounded-full transition-all" title="Reimprimir Ticket">
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 p-2 border-t text-center text-xs text-gray-400">
          Mostrando {filteredSales.length} registros
        </div>
      </div>
    </div>
  );
};

export default SalesHistoryPage;