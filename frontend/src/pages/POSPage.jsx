import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import ReservationModal from '../components/ReservationModal';
import {
  ShoppingCart, Trash2, Plus, Minus, ScanBarcode, Banknote,
  CreditCard, Smartphone, Lock, ArrowRight, Printer, Clock,
  Search, Shirt, CalendarClock, X, AlertTriangle, Receipt, Edit3
} from 'lucide-react';

// Sonidos para feedback inmediato (UX)
const SOUNDS = {
  beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
  error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3')
};

const POSPage = () => {
  const { token } = useAuth();

  // --- ESTADOS ---
  const [isRegisterOpen, setIsRegisterOpen] = useState(null);
  const [skuInput, setSkuInput] = useState('');
  const [cart, setCart] = useState([]);

  // Búsqueda Manual
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [manualTerm, setManualTerm] = useState('');
  const [manualResults, setManualResults] = useState([]);

  // Pagos y Totales
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  // Nota de Crédito
  const [creditNoteCode, setCreditNoteCode] = useState('');

  // Historial
  const [recentSales, setRecentSales] = useState([]);

  // Modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

  // Impresión
  const [ticketData, setTicketData] = useState(null);
  const ticketRef = useRef(null);
  const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });

  // Refs de Foco
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const creditNoteInputRef = useRef(null);

  // Cálculos en tiempo real
  const subtotalCalculado = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalFinal = customTotal !== null && customTotal !== '' ? parseFloat(customTotal) : subtotalCalculado;
  const descuentoVisual = subtotalCalculado - totalFinal;

  // --- AUDIO HELPER MEJORADO ---
  const playSound = (type) => {
    try {
      const audio = SOUNDS[type];
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 0.5;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Reproducción de audio bloqueada por el navegador:", error);
          });
        }
      }
    } catch (e) {
      console.error("Error sistema audio:", e);
    }
  };

  // --- CARGA INICIAL ---
  const fetchRecentSales = async () => {
    try {
      const res = await api.get('/sales/history', { params: { current_session: true, limit: 10 } });
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

  // Foco Automático Inteligente
  useEffect(() => {
    if (!isRegisterOpen || isEditingPrice || isConfirmModalOpen || isReservationModalOpen) return;

    // Si hay un método de crédito seleccionado, quizás queramos foco allí, 
    // pero por defecto priorizamos seguir vendiendo.
    if (isSearchMode) {
      searchInputRef.current?.focus();
    } else {
      // Solo enfocamos el escáner si NO estamos escribiendo la nota de crédito
      if (document.activeElement !== creditNoteInputRef.current) {
        inputRef.current?.focus();
      }
    }
  }, [cart, isRegisterOpen, isEditingPrice, isConfirmModalOpen, isReservationModalOpen, isSearchMode]);

  // --- BÚSQUEDA MANUAL ---
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
    }, 300);
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
    playSound('beep');
    setManualTerm('');
    setManualResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // --- ESCÁNER ---
  const handleScan = async (e) => {
    e.preventDefault();
    if (!skuInput.trim()) return;
    try {
      const res = await api.get(`/sales/scan/${skuInput}`);
      if (res.data.found) {
        addToCart(res.data.product);
        playSound('beep');
        toast.success("OK", { position: 'bottom-left', duration: 800 });
        setSkuInput('');
      }
    } catch (error) {
      playSound('error');
      toast.error("Producto NO Encontrado", { position: 'bottom-left' });
      setSkuInput('');
    }
  };

  // --- CARRITO ---
  const addToCart = (product) => {
    setCustomTotal(null); // Reseteamos precio editado al agregar cosas
    setCart((prevCart) => {
      const existing = prevCart.find(i => i.id_variante === product.id_variante);
      if (existing) {
        if (existing.cantidad + 1 > product.stock_actual) {
          toast.error("Stock insuficiente");
          playSound('error');
          return prevCart;
        }
        return prevCart.map(i => i.id_variante === product.id_variante ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio } : i);
      } else {
        if (product.stock_actual < 1) {
          toast.error("Sin stock");
          playSound('error');
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
        if (newQty < 1) return item; // Mínimo 1
        if (newQty > item.stock_actual) return item; // Máximo stock real
        return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCustomTotal(null);
    setCart(prev => prev.filter(i => i.id_variante !== id));
  };

  const clearCart = () => {
    if (window.confirm("¿Vaciar carrito?")) setCart([]);
  };

  // --- PROCESOS DE VENTA ---
  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (!selectedMethod) {
      toast.error("Selecciona medio de pago");
      playSound('error');
      return;
    }
    // Validación Nota Crédito (Flexible con acentos)
    const metodoNombre = selectedMethod.nombre.toLowerCase();
    if ((metodoNombre.includes('credito') || metodoNombre.includes('crédito')) && !creditNoteCode.trim()) {
      toast.error("Debes ingresar el código de la Nota");
      playSound('error');
      // Enfocar el input de nota si está vacío
      setTimeout(() => creditNoteInputRef.current?.focus(), 200);
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const processSale = async () => {
    const toastId = toast.loading("Procesando...");
    setIsConfirmModalOpen(false);
    try {
      const metodoNombre = selectedMethod.nombre.toLowerCase();
      const esNotaCredito = metodoNombre.includes('credito') || metodoNombre.includes('crédito');

      // 1. Validar Nota de Crédito en Backend
      if (esNotaCredito) {
        try {
          const check = await api.get(`/sales/notas-credito/validar/${creditNoteCode}`);
          // Validar si alcanza el saldo
          if (check.data.monto < totalFinal) {
            toast.error(`Saldo insuficiente en Nota ($${check.data.monto})`, { id: toastId });
            playSound('error');
            return;
          }
        } catch (e) {
          toast.error(e.response?.data?.msg || "Código de Nota inválido", { id: toastId });
          playSound('error');
          return;
        }
      }

      const payload = {
        items: cart,
        subtotal_calculado: subtotalCalculado,
        total_final: totalFinal,
        metodo_pago_id: selectedMethod.id,
        codigo_nota_credito: esNotaCredito ? creditNoteCode : null
      };

      const res = await api.post('/sales/checkout', payload);

      setTicketData({
        id_venta: res.data.id,
        fecha: new Date().toLocaleString(),
        items: cart,
        total: totalFinal,
        cliente: "Consumidor Final",
        metodo: selectedMethod.nombre
      });

      playSound('beep');
      toast.success(`Venta #${res.data.id} Exitosa`, { id: toastId });

      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null); setCreditNoteCode('');
      fetchRecentSales();

    } catch (error) {
      playSound('error');
      toast.error(error.response?.data?.msg || "Error al procesar", { id: toastId });
    }
  };

  // --- ANULAR VENTA (PÁNICO) ---
  const handleVoidSale = async (ventaId) => {
    if (!window.confirm(`⚠️ ¿ANULAR VENTA #${ventaId}?\n\nSe devolverá el stock inmediatamente.`)) return;

    const toastId = toast.loading("Anulando...");
    try {
      await api.delete(`/sales/${ventaId}/anular`);
      toast.success("Venta anulada y stock devuelto", { id: toastId });
      playSound('beep');
      fetchRecentSales();
    } catch (error) {
      toast.error("Error al anular", { id: toastId });
      playSound('error');
    }
  };

  const handleReprint = (venta) => {
    setTicketData({
      id_venta: venta.id,
      fecha: venta.fecha,
      items: venta.items_detail || [],
      total: venta.total,
      cliente: "Reimpresión"
    });
    setTimeout(() => { reactToPrintFn(); }, 200);
  };

  // --- RESERVAS ---
  const handleReservationClick = () => {
    if (cart.length === 0) return;
    setIsReservationModalOpen(true);
  };

  const processReservation = async (reservationData) => {
    const toastId = toast.loading("Reservando...");
    setIsReservationModalOpen(false);
    try {
      const payload = {
        items: cart, total: totalFinal, sena: reservationData.sena,
        cliente: reservationData.cliente, telefono: reservationData.telefono,
        id_metodo_pago: reservationData.metodo_pago_id
      };
      await api.post('/sales/reservas/crear', payload);
      playSound('beep');
      toast.success("Reserva creada", { id: toastId });
      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null);
    } catch (error) {
      playSound('error');
      toast.error(error.response?.data?.msg || "Error", { id: toastId });
    }
  };

  // --- HELPERS UI ---
  const getPaymentIcon = (n) => {
    const name = n.toLowerCase();
    if (name.includes('tarjeta')) return <CreditCard size={20} />;
    if (name.includes('transferencia')) return <Smartphone size={20} />;
    if (name.includes('credito') || name.includes('crédito')) return <Receipt size={20} />;
    return <Banknote size={20} />;
  };

  const getMethodBadgeColor = (methodName) => {
    const m = (methodName || '').toLowerCase();
    if (m.includes('efectivo')) return 'bg-green-100 text-green-700 border-green-200';
    if (m.includes('tarjeta')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (m.includes('transferencia')) return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  // --- RENDER ---
  if (isRegisterOpen === false) return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="bg-red-50 p-6 rounded-full text-red-500 mb-6 shadow-sm"><Lock size={64} /></div>
      <h1 className="text-3xl font-black text-gray-800">Caja Cerrada</h1>
      <Link to="/caja-control" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold mt-4 hover:bg-black transition-colors shadow-lg">Abrir Caja</Link>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-2">
      <Toaster position="top-center" />
      <div style={{ display: 'none' }}><div ref={ticketRef}><Ticket saleData={ticketData} /></div></div>

      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={processSale} title="Confirmar Venta" message={`Cobrar $${totalFinal.toLocaleString()}?`} confirmText="Cobrar" />
      <ReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} onConfirm={processReservation} total={totalFinal} paymentMethods={paymentMethods} />

      {/* --- COLUMNA IZQUIERDA --- */}
      <div className="w-full md:w-2/3 flex flex-col gap-4">

        {/* PANEL BUSCADOR */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 relative z-50">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-700 flex items-center">
              {isSearchMode ? <Search className="mr-2 text-purple-600" /> : <ScanBarcode className="mr-2 text-blue-600" />}
              {isSearchMode ? "Buscador Manual" : "Escáner Activo"}
            </h2>
            <button
              onClick={() => { setIsSearchMode(!isSearchMode); setManualTerm(''); setManualResults([]); }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center transition-all ${isSearchMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}
            >
              {isSearchMode ? "Cambiar a Escáner" : "Cambiar a Manual"}
            </button>
          </div>

          {isSearchMode ? (
            <div className="relative">
              <input
                ref={searchInputRef}
                value={manualTerm}
                onChange={e => setManualTerm(e.target.value)}
                placeholder="Nombre del producto..."
                className="w-full p-4 border-2 border-purple-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-50 transition-all text-lg"
                autoFocus
              />
              {/* RESULTADOS MANUALES COMPLETOS */}
              {manualResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border shadow-2xl rounded-b-xl mt-1 max-h-80 overflow-y-auto z-50">
                  {manualResults.map(p => (
                    <div key={p.id} className="p-3 border-b hover:bg-gray-50 flex gap-3 cursor-pointer group" onClick={() => { }}>
                      <div className="w-12 h-12 bg-gray-100 rounded-lg shrink-0 flex items-center justify-center border overflow-hidden">
                        {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-gray-300" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between font-bold text-sm text-gray-800">
                          <span>{p.nombre}</span>
                          <span className="text-blue-600">${p.precio}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {p.variantes.map(v => (
                            <button
                              key={v.id_variante}
                              onClick={(e) => { e.stopPropagation(); handleManualAdd(p, v); }}
                              disabled={v.stock === 0}
                              className={`text-xs px-3 py-1 rounded border transition-all flex items-center gap-1 ${v.stock > 0
                                ? 'hover:bg-purple-600 hover:text-white border-purple-200 text-purple-700 bg-purple-50'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                              <span className="font-bold">{v.talle}</span>
                              <span className="text-[10px] opacity-70 border-l pl-1 ml-1 border-current">
                                {v.stock}u
                              </span>
                            </button>
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
              <input
                ref={inputRef}
                value={skuInput}
                onChange={e => setSkuInput(e.target.value)}
                placeholder="CÓDIGO DE BARRAS..."
                className="w-full text-2xl p-4 border-2 border-blue-500 rounded-xl outline-none focus:ring-4 focus:ring-blue-100 uppercase font-mono tracking-wider transition-all"
                autoFocus
                disabled={isEditingPrice || isConfirmModalOpen}
              />
            </form>
          )}
        </div>

        {/* LISTA HISTORIAL */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col relative z-0 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700 flex items-center"><Clock size={16} className="mr-2 text-blue-500" /> Últimas Ventas</h3>
            <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Turno Actual</span>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-white text-gray-400 font-bold sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="p-3">Hora</th>
                  <th className="p-3">Items</th>
                  <th className="p-3 text-center">Pago</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentSales.map(v => (
                  <tr key={v.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-3 text-gray-500 font-mono">{v.fecha.split(' ')[1]}</td>
                    <td className="p-3 text-gray-700 truncate max-w-[150px]" title={v.items}>{v.items}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getMethodBadgeColor(v.metodo)}`}>
                        {v.metodo}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-gray-900 text-right">${v.total.toLocaleString()}</td>
                    <td className="p-3 text-center flex justify-center gap-2">
                      <button onClick={() => handleReprint(v)} className="text-gray-300 hover:text-blue-600 hover:bg-blue-100 p-1.5 rounded-full transition-all" title="Imprimir Ticket">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => handleVoidSale(v.id)} className="text-red-300 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-full transition-colors" title="ANULAR Y RESTAURAR STOCK">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-300 italic">Sin ventas recientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- COLUMNA DERECHA --- */}
      <div className="w-full md:w-1/3 bg-white flex flex-col rounded-2xl shadow-lg border border-gray-200 overflow-hidden relative">

        {/* Header Carrito */}
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center shadow-md z-10">
          <h3 className="font-bold text-lg flex items-center"><ShoppingCart className="mr-2" /> Ticket Actual</h3>
          <div className="flex items-center gap-2">
            <span className="bg-slate-700 px-2 py-1 rounded text-xs font-bold">{cart.length} ítems</span>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-red-300 hover:text-red-100 p-1 hover:bg-slate-700 rounded transition-colors" title="Vaciar"><Trash2 size={16} /></button>
            )}
          </div>
        </div>

        {/* Lista Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 opacity-50">
              <ScanBarcode size={48} className="mb-2" />
              <p className="text-sm font-bold">Esperando productos...</p>
            </div>
          ) : cart.map(item => (
            <div key={item.id_variante} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 animate-fade-in-down">
              <div className="flex justify-between font-bold text-sm text-gray-800 mb-1">
                <span className="truncate w-2/3">{item.nombre}</span>
                <span className="text-green-700 font-mono">${item.subtotal.toLocaleString()}</span>
              </div>
              <div className="text-xs text-gray-500 mb-2 flex justify-between">
                <span>Talle: <b>{item.talle}</b></span>
                <span>SKU: {item.sku}</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1.5 bg-white border rounded-md hover:bg-gray-200 active:scale-90 transition-transform"><Minus size={12} /></button>
                  <span className="font-bold text-sm w-8 text-center">{item.cantidad}</span>
                  <button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1.5 bg-white border rounded-md hover:bg-gray-200 active:scale-90 transition-transform"><Plus size={12} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id_variante)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-colors"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Zona de Cobro */}
        <div className="p-4 bg-white border-t-2 border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20">

          <div className="mb-4">
            <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wide">Seleccionar Medio de Pago</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedMethod(m); setCreditNoteCode(''); }}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all active:scale-95 ${selectedMethod?.id === m.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                >
                  {getPaymentIcon(m.nombre)}
                  <span className="text-[9px] font-black mt-1 uppercase">{m.nombre}</span>
                </button>
              ))}
            </div>

            {/* INPUT DE NOTA DE CRÉDITO (Corregido para tildes y mayúsculas) */}
            {selectedMethod &&
              (selectedMethod.nombre.toLowerCase().includes('credito') || selectedMethod.nombre.toLowerCase().includes('crédito')) && (
                <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200 animate-fade-in shadow-sm">
                  <label className="text-xs font-bold text-yellow-800 uppercase block mb-1 flex items-center">
                    <AlertTriangle size={12} className="mr-1" /> Código de la Nota
                  </label>
                  <input
                    ref={creditNoteInputRef}
                    value={creditNoteCode}
                    onChange={e => setCreditNoteCode(e.target.value.toUpperCase())}
                    placeholder="NC-XXXXXX"
                    className="w-full p-2 border border-yellow-300 rounded font-mono text-center uppercase focus:ring-2 focus:ring-yellow-400 outline-none bg-white text-lg font-bold text-gray-800 placeholder-gray-300"
                  />
                </div>
              )}
          </div>

          {/* TOTAL Y EDICIÓN (Mejorado con Icono) */}
          <div className="flex justify-between items-end mb-4 border-b border-dashed pb-3">
            <div>
              <span className="text-gray-500 font-medium text-xs uppercase">Total a Cobrar</span>
              {descuentoVisual > 0 && <div className="text-xs text-green-600 font-bold bg-green-50 px-1 rounded inline-block mt-1">Ahorro: ${descuentoVisual.toLocaleString()}</div>}
            </div>
            <div
              onClick={() => setIsEditingPrice(true)}
              className="cursor-pointer group flex items-center relative"
              title="Haz clic para editar el precio final"
            >
              {isEditingPrice ? (
                <input
                  autoFocus
                  type="number"
                  className="text-3xl font-black text-right w-36 border-b-2 border-blue-500 outline-none bg-transparent"
                  value={customTotal === null ? subtotalCalculado : customTotal}
                  onChange={e => setCustomTotal(e.target.value)}
                  onBlur={() => setIsEditingPrice(false)}
                  onKeyDown={e => { if (e.key === 'Enter') setIsEditingPrice(false) }}
                />
              ) : (
                <>
                  <span className={`text-3xl font-black tracking-tighter transition-colors ${descuentoVisual !== 0 ? 'text-blue-600' : 'text-slate-800'}`}>
                    $ {totalFinal.toLocaleString()}
                  </span>
                  {/* ICONO DE EDICIÓN VISIBLE */}
                  <div className="ml-2 p-1 rounded-full bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    <Edit3 size={16} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleReservationClick}
              disabled={cart.length === 0}
              className="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 py-3.5 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CalendarClock className="mr-2" size={18} /> Reservar
            </button>

            <button
              onClick={handleCheckoutClick}
              disabled={cart.length === 0 || !selectedMethod}
              className={`text-white py-3.5 rounded-xl font-bold flex items-center justify-center shadow-lg transition-all active:scale-95 ${cart.length > 0 && selectedMethod
                ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-green-200'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              COBRAR <ArrowRight className="ml-2" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPage;