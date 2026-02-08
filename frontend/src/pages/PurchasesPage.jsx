import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth, api } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';
import PurchaseOrderTicket from '../components/PurchaseOrderTicket';
import { ShoppingBag, Plus, Save, Truck, Search, Trash2, Layers, RotateCcw, Eye, Printer, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PurchasesPage = () => {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState('new');

    const [providers, setProviders] = useState([]);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [searchProduct, setSearchProduct] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [cart, setCart] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [history, setHistory] = useState([]);
    const [viewingPurchase, setViewingPurchase] = useState(null);

    const [printData, setPrintData] = useState(null);
    const printRef = useRef();

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: 'Orden_Compra',
        onAfterPrint: () => { setPrintData(null); toast.success("Impresión enviada"); }
    });

    const preparePrint = (purchaseData) => {
        setPrintData(purchaseData);
        setTimeout(() => { handlePrint(); }, 100);
    };

    useEffect(() => {
        fetchProviders();
        if (activeTab === 'history') fetchHistory();
    }, [token, activeTab]);

    const fetchProviders = async () => {
        try {
            const res = await api.get('/purchases/providers', { headers: { Authorization: `Bearer ${token}` } });
            setProviders(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/purchases/history', { headers: { Authorization: `Bearer ${token}` } });
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    const handleRefresh = () => {
        setSearchProduct(''); setSearchResults([]); setCart([]); setSelectedProvider(''); toast.success("Formulario reiniciado");
    };

    useEffect(() => {
        const delaySearch = setTimeout(async () => {
            if (!searchProduct) { setSearchResults([]); return; }
            setIsSearching(true);
            try {
                const res = await api.get(`/products?search=${searchProduct}&limit=5`, { headers: { Authorization: `Bearer ${token}` } });
                setSearchResults(res.data.products);
            } catch (e) { console.error(e); }
            finally { setIsSearching(false); }
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [searchProduct, token]);

    const addItemSingle = (product, variant) => {
        if (cart.find(i => i.id_variante === variant.id_variante)) { toast.error(`El talle ${variant.talle} ya está en la lista`); return; }
        setCart(prev => [...prev, { id_variante: variant.id_variante, nombre: product.nombre, talle: variant.talle, sku: variant.sku, cantidad: 1, costo: 0 }]);
    };

    const addFullCurve = (product) => {
        const newItems = [];
        let addedCount = 0;
        product.variantes.forEach(variant => {
            if (!cart.find(i => i.id_variante === variant.id_variante)) {
                newItems.push({ id_variante: variant.id_variante, nombre: product.nombre, talle: variant.talle, sku: variant.sku, cantidad: 1, costo: 0 });
                addedCount++;
            }
        });
        if (addedCount > 0) { setCart(prev => [...prev, ...newItems]); toast.success(`Agregados ${addedCount} talles`); setSearchProduct(''); setSearchResults([]); }
        else { toast('Ya están en la lista', { icon: 'ℹ️' }); }
    };

    const updateItem = (index, field, value) => {
        const newCart = [...cart]; newCart[index][field] = parseFloat(value) || 0; setCart(newCart);
    };

    const removeItem = (index) => setCart(prev => prev.filter((_, i) => i !== index));

    const handleSavePurchase = async () => {
        if (cart.length === 0) return;
        if (!selectedProvider) { toast.error("Selecciona un proveedor"); return; }
        const totalCompra = cart.reduce((sum, item) => sum + (item.cantidad * item.costo), 0);
        try {
            await api.post('/purchases', { id_proveedor: selectedProvider, total: totalCompra, items: cart }, { headers: { Authorization: `Bearer ${token}` } });
            toast.success("Compra registrada. Stock actualizado."); handleRefresh();
        } catch (e) { toast.error("Error al registrar compra"); }
    };

    const totalGeneral = cart.reduce((sum, item) => sum + (item.cantidad * item.costo), 0);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gray-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
            <Toaster position="top-center" />
            <div style={{ display: "none" }}><PurchaseOrderTicket ref={printRef} data={printData} /></div>

            {/* --- MODAL DETALLE DE COMPRA --- */}
            {viewingPurchase && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                        <div className="bg-slate-50 dark:bg-slate-900 p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl text-gray-800 dark:text-white">Orden de Compra #{viewingPurchase.id}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{viewingPurchase.fecha} • {viewingPurchase.proveedor}</p>
                            </div>
                            <button onClick={() => setViewingPurchase(null)} className="text-gray-400 hover:text-red-500 bg-white dark:bg-slate-700 rounded-full p-1 shadow-sm"><X size={24} /></button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300 uppercase text-xs sticky top-0">
                                    <tr><th className="p-4">Producto</th><th className="p-4">SKU</th><th className="p-4 text-center">Cant.</th><th className="p-4 text-right">Costo Unit.</th><th className="p-4 text-right">Subtotal</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {viewingPurchase.items_detail?.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/20">
                                            <td className="p-4 font-bold text-gray-800 dark:text-white">{item.nombre} <span className="ml-2 text-xs bg-gray-100 dark:bg-slate-600 px-2 py-0.5 rounded border dark:border-slate-500 font-normal">T: {item.talle}</span></td>
                                            <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">{item.sku}</td>
                                            <td className="p-4 text-center font-bold dark:text-gray-300">{item.cantidad}</td>
                                            <td className="p-4 text-right text-gray-500 dark:text-gray-400">$ {item.costo.toLocaleString()}</td>
                                            <td className="p-4 text-right font-black text-gray-800 dark:text-white">$ {item.subtotal.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-5 bg-slate-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                            <button onClick={() => preparePrint(viewingPurchase)} className="flex items-center text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                                <Printer size={18} className="mr-2" /> Imprimir Comprobante
                            </button>
                            <div className="text-right">
                                <span className="text-gray-500 dark:text-gray-400 text-sm mr-4 uppercase font-bold">Total Compra</span>
                                <span className="text-2xl font-black text-gray-900 dark:text-white">$ {viewingPurchase.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center"><Truck className="mr-2 text-blue-600 dark:text-blue-400" /> Gestión de Compras</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Registra gastos y reposición de mercadería.</p>
                </div>
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('new')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'new' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}>Nueva Compra</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}>Historial</button>
                </div>
            </div>

            {/* --- PESTAÑA: NUEVA COMPRA --- */}
            {activeTab === 'new' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Proveedor</label>
                            <select className="w-full border dark:border-slate-600 p-2 rounded bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-white outline-none" value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)}>
                                <option value="">Seleccionar Proveedor...</option>
                                {providers.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 relative transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">BUSCAR PRODUCTO</label>
                                <button onClick={handleRefresh} className="text-xs flex items-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"><RotateCcw size={14} className="mr-1" /> Limpiar Todo</button>
                            </div>
                            <div className="relative">
                                <input placeholder="Escribe nombre..." className="w-full pl-10 p-3 border dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-900 text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-slate-500" value={searchProduct} onChange={e => setSearchProduct(e.target.value)} />
                                <Search className="absolute left-3 top-3 text-gray-400 dark:text-slate-500" size={18} />
                            </div>
                            {searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 shadow-xl border border-gray-200 dark:border-slate-700 rounded-b-lg z-50 max-h-80 overflow-y-auto">
                                    {searchResults.map(prod => (
                                        <div key={prod.id} className="p-3 hover:bg-blue-50 dark:hover:bg-slate-700 border-b dark:border-slate-700 last:border-0 group transition-colors">
                                            <div className="flex justify-between items-center mb-2">
                                                <p className="font-bold text-sm text-gray-800 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center" onClick={() => addFullCurve(prod)}>
                                                    <Layers size={14} className="mr-2 text-blue-400" /> {prod.nombre} <span className="ml-2 text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1 rounded font-normal">Agregar Curva</span>
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {prod.variantes.map(v => (
                                                    <button key={v.id_variante} onClick={() => addItemSingle(prod, v)} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded border dark:border-slate-600 transition-colors">{v.talle}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tabla Items */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                    <tr><th className="p-3">Producto</th><th className="p-3 w-24">Cant.</th><th className="p-3 w-32">Costo Unit.</th><th className="p-3 w-24 text-right">Subtotal</th><th className="p-3 w-10"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {cart.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-600">Carrito vacío.</td></tr> :
                                        cart.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="p-3"><p className="font-bold text-gray-700 dark:text-gray-200 text-xs md:text-sm">{item.nombre}</p><p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1 bg-gray-100 dark:bg-slate-700 inline-block px-1 rounded">T: {item.talle}</p></td>
                                                <td className="p-3"><input type="number" min="1" className="w-full p-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded text-center focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} /></td>
                                                <td className="p-3"><div className="relative"><span className="absolute left-2 top-1 text-gray-400">$</span><input type="number" min="0" className="w-full pl-5 p-1 border dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-800 dark:text-white rounded focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 outline-none" value={item.costo} onChange={e => updateItem(idx, 'costo', e.target.value)} /></div></td>
                                                <td className="p-3 text-right font-bold text-gray-700 dark:text-white">$ {(item.cantidad * item.costo).toLocaleString()}</td>
                                                <td className="p-3 text-center"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"><Trash2 size={16} /></button></td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Resumen */}
                    <div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-blue-100 dark:border-slate-700 sticky top-4 transition-colors">
                            <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center"><ShoppingBag className="mr-2 text-blue-600 dark:text-blue-400" /> Resumen</h3>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Ítems</span><span className="font-bold">{cart.length}</span></div>
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300"><span className="text-gray-500 dark:text-gray-400">Unidades</span><span className="font-bold">{cart.reduce((a, b) => a + parseInt(b.cantidad || 0), 0)}</span></div>
                                <div className="border-t border-gray-200 dark:border-slate-700 pt-3 flex justify-between items-end"><span className="text-gray-600 dark:text-gray-400 font-bold">Total</span><span className="text-2xl font-black text-gray-900 dark:text-white">$ {totalGeneral.toLocaleString()}</span></div>
                            </div>
                            <button onClick={handleSavePurchase} disabled={cart.length === 0} className="w-full py-3 bg-blue-600 dark:bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 dark:hover:bg-blue-500 shadow-lg transition-all flex justify-center items-center disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed">
                                <Save size={18} className="mr-2" /> Confirmar Compra
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PESTAÑA: HISTORIAL --- */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden transition-colors">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-slate-400 uppercase text-xs">
                            <tr><th className="p-4">ID</th><th className="p-4">Fecha</th><th className="p-4">Proveedor</th><th className="p-4">Items</th><th className="p-4 text-right">Total</th><th className="p-4 text-right">Acciones</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {history.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 dark:text-gray-600">Sin registros.</td></tr> :
                                history.map(h => (
                                    <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="p-4 font-bold text-gray-900 dark:text-white">#{h.id}</td>
                                        <td className="p-4 text-gray-500 dark:text-gray-400">{h.fecha}</td>
                                        <td className="p-4 font-medium text-blue-600 dark:text-blue-400">{h.proveedor}</td>
                                        <td className="p-4 text-gray-500 dark:text-gray-400 text-xs">{h.items_count}</td>
                                        <td className="p-4 text-right font-black text-gray-800 dark:text-white">$ {h.total.toLocaleString()}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => preparePrint(h)} className="text-gray-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-green-400 p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-all" title="Imprimir"><Printer size={18} /></button>
                                                <button onClick={() => setViewingPurchase(h)} className="text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all" title="Ver Detalle"><Eye size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PurchasesPage;