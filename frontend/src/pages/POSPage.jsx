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
  CreditCard, Smartphone, ArrowRight, Printer, Clock,
  Search, Shirt, CalendarClock, X, AlertTriangle, Receipt, Edit3,
  ChevronDown, Users, TrendingUp, TrendingDown, Eye, Tag, Store, Lock,
  MonitorSmartphone
} from 'lucide-react';

const getRealEstampa = (estampaStr) => {
    if (!estampaStr) return null;
    const clean = estampaStr.toString().trim().toUpperCase();
    if (clean === '' || clean === 'STANDARD' || clean === 'SIN ESTAMPA' || clean === '-' || clean === 'N/A' || clean === 'SIN DORSAL') {
        return null;
    }
    return estampaStr;
};

const VariantSelectionModal = ({ product, isOpen, onClose, onSelect }) => {
  if (!isOpen || !product) return null;

  const groupedVariants = product.variantes.reduce((acc, v) => {
      if (!acc[v.talle]) acc[v.talle] = [];
      const estampaName = getRealEstampa(v.estampa) || 'Sin Estampa';
      acc[v.talle].push({ ...v, estampaName });
      return acc;
  }, {});

  const targetTalles = product.preselectedTalle 
      ? [product.preselectedTalle] 
      : Object.keys(groupedVariants);

  return (
      <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
              
              <div className="bg-indigo-50 dark:bg-slate-900 p-5 border-b border-indigo-100 dark:border-slate-700 flex justify-between items-center shrink-0">
                  <div>
                      <h3 className="font-black text-xl text-indigo-900 dark:text-white flex items-center">
                          <Shirt className="mr-2 text-indigo-500" size={24}/> Seleccionar Estampa
                      </h3>
                      <p className="text-sm text-indigo-700 dark:text-slate-400 mt-1 font-medium">{product.nombre}</p>
                  </div>
                  <button onClick={onClose} className="p-2 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-full shadow-sm border border-slate-200 dark:border-slate-600 transition-colors">
                      <X size={20} />
                  </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-slate-800/50">
                  <div className="space-y-6">
                      {targetTalles.map(talle => {
                          const detalles = groupedVariants[talle].sort((a, b) => 
                              a.estampaName === 'Sin Estampa' ? -1 : b.estampaName === 'Sin Estampa' ? 1 : 0
                          );

                          return (
                              <div key={talle} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <h4 className="font-black text-lg text-slate-800 dark:text-white mb-3 flex items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                                      Talle {talle}
                                  </h4>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      {detalles.map(det => (
                                          <button
                                              key={det.id_variante}
                                              disabled={det.stock === 0}
                                              onClick={() => onSelect(product, det)}
                                              className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all active:scale-95 text-center
                                                  ${det.stock > 0 
                                                      ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 hover:border-indigo-400 dark:hover:bg-indigo-900/50 cursor-pointer' 
                                                      : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 opacity-50 cursor-not-allowed grayscale'}`}
                                          >
                                              <span className={`font-bold text-sm mb-1 ${det.stock > 0 ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-500 dark:text-slate-400 line-through'}`}>
                                                  {det.estampaName}
                                              </span>
                                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${det.stock > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'}`}>
                                                  {det.stock > 0 ? `Stock: ${det.stock}` : 'SIN STOCK'}
                                              </span>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      </div>
  );
};

const POSPage = () => {
  const { token } = useAuth();
  
  // --- IDENTIDAD DE TERMINAL Y MODAL ---
  const [tipoCaja, setTipoCaja] = useState(() => localStorage.getItem('terminal_tipo_caja') || 'PRINCIPAL');
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const isMerch = tipoCaja === 'MERCHANDISING';

  const [appliedNote, setAppliedNote] = useState(null);
  const [viewingSale, setViewingSale] = useState(null); // EL ESTADO DEL OJITO

  const [isRegisterOpen, setIsRegisterOpen] = useState(null);
  const [skuInput, setSkuInput] = useState('');

  const [allCarts, setAllCarts] = useState(() => {
    try {
      const savedMulti = localStorage.getItem('pos_multi_carts_backup');
      if (savedMulti) return JSON.parse(savedMulti);
      return [[], [], [], []];
    } catch (e) {
      return [[], [], [], []];
    }
  });

  const [activeTab, setActiveTab] = useState(0);
  const cart = allCarts[activeTab];

  const setCart = (valueOrFn) => {
    setAllCarts(prev => {
      const newCarts = [...prev];
      const newVal = typeof valueOrFn === 'function' ? valueOrFn(newCarts[activeTab]) : valueOrFn;
      newCarts[activeTab] = newVal;
      return newCarts;
    });
  };

  const [isSearchMode, setIsSearchMode] = useState(true);
  const [manualTerm, setManualTerm] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [variantModalProduct, setVariantModalProduct] = useState(null);

  const [categories, setCategories] = useState([]);
  const [specificCats, setSpecificCats] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');
  const [zoomImage, setZoomImage] = useState(null);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);

  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

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
  const searchContainerRef = useRef(null);

  useScanDetection(inputRef);

  useEffect(() => {
    localStorage.setItem('pos_multi_carts_backup', JSON.stringify(allCarts));
  }, [allCarts]);

  const subtotalCalculado = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const surchargeAmount = subtotalCalculado * (surchargePercent / 100);
  const discountAmount = subtotalCalculado * (discountPercent / 100);
  const totalWithAdjustments = subtotalCalculado + surchargeAmount - discountAmount;
  const totalFinal = customTotal !== null && customTotal !== '' ? parseFloat(customTotal) : totalWithAdjustments;
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

  useEffect(() => {
    const init = async () => {
      if (!token) return;
      try {
        const [resStatus, resMethods, resCats, resSpecs] = await Promise.all([
          api.get('/sales/caja/status', { params: { tipo_caja: tipoCaja } }),
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
  }, [token, tipoCaja]);

  const fetchRecentSales = async () => {
    try {
      const res = await api.get('/sales/history', { params: { current_session: true, limit: 10, tipo_caja: tipoCaja } });
      setRecentSales(res.data.history);
    } catch (error) { console.error("Error historial", error); }
  };

  // --- LÓGICA DE CAMBIO DE TERMINAL (MODAL) ---
  const changeTerminal = (newTipo) => {
      if (newTipo === tipoCaja) {
          setIsTerminalModalOpen(false);
          return;
      }

      const hasItems = allCarts.some(c => c.length > 0);
      
      if (hasItems) {
          if (!window.confirm(`⚠️ ¡ALERTA!\nTienes ventas en curso.\nSi cambias a la terminal ${newTipo === 'MERCHANDISING' ? 'MERCH' : 'CAMPEONES'}, SE BORRARÁN TODOS LOS CARRITOS ACTUALES.\n\n¿Estás completamente seguro de querer cambiar y perder estos datos?`)) {
              return; 
          }
          setAllCarts([[], [], [], []]);
          setCustomTotal(null);
          setSurchargePercent(0);
          setDiscountPercent(0);
          setSplitPayments([{ id_metodo: '', monto: '' }]);
      }
      
      setTipoCaja(newTipo);
      localStorage.setItem('terminal_tipo_caja', newTipo);
      toast.success(`Cambiando a Terminal ${newTipo === 'MERCHANDISING' ? 'Merch' : 'Campeones'}`);
      setIsTerminalModalOpen(false);
  };

  useEffect(() => {
    if (!isRegisterOpen || isEditingPrice || editingItemId || isConfirmModalOpen || isReservationModalOpen || zoomImage || isCustomModalOpen || variantModalProduct || isTerminalModalOpen || viewingSale) return;
    if (!isMerch) {
        if (isSearchMode) searchInputRef.current?.focus();
        else if (document.activeElement !== creditNoteInputRef.current) inputRef.current?.focus();
    }
  }, [cart, isRegisterOpen, isEditingPrice, editingItemId, isConfirmModalOpen, isReservationModalOpen, isSearchMode, zoomImage, isCustomModalOpen, variantModalProduct, isMerch, isTerminalModalOpen, viewingSale]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isMerch) return; 
    if (!manualTerm.trim() && !selectedCat && !selectedSpec) {
      setManualResults([]);
      setShowDropdown(false);
      return;
    }
    const delaySearch = setTimeout(async () => {
      try {
        const params = { limit: 100, sort_by: 'mas_vendidos' };
        if (manualTerm.trim()) params.search = manualTerm;
        if (selectedCat) params.category_id = selectedCat;
        if (selectedSpec) params.specific_id = selectedSpec;
        const res = await api.get('/products', { params });
        setManualResults(res.data.products || []);
        setShowDropdown(true);
      } catch (error) { console.error(error); }
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [manualTerm, isSearchMode, selectedCat, selectedSpec, isMerch]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSizeClick = (product, talle) => {
    const variantsForSize = product.variantes.filter(v => v.talle === talle);
    const hasOptions = variantsForSize.some(v => getRealEstampa(v.estampa) !== null);

    if (!hasOptions) {
        const variantToAdd = variantsForSize.find(v => v.stock > 0) || variantsForSize[0];
        handleManualAdd(product, variantToAdd);
    } else {
        setVariantModalProduct({ ...product, preselectedTalle: talle });
        setShowDropdown(false);
    }
  };

  const handleProductSelectClick = (product) => {
    if (product.variantes.length === 1 && product.variantes[0].stock > 0) {
        handleManualAdd(product, product.variantes[0]);
        setShowDropdown(false);
    } else {
        setVariantModalProduct(product); 
        setShowDropdown(false);
    }
  };

  const handleManualAdd = (product, variant) => {
    if (variant.stock <= 0) {
        toast.error("Variante sin stock");
        return;
    }

    const itemFormatted = {
      id_variante: variant.id_variante,
      sku: variant.sku,
      nombre: product.nombre,
      talle: variant.talle,
      estampa: variant.estampa,
      precio: product.precio,
      stock_actual: variant.stock
    };
    addToCart(itemFormatted);

    const estampaReal = getRealEstampa(variant.estampa);
    const estampaText = estampaReal ? ` - ${estampaReal}` : '';
    toast.success(`${product.nombre} (${variant.talle}${estampaText}) agregado`);

    setVariantModalProduct(null); 
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!skuInput.trim() || isMerch) return;
    try {
      const res = await api.get(`/sales/scan/${skuInput}`);
      if (res.data.found) {
        addToCart(res.data.product);
        toast.success("OK", { position: 'bottom-left', duration: 800 });
        setSkuInput('');
      }
    } catch (error) {
      toast.error("Producto NO Encontrado", { position: 'bottom-left' });
      setSkuInput('');
    }
  };

  const addToCart = (product) => {
    setCustomTotal(null);
    setCart((prevCart) => {
      const existing = prevCart.find(i => i.id_variante === product.id_variante && !i.is_custom);
      if (existing) {
        if (existing.cantidad + 1 > product.stock_actual) {
          toast.error("Stock insuficiente"); return prevCart;
        }
        return prevCart.map(i => i.id_variante === product.id_variante ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio } : i);
      } else {
        if (product.stock_actual < 1) { toast.error("Sin stock"); return prevCart; }
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

  const updateItemPrice = (id, newPrice) => {
    setCustomTotal(null);
    setCart(prev => prev.map(item => {
      if (item.id_variante === id) {
        const parsedPrice = parseFloat(newPrice);
        const validPrice = isNaN(parsedPrice) ? item.precio : parsedPrice;
        return { ...item, precio: validPrice, subtotal: validPrice * item.cantidad };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => { setCustomTotal(null); setCart(prev => prev.filter(i => i.id_variante !== id)); };

  const clearCart = () => {
    if (window.confirm("¿Vaciar carrito?")) {
      setCart([]);
      setSurchargePercent(0);
      setDiscountPercent(0);
      setCustomTotal(null);
    }
  };

  const handleSwitchTab = (index) => {
    setActiveTab(index);
    setCustomTotal(null);
    setSurchargePercent(0);
    setDiscountPercent(0);
    setSkuInput('');
    setSelectedMethod(null);
    setIsSplitPayment(false);
  };

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
      if (!selectedMethod) { toast.error("Selecciona medio de pago"); return; }
      const mName = selectedMethod.nombre.toLowerCase();
      if ((mName.includes('credito') || mName.includes('crédito')) && !creditNoteCode.trim()) {
        toast.error("Ingresa código de Nota");
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
        codigo_nota_credito: notaEnv,
        tipo_caja: tipoCaja 
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

      const cartForTicket = cart.map(i => {
        const estampaReal = getRealEstampa(i.estampa);
        return {
          ...i,
          talle: estampaReal ? `${i.talle} - ${estampaReal}` : i.talle
        };
      });

      setTicketData({
        id_venta: res.data.id,
        fecha: new Date().toLocaleString(),
        items: cartForTicket,
        total: totalFinal,
        cliente: "Consumidor Final",
        metodo: metodoNombre,
        logo_alt: isMerch ? "MERCHANDISING" : null 
      });

      toast.success(`Venta #${res.data.id} OK`, { id: toastId });

      setCart([]); setSkuInput(''); setSelectedMethod(null); setCustomTotal(null);
      setCreditNoteCode(''); setAppliedNote(null); setIsSplitPayment(false); setSplitPayments([{ id_metodo: '', monto: '' }]);
      setSurchargePercent(0); setDiscountPercent(0);
      fetchRecentSales();
    } catch (e) { toast.error(e.response?.data?.msg || "Error", { id: toastId }); }
  };

  const handleVoidSale = async (vid) => {
    if (!window.confirm("¿ANULAR VENTA? Stock volverá.")) return;
    try { await api.delete(`/sales/${vid}/anular`); toast.success("Anulada"); fetchRecentSales(); }
    catch (e) { toast.error("Error al anular"); }
  };

  const handleReprint = (v) => {
    setTicketData({ id_venta: v.id, fecha: v.fecha, items: v.items_detail || [], total: v.total, cliente: "Reimpresión", logo_alt: isMerch ? "MERCHANDISING" : null });
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
    if (name.includes('58')) return <CreditCard size={20} />;
    if (name.includes('transferencia')) return <Smartphone size={20} />;
    if (name.includes('credito') || name.includes('crédito')) return <Receipt size={20} />;
    return <Banknote size={20} />;
  };

  const getMethodBadgeColor = (m) => {
    const name = (m || '').toLowerCase();
    if (name.includes('efectivo')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (name.includes('tarjeta')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 p-3 bg-gray-50 dark:bg-slate-950 transition-colors duration-300 relative">
      <Toaster position="top-center" />
      <div style={{ display: 'none' }}><div ref={ticketRef}><Ticket saleData={ticketData} /></div></div>
      <ConfirmModal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} onConfirm={processSale} title="Cobrar" message={`Total: $${totalFinal.toLocaleString()}`} confirmText="Confirmar" />
      <ReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} onConfirm={processReservation} total={totalFinal} paymentMethods={paymentMethods} />

      <VariantSelectionModal 
          product={variantModalProduct} 
          isOpen={!!variantModalProduct} 
          onClose={() => setVariantModalProduct(null)} 
          onSelect={handleManualAdd} 
      />

      {/* --- EL FAMOSO MODAL DE DETALLE DE VENTA RESTAURADO --- */}
      {viewingSale && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewingSale(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                <div className={`p-6 border-b flex justify-between items-center ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/50' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/50'}`}>
                    <div>
                        <h3 className={`font-black text-2xl tracking-tight flex items-center ${isMerch ? 'text-purple-800 dark:text-purple-400' : 'text-indigo-800 dark:text-indigo-400'}`}>
                            <Receipt className="mr-3" size={28}/> Venta #{viewingSale.id}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{viewingSale.fecha} • {viewingSale.metodo}</p>
                    </div>
                    <button onClick={() => setViewingSale(null)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm"><X size={24} /></button>
                </div>
                
                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar bg-slate-50 dark:bg-slate-900">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-black tracking-widest sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-4 pl-6">Producto / Talle</th>
                                <th className="p-4 text-center">Cant.</th>
                                <th className="p-4 text-right">Precio</th>
                                <th className="p-4 text-right pr-6">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {viewingSale.items_detail?.map((item, idx) => (
                                <tr key={idx} className={`transition-colors group ${isMerch ? 'hover:bg-purple-50/50 dark:hover:bg-purple-900/10' : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'}`}>
                                    <td className="p-4 pl-6">
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
                        <Printer size={18} className="mr-2" /> Reimprimir
                    </button>
                    <div className="text-right">
                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest block mb-0.5">Total Venta</span>
                        <span className={`text-3xl font-black tracking-tighter font-mono ${isMerch ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'}`}>$ {viewingSale.total.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- BOTÓN FLOTANTE CAMBIO DE TERMINAL --- */}
      <button
          onClick={() => setIsTerminalModalOpen(true)}
          className={`fixed bottom-6 left-6 z-[150] px-5 py-3.5 rounded-full flex items-center justify-center gap-2.5 shadow-2xl transition-all hover:scale-105 active:scale-95 border-2 ${
              isMerch 
              ? 'bg-purple-600 text-white border-purple-400 shadow-purple-500/50' 
              : 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/50'
          }`}
          title="Cambiar de Terminal"
      >
          {isMerch ? <Tag size={20} /> : <Store size={20} />}
          <span className="font-black text-[11px] uppercase tracking-widest leading-none mt-0.5">
              {isMerch ? 'MERCH' : 'CAMPEONES'}
          </span>
      </button>

      {/* --- MODAL CAMBIO DE TERMINAL --- */}
      {isTerminalModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsTerminalModalOpen(false)}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transition-colors border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-black text-xl text-slate-800 dark:text-white flex items-center">
                          <MonitorSmartphone className="mr-3 text-blue-500" size={24} /> Cambiar Terminal
                      </h3>
                      <button onClick={() => setIsTerminalModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm"><X size={20} /></button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                      <button 
                          onClick={() => changeTerminal('PRINCIPAL')}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${!isMerch ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                      >
                          <Store size={32} />
                          <span className="font-black uppercase tracking-widest text-sm">Caja Campeones</span>
                      </button>
                      <button 
                          onClick={() => changeTerminal('MERCHANDISING')}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${isMerch ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 shadow-sm' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-purple-300 dark:hover:border-purple-600'}`}
                      >
                          <Tag size={32} />
                          <span className="font-black uppercase tracking-widest text-sm">Caja Merchandising</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* PANTALLA DE BLOQUEO SI LA CAJA ELEGIDA ESTÁ CERRADA */}
      {isRegisterOpen === false ? (
          <div className={`flex-1 flex flex-col items-center justify-center rounded-3xl border shadow-sm transition-colors ${isMerch ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/50' : 'bg-indigo-50 dark:bg-slate-900/50 border-indigo-200 dark:border-slate-800'}`}>
              <div className={`p-6 rounded-full mb-6 border shadow-inner ${isMerch ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-500 border-purple-200 dark:border-purple-800' : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-500 border-indigo-200 dark:border-indigo-800'}`}>
                  <Lock size={64} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Caja Cerrada</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Debes abrir el turno operativo para la Terminal {isMerch ? 'Merch' : 'Principal'}</p>
              <Link to="/caja-control" className={`px-8 py-4 rounded-2xl font-black text-white shadow-lg uppercase tracking-widest transition-all active:scale-95 flex items-center ${isMerch ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 shadow-purple-500/30' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 shadow-indigo-500/30'}`}>
                  Ir a Control de Caja <ArrowRight size={18} className="ml-2" />
              </Link>
          </div>
      ) : (

      /* --- ZONA OPERATIVA (SOLO SI LA CAJA ESTÁ ABIERTA) --- */
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          {/* --- COLUMNA IZQUIERDA --- */}
          <div className="w-full md:w-[55%] xl:w-[60%] flex flex-col gap-4 h-full min-h-0">
            <div className={`p-5 rounded-2xl shadow-sm border relative z-[60] transition-all duration-300 shrink-0 ${isMerch ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/50' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
              {isMerch ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 md:p-10">
                      <p className="text-purple-600 dark:text-purple-300 mb-6 font-medium">Usa este botón para registrar artículos físicos de merchandising.</p>
                      <button onClick={() => { setCustomItemData({ description: '', price: '' }); setIsCustomModalOpen(true); }} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-8 md:px-12 py-6 rounded-3xl font-black text-xl md:text-2xl shadow-xl hover:scale-105 transition-all flex items-center active:scale-95 shadow-purple-500/30">
                          <Plus size={36} className="mr-4" /> AGREGAR ÍTEM MERCH
                      </button>
                  </div>
              ) : (
                  <>
                      <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-bold text-gray-700 dark:text-white flex items-center gap-2">
                          {isSearchMode ? <Search className="text-indigo-600 dark:text-indigo-400" /> : <ScanBarcode className="text-blue-600 dark:text-blue-400" />}
                          {isSearchMode ? "Búsqueda Manual & Filtros" : "Modo Escáner"}
                        </h2>

                        <div className="flex gap-2">
                          <button onClick={() => setIsCustomModalOpen(true)} className="text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/40">
                            <Plus size={14} className="mr-1" /> Libre
                          </button>
                          <button
                            onClick={() => { setIsSearchMode(!isSearchMode); setManualTerm(''); setManualResults([]); setSelectedCat(''); setSelectedSpec(''); }}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center transition-all ${isSearchMode ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'}`}
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
                                className="w-full p-2 pl-3 pr-8 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-bold text-gray-700 dark:text-white appearance-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 outline-none cursor-pointer"
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
                                className="w-full p-2 pl-3 pr-8 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-bold text-gray-700 dark:text-white appearance-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 outline-none cursor-pointer"
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

                          <div className="relative" ref={searchContainerRef}>
                            <input
                              ref={searchInputRef}
                              value={manualTerm}
                              onChange={e => {
                                setManualTerm(e.target.value);
                                setShowDropdown(true);
                              }}
                              onFocus={() => {
                                if (manualTerm.trim() || selectedCat || selectedSpec) setShowDropdown(true);
                              }}
                              onKeyDown={handleSearchKeyDown}
                              placeholder="Escribe para refinar (ej: Boca, XL)... (ESC para cerrar)"
                              className="w-full p-4 border-2 border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20 transition-all text-lg placeholder-indigo-300 dark:placeholder-slate-600"
                              autoFocus
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 dark:text-indigo-500" size={28} />

                            {showDropdown && (manualResults.length > 0 || (isSearchMode && (selectedCat || selectedSpec))) && (
                              <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-2xl rounded-b-xl mt-1 max-h-[60vh] overflow-y-auto z-[100] custom-scrollbar">
                                {manualResults.length === 0 ? (
                                  <div className="p-8 text-center text-gray-400 italic font-medium">No se encontraron productos con estos filtros.</div>
                                ) : (
                                  manualResults.map(p => {
                                    const tallesUnicos = Array.from(new Set(p.variantes.map(v => v.talle)));

                                    return (
                                      <div 
                                        key={p.id} 
                                        className="p-4 border-b dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700/80 flex gap-4 cursor-pointer transition-colors"
                                        onClick={() => handleProductSelectClick(p)}
                                      >
                                        <div className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-xl shrink-0 flex items-center justify-center border dark:border-slate-600 overflow-hidden cursor-zoom-in relative"
                                          onClick={(e) => { if (p.imagen) { e.stopPropagation(); setZoomImage(`${api.defaults.baseURL}/static/uploads/${p.imagen}`); } }}
                                        >
                                          {p.imagen ? <img src={`${api.defaults.baseURL}/static/uploads/${p.imagen}`} className="w-full h-full object-cover" /> : <Shirt size={32} className="text-gray-300 dark:text-slate-500" />}
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col justify-center">
                                          <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-black text-base text-gray-800 dark:text-white leading-tight">{p.nombre}</span>
                                                {p.categoria && <span className="block text-[10px] text-gray-500 dark:text-slate-400 uppercase mt-0.5 tracking-wider">{p.categoria}</span>}
                                            </div>
                                            <span className="text-indigo-600 dark:text-indigo-400 font-black text-lg">${p.precio}</span>
                                          </div>
                                          
                                          <div className="mt-1 flex flex-wrap gap-2">
                                              {tallesUnicos.length > 0 ? tallesUnicos.map(t => {
                                                  const variantsForSize = p.variantes.filter(v => v.talle === t);
                                                  const hasStock = variantsForSize.some(v => v.stock > 0);
                                                  
                                                  return (
                                                    <button 
                                                        key={t} 
                                                        disabled={!hasStock}
                                                        onClick={(e) => {
                                                            e.stopPropagation(); 
                                                            handleSizeClick(p, t);
                                                        }}
                                                        className={`text-sm font-black px-4 py-2 rounded-xl shadow-sm border-2 transition-all active:scale-95 ${
                                                            hasStock 
                                                            ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-slate-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-400'
                                                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 line-through opacity-70 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {t}
                                                    </button>
                                                  );
                                              }) : (
                                                  <span className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded">SIN STOCK</span>
                                              )}
                                          </div>

                                        </div>
                                      </div>
                                    );
                                  })
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
                  </>
              )}
            </div>

            <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border flex-1 flex flex-col min-h-0 overflow-hidden transition-colors ${isMerch ? 'border-purple-200 dark:border-purple-800/50' : 'border-gray-200 dark:border-slate-700'}`}>
              <div className="p-4 md:p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                <h3 className="text-sm font-bold text-gray-700 dark:text-white flex items-center"><Clock size={16} className={`mr-2 ${isMerch ? 'text-purple-500' : 'text-blue-500'}`} /> Últimas Ventas</h3>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isMerch ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' : 'text-gray-400 dark:text-slate-500 bg-gray-200 dark:bg-slate-700'}`}>Turno Actual</span>
              </div>
              <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 font-bold sticky top-0 shadow-sm z-10 text-[10px] uppercase tracking-widest">
                      <tr><th className="p-3">Hora</th><th className="p-3">Items</th><th className="p-3 text-center">Pago</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Acciones</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {recentSales.map(v => (
                      <tr key={v.id} className={`transition-colors group ${isMerch ? 'hover:bg-purple-50 dark:hover:bg-purple-900/10' : 'hover:bg-blue-50 dark:hover:bg-slate-700/50'}`}>
                        <td className="p-3 text-gray-500 dark:text-slate-400 font-mono font-bold">{v.fecha.split(' ')[1]}</td>
                        <td className="p-3 text-gray-700 dark:text-slate-200 truncate max-w-[150px]" title={v.items}>{v.items}</td>
                        <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${getMethodBadgeColor(v.metodo)}`}>{v.metodo}</span></td>
                        <td className="p-3 font-bold text-gray-900 dark:text-white text-right">${v.total.toLocaleString()}</td>
                        <td className="p-3 text-center flex justify-center gap-2">
                          <button onClick={() => setViewingSale(v)} className={`p-1.5 transition-colors ${isMerch ? 'text-purple-400 hover:text-purple-600 dark:text-purple-500 dark:hover:text-purple-400' : 'text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-400'}`} title="Ver Detalle"><Eye size={16} /></button>
                          <button onClick={() => handleReprint(v)} className="text-gray-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5 transition-colors"><Printer size={16} /></button>
                          <button onClick={() => handleVoidSale(v.id)} className="text-red-300 dark:text-red-900/50 hover:text-red-500 dark:hover:text-red-400 p-1.5 transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {recentSales.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-400 dark:text-slate-500 italic text-[10px] font-bold uppercase tracking-widest">Sin ventas recientes</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* --- COLUMNA DERECHA (Carrito y Cobro) --- */}
          <div className={`w-full md:w-[45%] xl:w-[40%] bg-white dark:bg-slate-800 flex flex-col rounded-2xl shadow-lg border overflow-hidden h-full min-h-0 relative z-10 transition-colors ${isMerch ? 'border-purple-200 dark:border-purple-800/50' : 'border-gray-200 dark:border-slate-700'}`}>
            <div className="flex border-b border-gray-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 shrink-0">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  onClick={() => handleSwitchTab(idx)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 border-r border-gray-200 dark:border-slate-800 last:border-r-0
                            ${activeTab === idx
                      ? (isMerch ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border-t-2 border-t-purple-600 dark:border-t-purple-400' : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-t-2 border-t-indigo-600 dark:border-t-indigo-400')
                      : 'bg-slate-50 dark:bg-slate-900 text-gray-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                >
                  <Users size={12} /> Cliente {idx + 1}
                  {allCarts[idx].length > 0 && (
                    <span className={`ml-1 px-1.5 rounded-full text-[9px] shadow-sm ${isMerch ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'}`}>{allCarts[idx].length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 bg-slate-800 dark:bg-slate-900 text-white flex justify-between items-center shadow-md z-10 shrink-0">
              <h3 className="font-bold text-lg flex items-center tracking-tight"><ShoppingCart className={`mr-2 ${isMerch ? 'text-fuchsia-400' : 'text-blue-400'}`} /> Ticket {isMerch ? 'Merch' : 'Actual'}</h3>
              <div className="flex items-center gap-2">
                <span className="bg-slate-700 dark:bg-slate-800 px-2 py-1 rounded text-xs font-bold border border-slate-600 dark:border-slate-700">{cart.length} ítems</span>
                {cart.length > 0 && <button onClick={clearCart} className="text-red-300 hover:text-red-100 p-1.5 hover:bg-slate-700 rounded transition-colors"><Trash2 size={16} /></button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 dark:text-slate-600 opacity-50">
                  {isMerch ? <Tag size={56} className="mb-3 text-purple-300 dark:text-purple-800" /> : <ScanBarcode size={56} className="mb-3 text-indigo-300 dark:text-indigo-800" />}
                  <p className="text-sm font-black uppercase tracking-widest">Esperando productos...</p>
                </div>
              ) : cart.map(item => {
                const estampaReal = getRealEstampa(item.estampa);
                return (
                  <div key={item.id_variante} className={`bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border animate-fade-in-down transition-colors relative group ${isMerch ? 'border-purple-100 dark:border-purple-800/50' : 'border-gray-200 dark:border-slate-700'}`}>

                    <button onClick={() => removeFromCart(item.id_variante)} className="absolute right-2 top-2 text-gray-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <X size={16} />
                    </button>

                    <div className="flex flex-col justify-between h-full">
                      <div className="pr-8 mb-3">
                        <p className="font-bold text-sm text-gray-800 dark:text-white truncate leading-tight" title={item.nombre}>{item.nombre}</p>

                        <div className="text-[10px] text-gray-500 dark:text-slate-400 mt-1.5 flex flex-wrap gap-2 items-center">
                          <span className={`px-2 py-0.5 rounded shadow-sm border font-black uppercase tracking-widest ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-800/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>Talle: {item.talle}</span>
                          {estampaReal && (
                            <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded shadow-sm font-black uppercase tracking-widest">
                              {estampaReal}
                            </span>
                          )}
                          <span className="truncate py-0.5">SKU: {item.sku}</span>
                        </div>

                      </div>

                      <div className={`flex justify-between items-end pt-3 border-t ${isMerch ? 'border-purple-50 dark:border-slate-700/50' : 'border-gray-50 dark:border-slate-700/50'}`}>
                        <div className="flex items-center bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-0.5 shadow-inner">
                          <button onClick={() => updateQuantity(item.id_variante, -1)} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"><Minus size={14} /></button>
                          <span className="font-black text-xs w-8 text-center text-gray-800 dark:text-white">{item.cantidad}</span>
                          <button onClick={() => updateQuantity(item.id_variante, 1)} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors"><Plus size={14} /></button>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-gray-400 dark:text-slate-500 uppercase font-black tracking-widest mb-0.5">Precio Subtotal</span>
                          {editingItemId === item.id_variante ? (
                            <input
                              type="number"
                              autoFocus
                              className={`w-24 text-right font-black text-sm border-b-2 outline-none px-1 rounded-t transition-all shadow-inner ${isMerch ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700' : 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700'} dark:text-white`}
                              defaultValue={item.precio}
                              onBlur={(e) => { updateItemPrice(item.id_variante, e.target.value); setEditingItemId(null); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { updateItemPrice(item.id_variante, e.target.value); setEditingItemId(null); } }}
                            />
                          ) : (
                            <div onClick={() => setEditingItemId(item.id_variante)} className={`flex items-center cursor-pointer group px-2 py-1 rounded-lg border border-transparent transition-colors ${isMerch ? 'bg-purple-50/50 hover:bg-purple-100 dark:bg-slate-900/50 dark:hover:bg-purple-900/30 hover:border-purple-200 dark:hover:border-purple-800' : 'bg-indigo-50/50 hover:bg-indigo-100 dark:bg-slate-900/50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 dark:hover:border-indigo-800'}`} title="Clic para editar precio unitario">
                              <span className={`font-black text-sm font-mono ${isMerch ? 'text-purple-700 dark:text-purple-400' : 'text-emerald-700 dark:text-emerald-400'}`}>$ {item.subtotal.toLocaleString()}</span>
                              <Edit3 size={12} className={`ml-1.5 transition-colors ${isMerch ? 'text-purple-300 group-hover:text-purple-600' : 'text-emerald-300 group-hover:text-emerald-600'}`} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* FOOTER COBRO */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20 transition-colors shrink-0">
              {appliedNote && <div className="mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex justify-between items-center animate-pulse"><div><span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 block mb-0.5">NOTA APLICADA</span><span className="text-sm font-black font-mono text-emerald-800 dark:text-emerald-300">{appliedNote.codigo} (-${appliedNote.monto.toLocaleString()})</span></div><button onClick={() => { setAppliedNote(null); setCustomTotal(null); toast("Nota quitada"); }} className="text-emerald-400 hover:text-emerald-600 p-1 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg"><X size={16} /></button></div>}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-orange-50 dark:bg-orange-900/10 p-2.5 rounded-xl border border-orange-100 dark:border-orange-900/30 shadow-sm">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center">
                      <TrendingUp size={10} className="mr-1" /> Recargo
                    </span>
                    <span className="text-[10px] font-black text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 px-1.5 py-0.5 rounded">
                      {surchargePercent}%
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="50" step="5" value={surchargePercent}
                    onChange={(e) => { setSurchargePercent(Number(e.target.value)); setCustomTotal(null); }}
                    className="w-full h-1.5 bg-orange-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500 mb-2.5"
                  />
                  <div className="flex gap-1 justify-between">
                    {[0, 10, 20].map(pct => (
                      <button key={pct} onClick={() => { setSurchargePercent(pct); setCustomTotal(null); }} className={`px-1.5 py-1 text-[9px] font-black rounded-md border transition-colors shadow-sm ${surchargePercent === pct ? 'bg-orange-500 text-white border-orange-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-orange-50'}`}>{pct}%</button>
                    ))}
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center">
                      <TrendingDown size={10} className="mr-1" /> Descuento
                    </span>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                      {discountPercent}%
                    </span>
                  </div>
                  <input
                    type="range" min="0" max="50" step="5" value={discountPercent}
                    onChange={(e) => { setDiscountPercent(Number(e.target.value)); setCustomTotal(null); }}
                    className="w-full h-1.5 bg-emerald-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2.5"
                  />
                  <div className="flex gap-1 justify-between">
                    {[0, 10, 20].map(pct => (
                      <button key={pct} onClick={() => { setDiscountPercent(pct); setCustomTotal(null); }} className={`px-1.5 py-1 text-[9px] font-black rounded-md border transition-colors shadow-sm ${discountPercent === pct ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-emerald-50'}`}>{pct}%</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">Medio de Pago</p>
                <button
                  onClick={() => setIsSplitPayment(!isSplitPayment)}
                  className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all uppercase tracking-widest shadow-sm ${isSplitPayment ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border-slate-200 dark:border-slate-600'}`}
                >
                  {isSplitPayment ? 'Volver a Simple' : 'Pago Mixto'}
                </button>
              </div>

              {!isSplitPayment ? (
                <div className="mb-5">
                  <div className="grid grid-cols-3 gap-2.5">
                    {paymentMethods.map(m => (
                      <button key={m.id} onClick={() => { setSelectedMethod(m); setCreditNoteCode(''); }} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all active:scale-95 shadow-sm ${selectedMethod?.id === m.id ? (isMerch ? 'bg-purple-600 text-white border-purple-500 shadow-purple-500/30' : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/30') : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{getPaymentIcon(m.nombre)}<span className="text-[9px] font-black mt-1.5 uppercase tracking-widest">{m.nombre.slice(0,8)}</span></button>
                    ))}
                  </div>
                  {selectedMethod && (selectedMethod.nombre.toLowerCase().includes('credito') || selectedMethod.nombre.toLowerCase().includes('crédito')) && (<div className="mt-4 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800 animate-fade-in shadow-sm"><label className="text-[10px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest block mb-2 flex items-center"><AlertTriangle size={14} className="mr-1.5" /> Código de la Nota</label><input ref={creditNoteInputRef} value={creditNoteCode} onChange={e => setCreditNoteCode(e.target.value.toUpperCase())} placeholder="NC-XXXXXX" className="w-full p-3 border-2 border-amber-300 dark:border-amber-700 rounded-xl font-mono text-center uppercase focus:border-amber-500 outline-none bg-white dark:bg-slate-900 text-lg font-black text-slate-800 dark:text-white placeholder-slate-300 shadow-inner" /></div>)}
                </div>
              ) : (
                <div className="mb-5 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 animate-fade-in shadow-inner">
                  <div className="space-y-2.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {splitPayments.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select
                          value={p.id_metodo}
                          onChange={(e) => updateSplit(idx, 'id_metodo', e.target.value)}
                          className="flex-1 text-xs font-bold p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 outline-none bg-white dark:bg-slate-900 dark:text-white shadow-sm cursor-pointer"
                        >
                          <option value="">Método...</option>
                          {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                        </select>
                        <div className="relative w-28">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-black">$</span>
                          <input
                            type="number"
                            value={p.monto}
                            onChange={(e) => updateSplit(idx, 'monto', e.target.value)}
                            className="w-full pl-7 pr-2 py-2.5 text-sm font-black rounded-lg border border-indigo-200 dark:border-indigo-800 outline-none bg-white dark:bg-slate-900 dark:text-white shadow-sm text-right"
                            placeholder="0"
                          />
                        </div>
                        {splitPayments.length > 1 && (
                          <button onClick={() => removeSplitLine(idx)} className="text-red-400 hover:text-white hover:bg-red-500 p-2 rounded-lg transition-colors"><X size={16} /></button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800/50">
                    <button onClick={addSplitLine} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center hover:bg-indigo-100 dark:bg-indigo-900/50 px-2 py-1 rounded transition-colors">
                      <Plus size={14} className="mr-1" /> Otro
                    </button>
                    <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${restanteMixto === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/50 dark:text-red-400'}`}>
                      {restanteMixto === 0 ? 'COMPLETO' : `Faltan $${restanteMixto.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-end mb-5 border-b border-dashed border-slate-200 dark:border-slate-700 pb-4">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest block mb-1">Total a Cobrar</span>
                  {descuentoVisual !== 0 && <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block ${descuentoVisual > 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>{descuentoVisual > 0 ? 'Ahorro' : 'Recargo'}: ${Math.abs(descuentoVisual).toLocaleString()}</div>}
                </div>
                <div onClick={() => setIsEditingPrice(true)} className="cursor-pointer group flex items-center relative" title="Editar precio final">
                  {isEditingPrice ? (
                    <input autoFocus type="number" className={`text-4xl font-black text-right w-40 border-b-2 outline-none bg-transparent dark:text-white ${isMerch ? 'border-fuchsia-500 text-fuchsia-600' : 'border-indigo-500 text-indigo-600'}`} value={customTotal === null ? subtotalCalculado : customTotal} onChange={e => setCustomTotal(e.target.value)} onBlur={() => setIsEditingPrice(false)} onKeyDown={e => { if (e.key === 'Enter') setIsEditingPrice(false) }} />
                  ) : (
                    <>
                      <span className={`text-4xl font-black tracking-tighter transition-colors font-mono ${descuentoVisual !== 0 ? (isMerch ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'text-indigo-600 dark:text-indigo-400') : 'text-slate-800 dark:text-white'}`}>$ {totalFinal.toLocaleString()}</span>
                      <div className={`ml-3 p-2 rounded-xl text-slate-400 transition-colors shadow-sm border ${isMerch ? 'bg-purple-50 dark:bg-slate-800 border-purple-100 dark:border-slate-700 group-hover:bg-purple-100 group-hover:text-purple-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}><Edit3 size={16} /></div>
                    </>
                  )}
                </div>
              </div>

              {/* AQUÍ ESTÁ LA CONDICIÓN: SI ES MERCH, EL BOTÓN COBRAR OCUPA EL 100% */}
              <div className={`grid ${isMerch ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                {!isMerch && (
                    <button onClick={() => setIsReservationModalOpen(true)} disabled={cart.length === 0} className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-600 shadow-sm"><CalendarClock className="mr-2" size={18} /> Reservar</button>
                )}
                <button
                  onClick={handleCheckoutClick}
                  disabled={cart.length === 0 || (!isSplitPayment && !selectedMethod)}
                  className={`text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center shadow-lg transition-all active:scale-95 ${cart.length > 0 && (selectedMethod || isSplitPayment) ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'}`}
                >
                  <Banknote className="mr-2" size={18} /> COBRAR
                </button>
              </div>
            </div>
          </div>
      </div>
      )}

      {/* --- MODAL ITEM LIBRE --- */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className={`bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-colors border-2 ${isMerch ? 'border-purple-300 dark:border-purple-700' : 'border-indigo-200 dark:border-indigo-800/50'}`}>
            <div className={`p-6 flex justify-between items-center ${isMerch ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
              <h3 className={`text-xl font-black flex items-center tracking-tight ${isMerch ? 'text-purple-800 dark:text-purple-300' : 'text-indigo-800 dark:text-indigo-300'}`}>
                  {isMerch ? <Tag className="mr-3 text-purple-500" size={24} /> : <Edit3 className="mr-3 text-indigo-500" size={24} />} 
                  {isMerch ? 'Artículo Merchandising' : 'Anotador Libre'}
              </h3>
              <button onClick={() => setIsCustomModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm"><X size={20} /></button>
            </div>
            <form onSubmit={addCustomItem} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre / Descripción</label>
                <input autoFocus required value={customItemData.description} onChange={e => setCustomItemData({ ...customItemData, description: e.target.value })} className={`w-full p-4 border-2 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-bold text-slate-800 dark:text-white placeholder-slate-300 transition-all ${isMerch ? 'focus:border-purple-500' : 'focus:border-indigo-500'}`} placeholder="Ej: Llavero escudo..." />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Precio de Venta</label>
                <div className="relative">
                  <span className={`absolute left-4 top-4 font-black text-xl ${isMerch ? 'text-purple-400' : 'text-indigo-400'}`}>$</span>
                  <input type="number" required min="0" step="0.01" value={customItemData.price} onChange={e => setCustomItemData({ ...customItemData, price: e.target.value })} className={`w-full pl-10 p-4 border-2 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black text-2xl text-slate-800 dark:text-white placeholder-slate-300 transition-all ${isMerch ? 'focus:border-purple-500' : 'focus:border-indigo-500'}`} placeholder="0.00" />
                </div>
              </div>
              <div className="flex gap-4 mt-8 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button type="button" onClick={() => setIsCustomModalOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 rounded-2xl transition-colors">Cancelar</button>
                <button type="submit" className={`flex-1 py-4 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95 ${isMerch ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 shadow-purple-500/30' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 shadow-indigo-500/30'}`}>AGREGAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {zoomImage && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in cursor-zoom-out" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-zoom-in" onClick={e => e.stopPropagation()} />
          <button className="absolute top-6 right-6 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors">
            <X size={28} />
          </button>
        </div>
      )}

    </div>
  );
};

export default POSPage;