import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar, DollarSign, CreditCard, ShoppingBag,
  Printer, Eye, X, Package, Search, FilterX,
  ChevronLeft, ChevronRight, Edit, Clock, Store, Tag, Receipt, Trash2,
  CheckSquare, Square, ListChecks
} from 'lucide-react';

const SalesHistoryPage = () => {
  const { token } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // --- IDENTIDAD DE TERMINAL ---
  const [tipoCajaFiltro, setTipoCajaFiltro] = useState(() => {
    return localStorage.getItem('terminal_tipo_caja') || 'PRINCIPAL';
  });
  const isMerch = tipoCajaFiltro === 'MERCHANDISING';

  // --- ESTADOS DE FILTROS ---
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterMethod, setFilterMethod] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // --- ESTADOS DE PAGINACIÓN ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // --- ESTADOS PARA MODALES ---
  const [viewingSale, setViewingSale] = useState(null);
  const [ticketData, setTicketData] = useState(null);

  // --- ESTADOS DE EDICIÓN ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({ total: '', metodo_pago_id: '' });

  // --- ESTADOS DE LISTA DE ARMADO (PICKING LIST) ---
  const [selectedSales, setSelectedSales] = useState(new Set());
  const [pickingListData, setPickingListData] = useState([]);

  // --- REFS PARA IMPRESIÓN ---
  const ticketRef = useRef(null);
  const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });

  const pickingListRef = useRef(null);
  const pickingListPrintFn = useReactToPrint({ contentRef: pickingListRef, documentTitle: 'Lista_de_Armado' });

  const prepareAndPrint = (venta) => {
    const dataForTicket = {
      id_venta: venta.id,
      fecha: venta.fecha,
      items: venta.items_detail || [],
      total: venta.total,
      cliente: "Consumidor Final",
      logo_alt: isMerch ? "MERCHANDISING" : null
    };
    setTicketData(dataForTicket);
    setTimeout(() => { if (reactToPrintFn) reactToPrintFn(); }, 150);
  };

  // --- FUNCIÓN DE CARGA INTELIGENTE ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: (dateRange.start || dateRange.end) ? 5000 : 100,
        tipo_caja: tipoCajaFiltro
      };

      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;

      const [resSales, resMethods] = await Promise.all([
        api.get('/sales/history', { params }),
        api.get('/sales/payment-methods')
      ]);
      setSales(resSales.data.history);
      setPaymentMethods(resMethods.data);
      setSelectedSales(new Set());
    } catch (error) {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end, tipoCajaFiltro]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSales(new Set());
  }, [filterMethod, searchTerm, sales, tipoCajaFiltro]);

  // --- LÓGICA DE FECHAS RÁPIDAS ---
  const setQuickDate = (type) => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today - tzOffset)).toISOString().split('T')[0];

    let start = '';
    let end = localISOTime;

    if (type === 'hoy') {
      start = localISOTime;
    } else if (type === '7dias') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = (new Date(d - tzOffset)).toISOString().split('T')[0];
    } else if (type === 'mes') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      start = (new Date(d - tzOffset)).toISOString().split('T')[0];
    }

    setDateRange({ start, end });
  };

  // --- LÓGICA DE EDICIÓN ---
  const openEditModal = (venta) => {
    setSaleToEdit(venta);
    let matchedMethodId = '';
    if (venta.pagos_detalle && venta.pagos_detalle.length > 0) {
      const methodObj = paymentMethods.find(m => m.nombre === venta.pagos_detalle[0].metodo);
      if (methodObj) matchedMethodId = methodObj.id;
    }
    setEditFormData({ total: venta.total, metodo_pago_id: matchedMethodId });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.metodo_pago_id) return toast.error("Selecciona un método de pago válido");

    const toastId = toast.loading("Aplicando cambios...");
    try {
      await api.put(`/sales/${saleToEdit.id}`, {
        total: parseFloat(editFormData.total),
        metodo_pago_id: editFormData.metodo_pago_id
      });
      toast.success("Venta actualizada correctamente", { id: toastId });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.msg || "Error al actualizar la venta", { id: toastId });
    }
  };

  // --- LÓGICA DE ANULACIÓN ---
  const handleVoidSale = async (vid) => {
    if (!window.confirm("¿ANULAR VENTA? El stock de los artículos volverá al inventario.")) return;

    const toastId = toast.loading("Anulando venta y restaurando stock...");
    try {
      await api.delete(`/sales/${vid}/anular`);
      toast.success("Venta anulada correctamente", { id: toastId });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.msg || "Error al anular la venta", { id: toastId });
    }
  };

  // --- LÓGICA DE SELECCIÓN PARA LISTA DE ARMADO ---
  const toggleSelectSale = (id) => {
    const newSet = new Set(selectedSales);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSales(newSet);
  };

  // --- GENERACIÓN DE LISTA DE ARMADO (PICKING LIST) BLINDADA ---
  const handleGeneratePickingList = () => {
    const selected = sales.filter(s => selectedSales.has(s.id));
    const aggregated = {};

    selected.forEach(sale => {
      sale.items_detail?.forEach(item => {
        const key = `${item.nombre}-${item.talle}`;
        if (!aggregated[key]) {
          aggregated[key] = {
            nombre: item.nombre,
            talle: item.talle,
            cantidad: 0,
            imagen: item.imagen || null
          };
        }
        aggregated[key].cantidad += item.cantidad;
      });
    });

    const sortedList = Object.values(aggregated).sort((a, b) => b.cantidad - a.cantidad);
    setPickingListData(sortedList);

    const toastId = toast.loading("Generando y acomodando lista...");

    // Le damos casi un segundo al navegador para que dibuje todo el HTML en el fondo
    setTimeout(() => {
      toast.dismiss(toastId);
      if (pickingListPrintFn) pickingListPrintFn();
    }, 800);
  };

  // --- LÓGICA DE FILTRADO LOCAL ---
  const filteredSales = useMemo(() => {
    return sales.filter(venta => {
      let methodMatch = true;
      if (filterMethod) {
        if (venta.pagos_detalle && venta.pagos_detalle.length > 0) {
          methodMatch = venta.pagos_detalle.some(p => p.metodo.includes(filterMethod));
        } else {
          methodMatch = (venta.metodo || '').includes(filterMethod);
        }
      }

      let searchMatch = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        searchMatch = venta.id.toString().includes(term) || (venta.items || '').toLowerCase().includes(term);
      }

      return methodMatch && searchMatch;
    });
  }, [sales, filterMethod, searchTerm]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedSales.size === paginatedSales.length && paginatedSales.length > 0) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(paginatedSales.map(v => v.id)));
    }
  };

  const summary = useMemo(() => {
    let total = 0;
    const count = filteredSales.length;

    if (!filterMethod) {
      total = filteredSales.reduce((sum, v) => sum + v.total, 0);
    } else {
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

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setFilterMethod('');
    setSearchTerm('');
    setSelectedSales(new Set());
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-gray-400 dark:text-gray-600 bg-slate-50 dark:bg-slate-950">
      <Clock className={`animate-spin mb-4 ${isMerch ? 'text-purple-600' : 'text-indigo-600'}`} size={48} />
      <p className="font-bold tracking-widest uppercase text-sm">Recuperando base de datos...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      <Toaster position="top-center" />

      {/* 
        OCULTO: PLANTILLA DE TICKET Y LISTA DE ARMADO 
        Usamos overflow-hidden y height-0 para esconderlo sin usar display:none,
        así react-to-print lo puede "ver" perfectamente.
      */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '80mm' }}>

        {/* Ticket normal */}
        <Ticket ref={ticketRef} saleData={ticketData} />

        {/* REPORTE: LISTA DE ARMADO PDF - Con anchos y colores estrictos para evitar colapsos */}
        <div ref={pickingListRef} className="font-sans" style={{ backgroundColor: '#ffffff', color: '#000000', width: '210mm', padding: '15mm', boxSizing: 'border-box' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #000', paddingBottom: '16px', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '900', textTransform: 'uppercase', margin: 0 }}>Lista de Armado (Picking)</h2>
              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', margin: '4px 0 0 0' }}>Órdenes Agrupadas: {selectedSales.size}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '18px', fontWeight: '900', margin: 0 }}>{new Date().toLocaleDateString('es-AR')}</p>
              <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', margin: '4px 0 0 0' }}>Generado desde ERP</p>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', backgroundColor: '#f3f4f6' }}>
                <th style={{ width: '60px', textAlign: 'center', padding: '12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>Cant.</th>
                <th style={{ width: '80px', textAlign: 'center', padding: '12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>Foto</th>
                <th style={{ padding: '12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>Producto / Descripción</th>
                <th style={{ width: '150px', padding: '12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>Variante / Talle</th>
                <th style={{ width: '60px', textAlign: 'center', padding: '12px', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px' }}>Check</th>
              </tr>
            </thead>
            <tbody>
              {pickingListData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #d1d5db' }}>
                  <td style={{ textAlign: 'center', padding: '12px', verticalAlign: 'middle' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900' }}>{item.cantidad}</span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px', verticalAlign: 'middle' }}>
                    {item.imagen ? (
                      <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb', margin: '0 auto' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', backgroundColor: '#f3f4f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: '#9ca3af', border: '1px solid #e5e7eb', margin: '0 auto' }}>SIN FOTO</div>
                    )}
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                    <p style={{ fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', margin: 0, lineHeight: '1.2' }}>{item.nombre}</p>
                  </td>
                  <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                    <span style={{ display: 'inline-block', padding: '4px 8px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}>
                      {item.talle}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px', verticalAlign: 'middle' }}>
                    <div style={{ width: '24px', height: '24px', border: '2px solid #9ca3af', borderRadius: '6px', margin: '0 auto' }}></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL EDITAR VENTA --- */}
      {isEditModalOpen && saleToEdit && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsEditModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transition-colors border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-5 border-b border-amber-200 dark:border-amber-800/50 flex justify-between items-center text-amber-700 dark:text-amber-400">
              <div>
                <h3 className="font-black text-xl flex items-center tracking-tight"><Edit className="mr-3" size={24} /> Corregir Venta #{saleToEdit.id}</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 p-2 rounded-full transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Importe Final Real</label>
                <div className="relative">
                  <span className="absolute left-4 top-4 text-amber-500 font-black text-xl">$</span>
                  <input
                    type="number" step="0.01" required autoFocus
                    value={editFormData.total}
                    onChange={e => setEditFormData({ ...editFormData, total: e.target.value })}
                    className="w-full pl-10 p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-2xl outline-none focus:border-amber-500 dark:text-white transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Medio de Pago</label>
                <select
                  required
                  value={editFormData.metodo_pago_id}
                  onChange={e => setEditFormData({ ...editFormData, metodo_pago_id: e.target.value })}
                  className="w-full p-4 border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest outline-none focus:border-amber-500 dark:text-white cursor-pointer shadow-sm transition-all"
                >
                  <option value="">Seleccionar método...</option>
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-500/30 transition-transform active:scale-95">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DETALLE --- */}
      {viewingSale && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingSale(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className={`p-6 border-b flex justify-between items-center ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/50' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50'}`}>
              <div>
                <h3 className={`font-black text-2xl tracking-tight flex items-center ${isMerch ? 'text-purple-800 dark:text-purple-400' : 'text-indigo-800 dark:text-indigo-400'}`}>
                  <Receipt className="mr-3" size={28} /> Venta #{viewingSale.id}
                </h3>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{viewingSale.fecha} • {viewingSale.metodo}</p>
              </div>
              <button onClick={() => setViewingSale(null)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm"><X size={24} /></button>
            </div>

            <div className="p-0 overflow-y-auto flex-1 custom-scrollbar bg-slate-50 dark:bg-slate-900">
              <table className="w-full text-sm text-left">
                <thead className="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="p-4 pl-6 text-center w-16">Foto</th>
                    <th className="p-4">Producto / Talle</th>
                    <th className="p-4 text-center">Cant.</th>
                    <th className="p-4 text-right">Precio</th>
                    <th className="p-4 text-right pr-6">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewingSale.items_detail?.map((item, idx) => (
                    <tr key={idx} className={`transition-colors group ${isMerch ? 'hover:bg-purple-50/50 dark:hover:bg-purple-900/10' : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}`}>
                      <td className="p-4 pl-6 text-center">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden mx-auto shadow-sm border border-slate-200 dark:border-slate-600">
                          {item.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${item.imagen}`} className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-400" />}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800 dark:text-white leading-tight">{item.nombre}</p>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-600 font-bold uppercase tracking-widest mt-1 inline-block">Talle: {item.talle}</span>
                      </td>
                      <td className="p-4 text-center font-bold dark:text-slate-300">{item.cantidad}</td>
                      <td className="p-4 text-right text-slate-500 dark:text-slate-400 font-mono text-xs">$ {item.precio.toLocaleString()}</td>
                      <td className="p-4 text-right font-black text-slate-800 dark:text-white font-mono text-base pr-6">$ {item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
              <button onClick={() => prepareAndPrint(viewingSale)} className={`flex items-center px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-sm border ${isMerch ? 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'}`}>
                <Printer size={18} className="mr-2" /> Reimprimir Ticket
              </button>
              <div className="text-right">
                <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest block mb-0.5">Total Venta</span>
                <span className={`text-3xl font-black tracking-tighter font-mono ${isMerch ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}`}>$ {viewingSale.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TOPBAR FILTROS RENOVADA --- */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 md:p-5 shadow-sm z-20 shrink-0 transition-colors">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-4">

          {/* Fila 1: Título, Buscador y Selector Terminal */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white flex items-center shrink-0 tracking-tight">
              <Calendar className={`mr-3 ${isMerch ? 'text-purple-500' : 'text-indigo-500'}`} size={28} /> Historial de Ventas
            </h1>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 w-full md:max-w-xs">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar ticket o producto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-slate-700 dark:text-white placeholder-slate-400 text-sm shadow-inner"
                />
              </div>

              {/* SELECTOR DE TERMINAL */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner w-full md:w-auto overflow-x-auto">
                <button
                  onClick={() => setTipoCajaFiltro('PRINCIPAL')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isMerch ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  <Store size={14} /> Campeones
                </button>
                <button
                  onClick={() => setTipoCajaFiltro('MERCHANDISING')}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isMerch ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-400 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  <Tag size={14} /> Merch
                </button>
              </div>
            </div>
          </div>

          {/* Fila 2: Selector de Fechas Original y Filtros Rápidos */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">

            {/* Controles de Fecha */}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-4 w-full lg:w-auto">

              {/* Botones Rápidos */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700">
                <button onClick={() => setQuickDate('hoy')} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-colors flex items-center"><Clock size={14} className="mr-1.5" /> Hoy</button>
                <button onClick={() => setQuickDate('7dias')} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-colors">7 Días</button>
                <button onClick={() => setQuickDate('mes')} className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-colors">Este Mes</button>
              </div>

              <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

              {/* Selector de Rango */}
              <div className="flex gap-3 shrink-0">
                <div className="relative w-36 md:w-40">
                  <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest rounded-md border border-slate-100 dark:border-slate-800">Desde</span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-slate-700 dark:text-white text-sm shadow-inner"
                  />
                </div>
                <div className="relative w-36 md:w-40">
                  <span className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[9px] font-black text-slate-400 uppercase tracking-widest rounded-md border border-slate-100 dark:border-slate-800">Hasta</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none transition-all font-bold text-slate-700 dark:text-white text-sm shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-center">
              {/* BOTÓN LISTA DE ARMADO */}
              {selectedSales.size > 0 && (
                <div className="flex items-center w-full sm:w-auto gap-2 bg-indigo-50 dark:bg-indigo-900/30 p-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 animate-fade-in shadow-inner">
                  <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest px-2 whitespace-nowrap">{selectedSales.size} sel.</span>
                  <button onClick={handleGeneratePickingList} className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center shadow-md transition-all active:scale-95">
                    <ListChecks size={14} className="mr-1.5" /> Lista Armado
                  </button>
                </div>
              )}

              {/* Limpiar Filtros */}
              {(searchTerm || dateRange.start || dateRange.end || filterMethod) && (
                <button onClick={clearFilters} className="shrink-0 w-full sm:w-auto bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-5 py-3 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center font-black text-[10px] uppercase tracking-widest border border-red-100 dark:border-red-800/50 shadow-sm">
                  <FilterX size={16} className="mr-2" /> Limpiar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Fila 3: Chips de Métodos de Pago */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar pt-1">
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 shrink-0">Medio Pago:</span>
            <button
              onClick={() => setFilterMethod('')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap shrink-0 ${filterMethod === '' ? (isMerch ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/30' : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30') : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              Todos
            </button>
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setFilterMethod(m.nombre)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap shrink-0 ${filterMethod === m.nombre ? (isMerch ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/30 transform scale-105' : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/30 transform scale-105') : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm'}`}
              >
                {m.nombre}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-[1600px] mx-auto w-full p-4 md:p-6 gap-6">

        {/* TARJETAS KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 mr-5 shadow-inner border border-emerald-100 dark:border-emerald-800/50"><DollarSign size={28} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Recaudación {filterMethod ? `(${filterMethod})` : ''}</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">$ {summary.total.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className={`absolute right-0 top-0 h-full w-1 ${isMerch ? 'bg-purple-500' : 'bg-indigo-500'}`}></div>
            <div className={`p-4 rounded-xl mr-5 shadow-inner border ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800/50' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50'}`}><ShoppingBag size={28} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tickets Emitidos</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">{summary.count}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center relative overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 h-full w-1 bg-sky-500"></div>
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 mr-5 shadow-inner border border-sky-100 dark:border-sky-800/50"><CreditCard size={28} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Ticket Promedio</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tighter">$ {summary.count > 0 ? (summary.total / summary.count).toFixed(0) : 0}</p>
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL CON PAGINACIÓN APLICADA */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex flex-col overflow-hidden transition-colors">
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                      {selectedSales.size > 0 && selectedSales.size === paginatedSales.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">Ticket</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Fecha</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen Items</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Método Pago</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-36">Total Bruto</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {paginatedSales.length === 0 ? (
                  <tr><td colSpan="7" className="p-20 text-center text-slate-400 dark:text-slate-500 font-bold text-sm uppercase tracking-widest">No hay ventas que coincidan con los filtros.</td></tr>
                ) : (
                  paginatedSales.map(venta => (
                    <tr key={venta.id} className={`transition-colors group ${isMerch ? 'hover:bg-purple-50/40 dark:hover:bg-purple-900/10' : 'hover:bg-indigo-50/40 dark:hover:bg-slate-700/50'}`}>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => toggleSelectSale(venta.id)} className={`transition-transform active:scale-90 ${selectedSales.has(venta.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}>
                          {selectedSales.has(venta.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800 dark:text-white font-mono text-sm">#{venta.id}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{venta.fecha}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-sm font-bold text-slate-700 dark:text-slate-300 max-w-sm">
                          {isMerch ? <Tag size={16} className="text-purple-400 mr-2 flex-shrink-0" /> : <Package size={16} className="text-indigo-400 mr-2 flex-shrink-0" />}
                          <p className="truncate" title={venta.items}>{venta.items}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm inline-block
                            ${(venta.metodo || '').includes('Efectivo') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' :
                            (venta.metodo || '').includes('Tarjeta') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' :
                              (venta.metodo || '').includes('Nube') || (venta.metodo || '').includes('Tienda') ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/50' :
                                'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                          }`}>
                          {venta.metodo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-black text-slate-800 dark:text-white font-mono text-base tracking-tight">$ {venta.total.toLocaleString()}</td>

                      {/* --- BOTONES DE ACCIÓN --- */}
                      <td className="px-6 py-4 text-right whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(venta)} className="text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all mr-1 shadow-sm border border-transparent hover:border-amber-200 dark:hover:border-amber-800/50" title="Corregir Venta">
                          <Edit size={18} />
                        </button>
                        <button onClick={() => setViewingSale(venta)} className={`text-slate-400 dark:text-slate-500 p-2 rounded-xl transition-all mr-1 shadow-sm border border-transparent ${isMerch ? 'hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-800/50' : 'hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800/50'}`} title="Ver detalle">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => prepareAndPrint(venta)} className="text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400 p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all mr-1 shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50" title="Reimprimir Ticket">
                          <Printer size={18} />
                        </button>
                        <button onClick={() => handleVoidSale(venta.id)} className="text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-200 dark:hover:border-red-800/50" title="Anular Venta">
                          <Trash2 size={18} />
                        </button>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* --- FOOTER DE PAGINACIÓN --- */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors shadow-inner">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
              Mostrando {paginatedSales.length} de {filteredSales.length} resultados <span className="mx-2 opacity-50">|</span> Pág <span className="text-slate-800 dark:text-white font-black">{currentPage}</span> de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 transition-colors shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesHistoryPage;