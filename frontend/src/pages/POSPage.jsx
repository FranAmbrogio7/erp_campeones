import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import ReservationModal from '../components/ReservationModal'; // <--- IMPORTANTE
import {
  ShoppingCart, Trash2, Plus, Minus, ScanBarcode, Banknote,
  CreditCard, Smartphone, Lock, ArrowRight, Edit, Printer, Clock, Receipt, Search, Shirt, CalendarClock
} from 'lucide-react';

const POSPage = () => {
  const { token } = useAuth();

  // Estados POS
  const [isRegisterOpen, setIsRegisterOpen] = useState(null);
  const [skuInput, setSkuInput] = useState('');
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Búsqueda Manual
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [manualTerm, setManualTerm] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const searchInputRef = useRef(null);

  // Pagos y Precios
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // Historial
  const [recentSales, setRecentSales] = useState([]);

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false); // <--- NUEVO ESTADO

  // Impresión
  const [ticketData, setTicketData] = useState(null);
  const ticketRef = useRef(null);
  const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });
  const inputRef = useRef(null);

  // Cálculos
  const subtotalCalculado = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalFinal = customTotal !== null && customTotal !== '' ? parseFloat(customTotal) : subtotalCalculado;
  const descuentoVisual = subtotalCalculado - totalFinal;

  // --- CARGA INICIAL ---
  const fetchRecentSales = async () => {
    try {
      const res = await api.get('/sales/history', { params: { current_session: true } });
      setRecentSales(res.data.history);
    } catch (error) { console.error("Error historial", error); }
  };

  useEffect(() => {
    const init = async () => {
      if (!token) return;
      try {
        const [resStatus, resMethods] = await Promise.all([
          api.get('/sales/caja/status'),
          api.get('/sales/payment-methods')
        ]);
        const isOpen = resStatus.data.estado === 'abierta';
        setIsRegisterOpen(isOpen);
        setPaymentMethods(resMethods.data);
        if (isOpen) fetchRecentSales();
      } catch (error) { toast.error("Error de conexión"); }
    };
    init();
  }, [token]);

  // Foco inteligente
  useEffect(() => {
    if (isRegisterOpen && !isEditingPrice && !isConfirmModalOpen && !isReservationModalOpen) {
      isSearchMode ? searchInputRef.current?.focus() : inputRef.current?.focus();
    }
  }, [cart, isRegisterOpen, isEditingPrice, isConfirmModalOpen, isReservationModalOpen, isSearchMode]);

  // Búsqueda Manual
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (!manualTerm.trim() || !isSearchMode) {
        setManualResults([]);
        return;
      }
      try {
        const res = await api.get('/products', { params: { search: manualTerm, limit: 5 } });
        setManualResults(res.data.products || []);
      } catch (error) { console.error(error); }
    }, 400);
    return () => clearTimeout(delaySearch);
  }, [manualTerm, isSearchMode]);

  const handleManualAdd = (product, variant) => {
    const itemFormatted = {
      id_variante: variant.id_variante,
      sku: variant.sku,
      nombre: product.nombre,
      talle: variant.talle,
      precio: product.precio,
      stock_actual: variant.stock
    };
    addToCart(itemFormatted);
    toast.success(`${product.nombre} (${variant.talle}) agregado`);
    setManualTerm('');
    setManualResults([]);
  };

  // Escáner
  const handleScan = async (e) => {
    e.preventDefault();
    if (!skuInput.trim()) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/sales/scan/${skuInput}`);
      if (res.data.found) {
        addToCart(res.data.product);
        toast.success("Agregado", { position: 'bottom-left', duration: 1000 });
        setSkuInput('');
      }
    } catch (error) {
      toast.error("No encontrado", { position: 'bottom-left' });
      setSkuInput('');
    } finally { setIsLoading(false); }
  };

  // Carrito
  const addToCart = (product) => {
    setCustomTotal(null);
    setCart((prevCart) => {
      const existing = prevCart.find(i => i.id_variante === product.id_variante);
      if (existing) {
        if (existing.cantidad + 1 > product.stock_actual) {
          toast.error("Stock insuficiente");
          return prevCart;
        }
        return prevCart.map(i => i.id_variante === product.id_variante ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio } : i);
      } else {
        if (product.stock_actual < 1) {
          toast.error("Sin stock");
          return prevCart;
        }
        return [...prevCart, { ...product, cantidad: 1, subtotal: product.precio }];
      }
    });
  };

  const updateQuantity = (id, delta) => {
    setCustomTotal(null);
    setCart(prev => prev.map(item => {
      if (item.id_variante === id) {
        const newQty = item.cantidad + delta;
        if (newQty < 1) return item;
        if (newQty > item.stock_actual) return item;
        return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCustomTotal(null);
    setCart(prev => prev.filter(i => i.id_variante !== id));
  };

  // Checkout Normal
  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (!selectedMethod) { toast.error("Selecciona pago"); return; }
    setIsConfirmModalOpen(true);
  };

  const processSale = async () => {
    const toastId = toast.loading("Procesando...");
    setIsConfirmModalOpen(false);
    try {
      const payload = { items: cart, subtotal_calculado: subtotalCalculado, total_final: totalFinal, metodo_pago_id: selectedMethod.id };
      const res = await api.post('/sales/checkout', payload);

      // Imprimir Ticket
      setTicketData({ id_venta: res.data.id, fecha: new Date().toLocaleString(), items: cart, total: totalFinal, cliente: "Consumidor Final" });
      setTimeout(() => { if (reactToPrintFn) reactToPrintFn(); }, 150);

      toast.success(`Venta #${res.data.id} OK`, { id: toastId });
      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null);
      fetchRecentSales();
    } catch (error) { toast.error("Error en venta", { id: toastId }); }
  };

  // --- LÓGICA DE RESERVA (NUEVO) ---
  const handleReservationClick = () => {
    if (cart.length === 0) return;
    setIsReservationModalOpen(true);
  };

  const processReservation = async (reservationData) => {
    const toastId = toast.loading("Creando reserva...");
    setIsReservationModalOpen(false);
    try {
      const payload = {
        items: cart,
        total: totalFinal,
        sena: reservationData.sena,
        cliente: reservationData.cliente,
        telefono: reservationData.telefono,
        id_metodo_pago: reservationData.metodo_pago_id
      };

      await api.post('/sales/reservas/crear', payload);
      toast.success("Reserva creada correctamente", { id: toastId });
      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null);
      // Opcional: Imprimir comprobante de reserva aquí
    } catch (error) {
      toast.error(error.response?.data?.msg || "Error al reservar", { id: toastId });
    }
  };

  // Helpers
  const getPaymentIcon = (n) => {
    if (n.toLowerCase().includes('tarjeta')) return <CreditCard size={20} />;
    if (n.toLowerCase().includes('transferencia')) return <Smartphone size={20} />;
    return <Banknote size={20} />;
  };

  if (isRegisterOpen === false) return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-red-100 p-6 rounded-full text-red-500 mb-6"><Lock size={64} /></div>
      <h1 className="text-3xl font-bold text-gray-800">Caja Cerrada</h1>
      <Link to="/caja-control" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold mt-4">Abrir Caja</Link>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-2">
      <Toaster position="top-center" />
      <div style={{ display: 'none' }}><div ref={ticketRef}><Ticket saleData={ticketData} /></div></div>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={processSale}
        title="Confirmar Venta"
        message={`Cobrar $${totalFinal.toLocaleString()}?`}
        confirmText="Cobrar"
      />

      <ReservationModal
        isOpen={isReservationModalOpen}
        onClose={() => setIsReservationModalOpen(false)}
        onConfirm={processReservation}
        total={totalFinal}
        paymentMethods={paymentMethods}
      />

      {/* IZQUIERDA: Buscador y Lista */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">
        {/* Panel Buscador */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative z-50">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-700 flex items-center">
              {isSearchMode ? <Search className="mr-2 text-purple-600" /> : <ScanBarcode className="mr-2 text-blue-600" />}
              {isSearchMode ? "Buscador con Fotos" : "Escanear Código"}
            </h2>
            <button onClick={() => { setIsSearchMode(!isSearchMode); setManualTerm(''); setManualResults([]); }} className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center ${isSearchMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
              {isSearchMode ? "Usar Escáner" : "Buscar Manual"}
            </button>
          </div>
          {isSearchMode ? (
            <div className="relative">
              <input ref={searchInputRef} value={manualTerm} onChange={e => setManualTerm(e.target.value)} placeholder="Buscar camiseta, short..." className="w-full p-4 border-2 border-purple-300 rounded-lg outline-none focus:ring-4 focus:ring-purple-100" autoFocus />
              {manualResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-b-lg mt-1 max-h-96 overflow-y-auto">
                  {manualResults.map(p => (
                    <div key={p.id} className="p-3 border-b hover:bg-gray-50 flex gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded shrink-0 flex items-center justify-center">
                        {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover rounded" /> : <Shirt size={20} className="text-gray-300" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between font-bold text-sm"><span>{p.nombre}</span><span>${p.precio}</span></div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {p.variantes.map(v => (
                            <button key={v.id_variante} onClick={() => handleManualAdd(p, v)} disabled={v.stock === 0} className={`text-xs px-2 py-1 rounded border ${v.stock > 0 ? 'hover:bg-purple-600 hover:text-white border-purple-200 text-purple-700' : 'bg-gray-100 text-gray-400'}`}>{v.talle} ({v.stock})</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleScan} className="relative">
              <input ref={inputRef} value={skuInput} onChange={e => setSkuInput(e.target.value)} placeholder="Escanea código..." className="w-full text-2xl p-4 border-2 border-blue-500 rounded-lg outline-none focus:ring-4 focus:ring-blue-200 uppercase" autoFocus disabled={isEditingPrice || isConfirmModalOpen} />
            </form>
          )}
        </div>

        {/* Lista Historial Rápido */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col relative z-0 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700 flex items-center"><Clock size={16} className="mr-2 text-blue-500" /> Ventas Recientes</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-gray-100">
                {recentSales.map(v => (
                  <tr key={v.id} className="hover:bg-blue-50">
                    <td className="p-3 text-gray-500 font-mono">{v.fecha.split(' ')[1]}</td>
                    <td className="p-3 truncate max-w-[200px]">{v.items}</td>
                    <td className="p-3 font-bold text-gray-900">${v.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DERECHA: Ticket y Acciones */}
      <div className="w-full md:w-1/3 bg-white flex flex-col rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center shadow-md z-10">
          <h3 className="font-bold text-lg flex items-center"><ShoppingCart className="mr-2" /> Ticket Actual</h3>
          <span className="bg-slate-700 px-2 py-1 rounded text-xs font-bold">{cart.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
          {cart.length === 0 ? <div className="text-center text-gray-400 mt-10">Carrito vacío</div> : cart.map(item => (
            <div key={item.id_variante} className="bg-white p-3 rounded shadow-sm border border-gray-200">
              <div className="flex justify-between font-bold text-sm text-gray-800"><span>{item.nombre}</span><span className="text-green-700">${item.subtotal.toLocaleString()}</span></div>
              <div className="text-xs text-gray-500 mb-2">Talle: {item.talle}</div>
              <div className="flex justify-between items-center bg-gray-50 p-1 rounded">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1 bg-white border rounded"><Minus size={12} /></button>
                  <span className="font-bold text-sm w-6 text-center">{item.cantidad}</span>
                  <button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1 bg-white border rounded"><Plus size={12} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id_variante)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* ZONA DE COBRO */}
        <div className="p-4 bg-white border-t shadow-2xl z-20">
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Medio de Pago</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m)} className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${selectedMethod?.id === m.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {getPaymentIcon(m.nombre)}<span className="text-[10px] font-bold mt-1 uppercase">{m.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 border-b pb-2 border-dashed">
            <div>
              <span className="text-gray-500 font-medium block">Total a Pagar</span>
              {descuentoVisual > 0 && <div className="text-xs text-green-600 font-bold">Desc: -${descuentoVisual.toLocaleString()}</div>}
            </div>
            <div onClick={() => setIsEditingPrice(true)} className="cursor-pointer">
              {isEditingPrice ?
                <input autoFocus type="number" className="text-3xl font-black text-right w-32 border-b-2 border-blue-500 outline-none" value={customTotal === null ? subtotalCalculado : customTotal} onChange={e => setCustomTotal(e.target.value)} onBlur={() => setIsEditingPrice(false)} onKeyDown={e => { if (e.key === 'Enter') setIsEditingPrice(false) }} />
                : <span className={`text-3xl font-black ${descuentoVisual !== 0 ? 'text-blue-600' : 'text-gray-900'}`}>$ {totalFinal.toLocaleString()}</span>
              }
            </div>
          </div>

          {/* BOTONES DE ACCIÓN (LADO A LADO) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleReservationClick}
              disabled={cart.length === 0}
              className="bg-purple-100 text-purple-700 hover:bg-purple-200 py-3 rounded-xl font-bold flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarClock className="mr-2" size={20} /> Reservar
            </button>

            <button
              onClick={handleCheckoutClick}
              disabled={cart.length === 0 || !selectedMethod}
              className="bg-green-600 text-white hover:bg-green-700 py-3 rounded-xl font-bold flex items-center justify-center shadow-lg transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Cobrar <ArrowRight className="ml-2" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;