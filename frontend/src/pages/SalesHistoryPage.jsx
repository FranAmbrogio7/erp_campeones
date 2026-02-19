import { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar, DollarSign, CreditCard, ShoppingBag,
  Printer, Eye, X, Package, Search, FilterX
} from 'lucide-react';

const SalesHistoryPage = () => {
  const { token } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // --- ESTADOS DE FILTROS ---
  const [filterDate, setFilterDate] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // --- LÓGICA DE FILTRADO CORREGIDA ---
  const filteredSales = useMemo(() => {
    return sales.filter(venta => {
      // 1. Filtro por Fecha
      let dateMatch = true;
      if (filterDate) {
        const [y, m, d] = filterDate.split('-');
        const searchStr = `${d}/${m}/${y}`;
        dateMatch = venta.fecha.startsWith(searchStr);
      }

      // 2. Filtro por Método de Pago (Arreglado para soportar mixtos)
      let methodMatch = true;
      if (filterMethod) {
        if (venta.pagos_detalle && venta.pagos_detalle.length > 0) {
          // Busca si alguna parte del pago mixto coincide con el método
          methodMatch = venta.pagos_detalle.some(p => p.metodo.includes(filterMethod));
        } else {
          // Fallback para ventas viejas
          methodMatch = (venta.metodo || '').includes(filterMethod);
        }
      }

      // 3. Filtro por Búsqueda (ID o Items)
      let searchMatch = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        searchMatch = venta.id.toString().includes(term) || (venta.items || '').toLowerCase().includes(term);
      }

      return dateMatch && methodMatch && searchMatch;
    });
  }, [sales, filterDate, filterMethod, searchTerm]);

  // --- CÁLCULO DE TOTALES (Inteligente para pagos mixtos) ---
  const summary = useMemo(() => {
    let total = 0;
    const count = filteredSales.length;

    if (!filterMethod) {
      // Si no hay filtro de método, sumamos el total bruto de la venta
      total = filteredSales.reduce((sum, v) => sum + v.total, 0);
    } else {
      // Si filtramos por un método específico, sumamos SOLO la parte de ese método
      total = filteredSales.reduce((sum, v) => {
        if (v.pagos_detalle && v.pagos_detalle.length > 0) {
          const matchingParts = v.pagos_detalle.filter(p => p.metodo.includes(filterMethod));
          return sum + matchingParts.reduce((s, p) => s + p.monto, 0);
        }
        if ((v.metodo || '').includes(filterMethod)) return sum + v.total;
        return sum;
      }, 0);
    }

    return { total, count };
  }, [filteredSales, filterMethod]);

  const clearFilters = () => { setFilterDate(''); setFilterMethod(''); setSearchTerm(''); };

  if (loading) return <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-950 h-screen">Cargando historial...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
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
            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
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
                    <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-gray-800 dark:text-white">{item.nombre}</p>
                        <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded border dark:border-slate-600 dark:text-slate-300 mt-1 inline-block">Talle: {item.talle}</span>
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
                <span className="text-gray-500 dark:text-gray-400 text-sm mr-4 uppercase font-bold">Total Venta</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">$ {viewingSale.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TOPBAR FILTROS --- */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 shadow-sm z-20 shrink-0 transition-colors">
        <div className="max-w-[1600px] mx-auto">
          {/* Título y Buscadores Principales */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="flex-shrink-0 w-full md:w-auto">
              <h1 className="text-xl font-black text-gray-800 dark:text-white flex items-center">
                <Calendar className="mr-2 text-blue-600 dark:text-blue-400" /> Historial de Ventas
              </h1>
            </div>

            <div className="flex flex-1 w-full gap-2">
              {/* Buscador */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar ticket o producto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-gray-700 dark:text-white placeholder-gray-400"
                />
              </div>
              {/* Fecha */}
              <div className="relative w-40 shrink-0">
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>

            {/* Botón Reset */}
            {(searchTerm || filterDate || filterMethod) && (
              <button onClick={clearFilters} className="shrink-0 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-2.5 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors" title="Limpiar Filtros">
                <FilterX size={20} />
              </button>
            )}
          </div>

          {/* Chips de Métodos de Pago */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide mr-1 shrink-0">Filtro Pago:</span>
            <button
              onClick={() => setFilterMethod('')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${filterMethod === '' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            >
              Todos
            </button>
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setFilterMethod(m.nombre)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${filterMethod === m.nombre ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-[1600px] mx-auto w-full p-4 gap-4">
        {/* TARJETAS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 h-full w-1 bg-green-500"></div>
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4"><DollarSign size={24} /></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Recaudación {filterMethod ? `(${filterMethod})` : ''}</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white">$ {summary.total.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 h-full w-1 bg-blue-500"></div>
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4"><ShoppingBag size={24} /></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Tickets Emitidos</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white">{summary.count}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 h-full w-1 bg-purple-500"></div>
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4"><CreditCard size={24} /></div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Ticket Promedio</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white">$ {summary.count > 0 ? (summary.total / summary.count).toFixed(0) : 0}</p>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden transition-colors">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Resumen Items</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Método Pago</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total Bruto</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filteredSales.length === 0 ? (
                  <tr><td colSpan="6" className="p-16 text-center text-gray-400 dark:text-gray-500 font-medium text-lg">No hay ventas que coincidan con los filtros.</td></tr>
                ) : (
                  filteredSales.map(venta => (
                    <tr key={venta.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white font-mono">#{venta.id}</td>
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{venta.fecha}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300 max-w-sm">
                          <Package size={16} className="text-gray-400 mr-2 flex-shrink-0" />
                          <p className="truncate" title={venta.items}>{venta.items}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border uppercase ${(venta.metodo || '').includes('Efectivo') ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' :
                          (venta.metodo || '').includes('Tarjeta') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                            'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600'
                          }`}>
                          {venta.metodo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-black text-gray-800 dark:text-white">$ {venta.total.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setViewingSale(venta)} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all mr-1" title="Ver detalle">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => prepareAndPrint(venta)} className="text-gray-400 hover:text-green-600 dark:hover:text-green-400 p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-all" title="Reimprimir Ticket">
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 dark:bg-slate-900 p-3 border-t border-gray-200 dark:border-slate-700 text-center text-xs font-bold text-gray-500 uppercase tracking-wide transition-colors">
            Mostrando {filteredSales.length} registros en pantalla
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHistoryPage;