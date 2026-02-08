import { useState, useRef, useEffect } from 'react';
import { useAuth, api } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import Ticket from '../components/Ticket';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import ReservationModal from '../components/ReservationModal';
import { useScanDetection } from '../hooks/useScanDetection';
import {
  ShoppingCart, Trash2, Plus, Minus, ScanBarcode, Banknote,
  CreditCard, Smartphone, Lock, ArrowRight, Printer, Clock,
  Search, Shirt, CalendarClock, X, AlertTriangle, Receipt, Edit3,
  Maximize2, Filter, ChevronDown, Layers, Split, Eye
} from 'lucide-react';

const SOUNDS = {
  beep: new Audio('https://cdn.freesound.org/previews/536/536108_12152864-lq.mp3'),
  error: new Audio('https://cdn.freesound.org/previews/419/419023_8340785-lq.mp3')
};

const POSPage = () => {
  const { token } = useAuth();
  const [appliedNote, setAppliedNote] = useState(null);

  const [viewingSale, setViewingSale] = useState(null);

  // --- ESTADOS ---
  const [isRegisterOpen, setIsRegisterOpen] = useState(null);
  const [skuInput, setSkuInput] = useState('');

  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('pos_cart_backup');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      console.error("Error recuperando carrito", e);
      return [];
    }
  });

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [manualTerm, setManualTerm] = useState('');
  const [manualResults, setManualResults] = useState([]);

  const [categories, setCategories] = useState([]);
  const [specificCats, setSpecificCats] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  const [zoomImage, setZoomImage] = useState(null);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [creditNoteCode, setCreditNoteCode] = useState('');

  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState([{ id_metodo: '', monto: '' }]);

  const [recentSales, setRecentSales] = useState([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItemData, setCustomItemData] = useState({ description: '', price: '' });

  const [ticketData, setTicketData] = useState(null);
  const ticketRef = useRef(null);
  const reactToPrintFn = useReactToPrint({ contentRef: ticketRef });

  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const creditNoteInputRef = useRef(null);

  useScanDetection(inputRef);

  useEffect(() => {
    localStorage.setItem('pos_cart_backup', JSON.stringify(cart));
  }, [cart]);

  const subtotalCalculado = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalFinal = customTotal !== null && customTotal !== '' ? parseFloat(customTotal) : subtotalCalculado;
  const descuentoVisual = subtotalCalculado - totalFinal;

  const addSplitLine = () => setSplitPayments([...splitPayments, { id_metodo: '', monto: '' }]);
  const removeSplitLine = (index) => {
    const newSplits = [...splitPayments];
    newSplits.splice(index, 1);
    setSplitPayments(newSplits);
  };
  const updateSplit = (index, field, value) => {
    const newSplits = [...splitPayments];
    newSplits[index][field] = value;
    setSplitPayments(newSplits);
  };

  const totalPagadoMixto = splitPayments.reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);
  const restanteMixto = totalFinal - totalPagadoMixto;

  const playSound = (type) => {
    try {
      const audio = SOUNDS[type];
      if (audio) { audio.currentTime = 0; audio.volume = 0.5; audio.play().catch(e => console.warn(e)); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const init = async () => {
      if (!token) return;
      try {
        const [resStatus, resMethods, resCats, resSpecs] = await Promise.all([
          api.get('/sales/caja/status'),
          api.get('/sales/payment-methods'),
          api.get('/products/categories'),
          api.get('/products/specific-categories')
        ]);
        setIsRegisterOpen(resStatus.data.estado === 'abierta');
        setPaymentMethods(resMethods.data);
        setCategories(resCats.data);
        setSpecificCats(resSpecs.data);
        if (resStatus.data.estado === 'abierta') fetchRecentSales();
      } catch (error) { toast.error("Error de conexión inicial"); }
    };
    init();
  }, [token]);

  const fetchRecentSales = async () => {
    try {
      const res = await api.get('/sales/history', { params: { current_session: true, limit: 10 } });
      setRecentSales(res.data.history);
    } catch (error) { console.error("Error historial", error); }
  };

  useEffect(() => {
    if (!isRegisterOpen || isEditingPrice || isConfirmModalOpen || isReservationModalOpen || zoomImage || isCustomModalOpen) return;
    if (isSearchMode) searchInputRef.current?.focus();
    else if (document.activeElement !== creditNoteInputRef.current) inputRef.current?.focus();
  }, [cart, isRegisterOpen, isEditingPrice, isConfirmModalOpen, isReservationModalOpen, isSearchMode, zoomImage, isCustomModalOpen]);

  useEffect(() => {
    if (!manualTerm.trim() && !selectedCat && !selectedSpec) {
      setManualResults([]);
      return;
    }
    const delaySearch = setTimeout(async () => {
      try {
        const params = { limit: 100 };
        if (manualTerm.trim()) params.search = manualTerm;
        if (selectedCat) params.category_id = selectedCat;
        if (selectedSpec) params.specific_id = selectedSpec;
        const res = await api.get('/products', { params });
        setManualResults(res.data.products || []);
      } catch (error) { console.error(error); }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [manualTerm, isSearchMode, selectedCat, selectedSpec]);

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
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

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

  const addToCart = (product) => {
    setCustomTotal(null);
    setCart((prevCart) => {
      const existing = prevCart.find(i => i.id_variante === product.id_variante);
      if (existing) {
        if (existing.cantidad + 1 > product.stock_actual) {
          toast.error("Stock insuficiente"); playSound('error'); return prevCart;
        }
        return prevCart.map(i => i.id_variante === product.id_variante ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio } : i);
      } else {
        if (product.stock_actual < 1) { toast.error("Sin stock"); playSound('error'); return prevCart; }
        return [...prevCart, { ...product, cantidad: 1, subtotal: product.precio }];
      }
    });
  };

  const updateQuantity = (id, delta) => {
    setCustomTotal(null);
    setCart(prev => prev.map(item => {
      if (item.id_variante === id) {
        const newQty = Math.max(1, item.cantidad + delta);
        if (newQty < 1 || newQty > item.stock_actual) return item;
        return { ...item, cantidad: newQty, subtotal: newQty * item.precio };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => { setCustomTotal(null); setCart(prev => prev.filter(i => i.id_variante !== id)); };
  const clearCart = () => { if (window.confirm("¿Vaciar carrito?")) setCart([]); };

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    if (isSplitPayment) {
      if (Math.abs(restanteMixto) > 0.5) {
        toast.error(`Faltan $${restanteMixto.toLocaleString()} por asignar`);
        return;
      }
      if (splitPayments.some(p => !p.id_metodo || !p.monto)) {
        toast.error("Completa todos los campos de pago");
        return;
      }
    } else {
      if (!selectedMethod) { toast.error("Selecciona medio de pago"); playSound('error'); return; }
      const mName = selectedMethod.nombre.toLowerCase();
      if ((mName.includes('credito') || mName.includes('crédito')) && !creditNoteCode.trim()) {
        toast.error("Ingresa código de Nota"); playSound('error');
        setTimeout(() => creditNoteInputRef.current?.focus(), 200); return;
      }
    }
    setIsConfirmModalOpen(true);
  };

  const processSale = async () => {
    const toastId = toast.loading("Procesando...");
    setIsConfirmModalOpen(false);
    try {
      const mName = selectedMethod ? selectedMethod.nombre.toLowerCase() : "";
      const esNota = !isSplitPayment && (mName.includes('credito') || mName.includes('crédito'));
      let notaEnv = esNota ? creditNoteCode : (appliedNote?.codigo || null);

      if (esNota) {
        try {
          const check = await api.get(`/sales/notas-credito/validar/${creditNoteCode}`);
          if (check.data.monto < totalFinal) {
            setAppliedNote({ codigo: creditNoteCode, monto: check.data.monto });
            setCustomTotal(totalFinal - check.data.monto);
            setSelectedMethod(null); setCreditNoteCode('');
            toast.dismiss(toastId);
            toast("Saldo parcial aplicado.", { icon: '💰' });
            return;
          }
        } catch (e) { toast.error("Nota inválida"); return; }
      }

      let payload = {
        items: cart,
        subtotal_calculado: subtotalCalculado,
        total_final: totalFinal,
        codigo_nota_credito: notaEnv
      };

      if (isSplitPayment) {
        payload.pagos = splitPayments.map(p => ({ id_metodo: p.id_metodo, monto: parseFloat(p.monto) }));
        payload.metodo_pago_id = splitPayments[0].id_metodo;
      } else {
        payload.metodo_pago_id = selectedMethod.id;
      }

      const res = await api.post('/sales/checkout', payload);

      let metodoNombre = "Mixto";
      if (!isSplitPayment && selectedMethod) metodoNombre = selectedMethod.nombre;
      if (isSplitPayment) metodoNombre = "Pago Combinado";

      setTicketData({
        id_venta: res.data.id,
        fecha: new Date().toLocaleString(),
        items: cart,
        total: totalFinal,
        cliente: "Consumidor Final",
        metodo: metodoNombre
      });

      playSound('beep'); toast.success(`Venta #${res.data.id} OK`, { id: toastId });
      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null);
      setCreditNoteCode(''); setAppliedNote(null); setIsSplitPayment(false); setSplitPayments([{ id_metodo: '', monto: '' }]);
      fetchRecentSales();
    } catch (e) { playSound('error'); toast.error(e.response?.data?.msg || "Error", { id: toastId }); }
  };

  const handleVoidSale = async (vid) => {
    if (!window.confirm("¿ANULAR VENTA? Stock volverá.")) return;
    try { await api.delete(`/sales/${vid}/anular`); toast.success("Anulada"); fetchRecentSales(); }
    catch (e) { toast.error("Error al anular"); }
  };

  const handleReprint = (v) => {
    setTicketData({ id_venta: v.id, fecha: v.fecha, items: v.items_detail || [], total: v.total, cliente: "Reimpresión" });
    setTimeout(() => reactToPrintFn(), 200);
  };

  const processReservation = async (rd) => {
    try {
      await api.post('/sales/reservas/crear', { items: cart, total: totalFinal, sena: rd.sena, cliente: rd.cliente, telefono: rd.telefono, id_metodo_pago: rd.metodo_pago_id });
      toast.success("Reservado"); setCart([]); setIsReservationModalOpen(false); fetchRecentSales();
    } catch (e) { toast.error("Error"); }
  };

  const addCustomItem = (e) => {
    e.preventDefault();
    setCart(prev => [...prev, { id_variante: `custom-${Date.now()}`, sku: 'MANUAL', nombre: customItemData.description.toUpperCase(), talle: '-', precio: parseFloat(customItemData.price), cantidad: 1, stock_actual: 9999, subtotal: parseFloat(customItemData.price), is_custom: true }]);
    setCustomItemData({ description: '', price: '' }); setIsCustomModalOpen(false);
  };

  const getPaymentIcon = (n) => {
    const name = n.toLowerCase();
    if (name.includes('tarjeta')) return <CreditCard size={20} />;
    if (name.includes('transferencia')) return <Smartphone size={20} />;
    if (name.includes('credito')) return <Receipt size={20} />;
    return <Banknote size={20} />;
  };

  const getMethodBadgeColor = (m) => {
    const name = (m || '').toLowerCase();
    if (name.includes('efectivo')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (name.includes('tarjeta')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300';
  };

  if (isRegisterOpen === false) return <div className="h-[80vh] flex items-center justify-center bg-gray-100 dark:bg-slate-950"><Link to="/caja-control" className="bg-black dark:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold">Abrir Caja</Link></div>;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-2 bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
      <Toaster position="top-center" />
      <div style={{ display: 'none' }}><div ref={ticketRef}><Ticket saleData={ticketData} /></div></div>
      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={processSale} title="Cobrar" message={`Total: $${totalFinal.toLocaleString()}`} confirmText="Confirmar" />
      <ReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} onConfirm={processReservation} total={totalFinal} paymentMethods={paymentMethods} />

      {/* --- COLUMNA IZQUIERDA: ESCÁNER Y VENTAS RECIENTES --- */}
      <div className="w-full md:w-2/3 flex flex-col gap-4 h-full">

        {/* Panel Escáner */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 relative z-50 transition-all duration-300">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-700 dark:text-white flex items-center gap-2">
              {isSearchMode ? <Search className="text-purple-600 dark:text-purple-400" /> : <ScanBarcode className="text-blue-600 dark:text-blue-400" />}
              {isSearchMode ? "Búsqueda Manual & Filtros" : "Modo Escáner"}
            </h2>

            <div className="flex gap-2">
              <button onClick={() => setIsCustomModalOpen(true)} className="text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40">
                <Plus size={14} className="mr-1" /> Libre
              </button>
              <button
                onClick={() => { setIsSearchMode(!isSearchMode); setManualTerm(''); setManualResults([]); setSelectedCat(''); setSelectedSpec(''); }}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center transition-all ${isSearchMode ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800'}`}
              >
                {isSearchMode ? "Usar Escáner" : "Buscar Manual"}
              </button>
            </div>
          </div>

          {isSearchMode ? (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedCat}
                    onChange={(e) => setSelectedCat(e.target.value)}
                    className="w-full p-2 pl-3 pr-8 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-bold text-gray-700 dark:text-white appearance-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 outline-none"
                  >
                    <option value="">Todas las Categorías</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                </div>

                <div className="relative flex-1">
                  <select
                    value={selectedSpec}
                    onChange={(e) => setSelectedSpec(e.target.value)}
                    className="w-full p-2 pl-3 pr-8 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-bold text-gray-700 dark:text-white appearance-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/50 outline-none"
                  >
                    <option value="">Todas las Ligas</option>
                    {specificCats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
                </div>

                {(selectedCat || selectedSpec || manualTerm) && (
                  <button
                    onClick={() => { setSelectedCat(''); setSelectedSpec(''); setManualTerm(''); }}
                    className="bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 p-2 rounded-lg border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40"
                    title="Limpiar filtros"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  ref={searchInputRef}
                  value={manualTerm}
                  onChange={e => setManualTerm(e.target.value)}
                  placeholder="Escribe para refinar (ej: Boca, XL)..."
                  className="w-full p-4 border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-50 dark:focus:ring-purple-900/20 transition-all text-lg placeholder-gray-400 dark:placeholder-slate-600"
                  autoFocus
                />

                {(manualResults.length > 0 || (isSearchMode && (selectedCat || selectedSpec))) && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-b-xl mt-1 max-h-[60vh] overflow-y-auto z-50">
                    {manualResults.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 italic">No se encontraron productos con estos filtros.</div>
                    ) : (
                      manualResults.map(p => (
                        <div key={p.id} className="p-3 border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 flex gap-3 cursor-pointer group">
                          <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 flex items-center justify-center border dark:border-slate-600 overflow-hidden cursor-zoom-in relative"
                            onClick={(e) => { if (p.imagen) { e.stopPropagation(); setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); } }}
                          >
                            {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={20} className="text-gray-300 dark:text-slate-500" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between font-bold text-sm text-gray-800 dark:text-white">
                              <span>{p.nombre}</span>
                              <span className="text-blue-600 dark:text-blue-400">${p.precio}</span>
                            </div>
                            <div className="text-xs text-gray-400 dark:text-slate-500 mb-1 flex gap-2">
                              {p.categoria && <span className="bg-gray-100 dark:bg-slate-700 px-1 rounded">{p.categoria}</span>}
                              {p.liga && <span className="bg-gray-100 dark:bg-slate-700 px-1 rounded">{p.liga}</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {p.variantes.map(v => (
                                <button
                                  key={v.id_variante}
                                  onClick={(e) => { e.stopPropagation(); handleManualAdd(p, v); }}
                                  disabled={v.stock === 0}
                                  className={`text-xs px-3 py-1 rounded border transition-all flex items-center gap-1 ${v.stock > 0 ? 'hover:bg-purple-600 hover:text-white border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed border-gray-200 dark:border-slate-600'}`}
                                >
                                  <span className="font-bold">{v.talle}</span>
                                  <span className="text-[10px] opacity-70 border-l pl-1 ml-1 border-current">{v.stock}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleScan} className="relative flex gap-2">
              <input ref={inputRef} value={skuInput} onChange={e => setSkuInput(e.target.value)} placeholder="CÓDIGO DE BARRAS..." className="flex-1 text-2xl p-4 border-2 border-blue-500 dark:border-blue-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900/30 uppercase font-mono tracking-wider transition-all placeholder-gray-300 dark:placeholder-slate-600" autoFocus />
              <button type="submit" className="px-6 text-xl font-bold bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:scale-95 transition-all">ENTER</button>
            </form>
          )}
        </div>

        {/* --- MODAL DETALLE DE VENTA --- */}
        {/* --- MODAL DETALLE DE VENTA --- */}
        {viewingSale && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingSale(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] transition-colors" onClick={e => e.stopPropagation()}>

              {/* Header Modal */}
              <div className="bg-slate-50 dark:bg-slate-900 p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-gray-800 dark:text-white">Venta #{viewingSale.id}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{viewingSale.fecha} • {viewingSale.metodo}</p>
                </div>
                <button onClick={() => setViewingSale(null)} className="text-gray-400 hover:text-red-500 p-1"><X size={20} /></button>
              </div>

              {/* Lista de Items */}
              <div className="overflow-y-auto p-0 flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {viewingSale.items_detail?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-gray-700 dark:text-gray-200 text-xs">{item.nombre}</p>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">Talle: {item.talle}</span>
                        </td>
                        <td className="p-3 text-center text-gray-600 dark:text-gray-300 font-bold">{item.cantidad}</td>
                        <td className="p-3 text-right font-mono text-gray-800 dark:text-white font-bold">$ {item.subtotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Modal */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <button
                  onClick={() => { handleReprint(viewingSale); }}
                  className="flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold transition-colors"
                >
                  <Printer size={14} className="mr-1" /> Imprimir
                </button>
                <div className="text-right">
                  <span className="text-gray-500 dark:text-gray-400 text-xs mr-2 uppercase font-bold">Total</span>
                  <span className="text-xl font-black text-gray-900 dark:text-white">$ {viewingSale.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LISTA HISTORIAL */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col relative z-0 overflow-hidden transition-colors">
          <div className="p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700 dark:text-white flex items-center"><Clock size={16} className="mr-2 text-blue-500 dark:text-blue-400" /> Últimas Ventas</h3>
            <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">Turno Actual</span>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-500 font-bold sticky top-0 shadow-sm z-10"><tr><th className="p-3">Hora</th><th className="p-3">Items</th><th className="p-3 text-center">Pago</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {recentSales.map(v => (
                  <tr key={v.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                    <td className="p-3 text-gray-500 dark:text-slate-400 font-mono">{v.fecha.split(' ')[1]}</td>
                    <td className="p-3 text-gray-700 dark:text-slate-200 truncate max-w-[150px]" title={v.items}>{v.items}</td>
                    <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getMethodBadgeColor(v.metodo)}`}>{v.metodo}</span></td>
                    <td className="p-3 font-bold text-gray-900 dark:text-white text-right">${v.total.toLocaleString()}</td>
                    <td className="p-3 text-center flex justify-center gap-2">
                      <button
                        onClick={() => setViewingSale(v)}
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1.5 transition-colors"
                        title="Ver Detalle"
                      >
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleReprint(v)} className="text-gray-300 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400 p-1.5"><Printer size={16} /></button>
                      <button onClick={() => handleVoidSale(v.id)} className="text-red-300 dark:text-red-900 hover:text-red-600 dark:hover:text-red-400 p-1.5"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-300 dark:text-slate-600 italic">Sin ventas recientes</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- COLUMNA DERECHA (Carrito y Cobro) --- */}
      <div className="w-full md:w-1/3 bg-white dark:bg-slate-800 flex flex-col rounded-2xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden h-full relative z-10 transition-colors">
        <div className="p-4 bg-slate-800 dark:bg-slate-900 text-white flex justify-between items-center shadow-md z-10">
          <h3 className="font-bold text-lg flex items-center"><ShoppingCart className="mr-2" /> Ticket Actual</h3>
          <div className="flex items-center gap-2">
            <span className="bg-slate-700 dark:bg-slate-800 px-2 py-1 rounded text-xs font-bold">{cart.length} ítems</span>
            {cart.length > 0 && <button onClick={clearCart} className="text-red-300 hover:text-red-100 p-1 hover:bg-slate-700 rounded transition-colors"><Trash2 size={16} /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/50">
          {cart.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-slate-600 opacity-50"><ScanBarcode size={48} className="mb-2" /><p className="text-sm font-bold">Esperando productos...</p></div> : cart.map(item => (
            <div key={item.id_variante} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 animate-fade-in-down transition-colors">
              <div className="flex justify-between font-bold text-sm text-gray-800 dark:text-white mb-1"><span className="truncate w-2/3">{item.nombre}</span><span className="text-green-700 dark:text-green-400 font-mono">${item.subtotal.toLocaleString()}</span></div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mb-2 flex justify-between"><span>Talle: <b>{item.talle}</b></span><span>SKU: {item.sku}</span></div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700 p-1 rounded-lg border border-gray-100 dark:border-slate-600">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1.5 bg-white dark:bg-slate-600 border dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500 dark:text-white"><Minus size={12} /></button>
                  <span className="font-bold text-sm w-8 text-center dark:text-white">{item.cantidad}</span>
                  <button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1.5 bg-white dark:bg-slate-600 border dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500 dark:text-white"><Plus size={12} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id_variante)} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"><X size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER COBRO */}
        <div className="p-4 bg-white dark:bg-slate-800 border-t-2 border-gray-100 dark:border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 transition-colors">
          {appliedNote && <div className="mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg flex justify-between items-center animate-pulse"><div><span className="text-xs font-bold text-green-700 dark:text-green-400 block">NOTA APLICADA</span><span className="text-sm font-mono text-gray-700 dark:text-gray-300">{appliedNote.codigo} (-${appliedNote.monto.toLocaleString()})</span></div><button onClick={() => { setAppliedNote(null); setCustomTotal(null); toast("Nota quitada"); }} className="text-red-400 hover:text-red-600 p-1"><X size={16} /></button></div>}

          <div className="flex justify-between items-center mb-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Medio de Pago</p>
            <button
              onClick={() => setIsSplitPayment(!isSplitPayment)}
              className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${isSplitPayment ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 border-transparent'}`}
            >
              {isSplitPayment ? 'Volver a Simple' : 'Pago Combinado'}
            </button>
          </div>

          {!isSplitPayment ? (
            // --- MODO SIMPLE ---
            <div className="mb-4">
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMethod(m); setCreditNoteCode(''); }} className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all active:scale-95 ${selectedMethod?.id === m.id ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200 dark:ring-blue-900' : 'bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-600'}`}>{getPaymentIcon(m.nombre)}<span className="text-[9px] font-black mt-1 uppercase">{m.nombre}</span></button>
                ))}
              </div>
              {selectedMethod && (selectedMethod.nombre.toLowerCase().includes('credito') || selectedMethod.nombre.toLowerCase().includes('crédito')) && (<div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 animate-fade-in shadow-sm"><label className="text-xs font-bold text-yellow-800 dark:text-yellow-500 uppercase block mb-1 flex items-center"><AlertTriangle size={12} className="mr-1" /> Código de la Nota</label><input ref={creditNoteInputRef} value={creditNoteCode} onChange={e => setCreditNoteCode(e.target.value.toUpperCase())} placeholder="NC-XXXXXX" className="w-full p-2 border border-yellow-300 dark:border-yellow-700 rounded font-mono text-center uppercase focus:ring-2 focus:ring-yellow-400 outline-none bg-white dark:bg-slate-900 text-lg font-bold text-gray-800 dark:text-white placeholder-gray-300" /></div>)}
            </div>
          ) : (
            // --- MODO COMBINADO ---
            <div className="mb-4 bg-purple-50 dark:bg-purple-900/10 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30 animate-fade-in">
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {splitPayments.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={p.id_metodo}
                      onChange={(e) => updateSplit(idx, 'id_metodo', e.target.value)}
                      className="flex-1 text-xs p-2 rounded border border-purple-200 dark:border-purple-800 outline-none bg-white dark:bg-slate-900 dark:text-white"
                    >
                      <option value="">Método...</option>
                      {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1.5 text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        value={p.monto}
                        onChange={(e) => updateSplit(idx, 'monto', e.target.value)}
                        className="w-full pl-5 p-1.5 text-xs font-bold rounded border border-purple-200 dark:border-purple-800 outline-none bg-white dark:bg-slate-900 dark:text-white"
                        placeholder="0"
                      />
                    </div>
                    {splitPayments.length > 1 && (
                      <button onClick={() => removeSplitLine(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-2 pt-2 border-t border-purple-200 dark:border-purple-800">
                <button onClick={addSplitLine} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 flex items-center hover:underline">
                  <Plus size={12} className="mr-1" /> Agregar otro
                </button>
                <span className={`text-xs font-bold ${restanteMixto === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {restanteMixto === 0 ? 'OK' : `Faltan: $${restanteMixto.toLocaleString()}`}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-end mb-4 border-b border-dashed border-gray-300 dark:border-slate-700 pb-3"><div><span className="text-gray-500 dark:text-gray-400 font-medium text-xs uppercase">Total a Cobrar</span>{descuentoVisual > 0 && <div className="text-xs text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/30 px-1 rounded inline-block mt-1">Ahorro: ${descuentoVisual.toLocaleString()}</div>}</div><div onClick={() => setIsEditingPrice(true)} className="cursor-pointer group flex items-center relative" title="Editar precio final">{isEditingPrice ? (<input autoFocus type="number" className="text-3xl font-black text-right w-36 border-b-2 border-blue-500 outline-none bg-transparent dark:text-white" value={customTotal === null ? subtotalCalculado : customTotal} onChange={e => setCustomTotal(e.target.value)} onBlur={() => setIsEditingPrice(false)} onKeyDown={e => { if (e.key === 'Enter') setIsEditingPrice(false) }} />) : (<><span className={`text-3xl font-black tracking-tighter transition-colors ${descuentoVisual !== 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-white'}`}>$ {totalFinal.toLocaleString()}</span><div className="ml-2 p-1 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 transition-colors"><Edit3 size={16} /></div></>)}</div></div>
          <div className="grid grid-cols-2 gap-3"><button onClick={() => setIsReservationModalOpen(true)} disabled={cart.length === 0} className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 py-3.5 rounded-xl font-bold flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"><CalendarClock className="mr-2" size={18} /> Reservar</button>

            <button
              onClick={handleCheckoutClick}
              disabled={cart.length === 0 || (!isSplitPayment && !selectedMethod)}
              className={`text-white py-3.5 rounded-xl font-bold flex items-center justify-center shadow-lg transition-all active:scale-95 ${cart.length > 0 && (selectedMethod || isSplitPayment) ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-green-200 dark:shadow-none' : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'}`}
            >
              COBRAR <ArrowRight className="ml-2" size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL ÍTEM LIBRE */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up transition-colors">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center"><Edit3 className="mr-2 text-yellow-500" /> Ítem Libre</h3>
              <button onClick={() => setIsCustomModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={24} /></button>
            </div>
            <form onSubmit={addCustomItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Descripción</label>
                <input autoFocus required value={customItemData.description} onChange={e => setCustomItemData({ ...customItemData, description: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold text-gray-700 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Precio</label>
                <input type="number" required min="0" step="0.01" value={customItemData.price} onChange={e => setCustomItemData({ ...customItemData, price: e.target.value })} className="w-full p-3 border dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-yellow-400 font-bold text-xl text-gray-700 dark:text-white" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsCustomModalOpen(false)} className="flex-1 py-3 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-yellow-500 text-white font-bold rounded-xl hover:bg-yellow-600 shadow-lg shadow-yellow-200 dark:shadow-none">Agregar</button>





              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;