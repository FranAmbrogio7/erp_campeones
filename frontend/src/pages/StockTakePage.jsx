import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ScanBarcode, Save, Trash2, RotateCcw, PackageCheck, PlusCircle, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { api } from '../context/AuthContext';

const StockTakePage = () => {
    const { token } = useAuth();
    const [skuInput, setSkuInput] = useState('');

    // Inicializamos el estado leyendo del LocalStorage si existe
    const [scannedItems, setScannedItems] = useState(() => {
        const saved = localStorage.getItem('stockTakeSession');
        return saved ? JSON.parse(saved) : [];
    });

    // MODO DE GUARDADO: 
    // 'replace' = El conteo es el stock TOTAL (Arqueo).
    // 'add' = El conteo se SUMA al stock actual (Reposición).
    const [updateMode, setUpdateMode] = useState('replace');

    const inputRef = useRef(null);

    // 1. Persistencia: Cada vez que cambia la lista, guardamos en LocalStorage
    useEffect(() => {
        localStorage.setItem('stockTakeSession', JSON.stringify(scannedItems));
    }, [scannedItems]);

    // 2. Auto-Focus
    useEffect(() => {
        const focusInterval = setInterval(() => {
            if (document.activeElement !== inputRef.current) {
                inputRef.current?.focus();
            }
        }, 2000);
        return () => clearInterval(focusInterval);
    }, []);

    // 3. Manejar Escaneo
    const handleScan = (e) => {
        e.preventDefault();
        if (!skuInput.trim()) return;

        const sku = skuInput.trim().toUpperCase(); // Normalizamos a mayúsculas
        const existingIndex = scannedItems.findIndex(i => i.sku === sku);

        if (existingIndex >= 0) {
            // LÓGICA DE SUMATORIA: Si ya existe en la lista, sumamos +1
            const newList = [...scannedItems];
            newList[existingIndex].cantidad += 1;
            setScannedItems(newList);
            toast.success(`+1 ${newList[existingIndex].nombre}`, { position: 'bottom-right', duration: 1000, icon: '👕' });
        } else {
            // Si es nuevo en la sesión, lo buscamos en el backend
            checkAndAddItem(sku);
        }
        setSkuInput('');
    };

    const checkAndAddItem = async (sku) => {
        const toastId = toast.loading("Buscando...");
        try {
            // Usamos el endpoint de scan directo que es más preciso
            const resScan = await api.get(`/sales/scan/${sku}`);

            if (resScan.data.found) {
                const prod = resScan.data.product;

                // Verificar si ya estaba en la lista (por si el async tardó y el usuario escaneó de nuevo)
                setScannedItems(prev => {
                    const exists = prev.findIndex(i => i.sku === prod.sku);
                    if (exists >= 0) {
                        const newList = [...prev];
                        newList[exists].cantidad += 1;
                        return newList;
                    }
                    // Agregamos nuevo ítem iniciando en 1
                    return [{
                        sku: prod.sku,
                        nombre: prod.nombre,
                        talle: prod.talle,
                        cantidad: 1,
                        stock_sistema: prod.stock_actual // Solo informativo visual
                    }, ...prev];
                });

                toast.success("Producto agregado", { id: toastId });
            } else {
                toast.error("Producto no encontrado", { id: toastId });
            }
        } catch (error) {
            toast.error("Error al buscar SKU", { id: toastId });
        }
    };

    const updateQuantity = (sku, newQty) => {
        setScannedItems(prev => prev.map(item => item.sku === sku ? { ...item, cantidad: parseInt(newQty) || 0 } : item));
    };

    // 4. Limpiar Sesión
    const handleReset = () => {
        if (!window.confirm("¿Borrar toda la lista actual? Perderás el conteo no guardado.")) return;
        setScannedItems([]);
        localStorage.removeItem('stockTakeSession');
        toast("Lista reiniciada");
    };

    // 5. GUARDADO INTELIGENTE
    const handleSaveStock = async () => {
        if (scannedItems.length === 0) return;

        const modeText = updateMode === 'replace' ? 'REEMPLAZAR (Arqueo Total)' : 'SUMAR (Ajuste)';
        if (!window.confirm(`¿Confirmar actualización de stock?\n\nModo: ${modeText}\nItems a procesar: ${scannedItems.length}`)) return;

        const loadingToast = toast.loading("Actualizando inventario...");

        try {
            // Preparamos los datos según el modo
            const itemsToUpdate = scannedItems.map(item => {
                let finalStock;

                if (updateMode === 'add') {
                    // MODO SUMAR: Stock Actual del Sistema + Lo que conté ahora
                    // Nota: Usamos el stock_sistema que trajimos al escanear. 
                    // Idealmente el backend debería hacer la suma atómica, pero esto funciona para lógica frontend.
                    finalStock = (parseInt(item.stock_sistema) || 0) + parseInt(item.cantidad);
                } else {
                    // MODO REEMPLAZAR: Lo que conté es la verdad absoluta
                    finalStock = parseInt(item.cantidad);
                }

                return {
                    sku: item.sku,
                    cantidad: finalStock,
                    // Enviamos metadatos extra por si el backend los quiere loguear
                    _modo: updateMode,
                    _conteo_parcial: item.cantidad
                };
            });

            await api.post('/products/stock/bulk-update', { items: itemsToUpdate });

            toast.success("¡Inventario Actualizado con éxito!", { id: loadingToast });
            setScannedItems([]);
            localStorage.removeItem('stockTakeSession');

        } catch (error) {
            console.error(error);
            toast.error("Error al guardar en base de datos", { id: loadingToast });
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            <Toaster />

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <PackageCheck className="mr-3 text-blue-600" size={28} /> Toma de Inventario
                    </h1>
                    <p className="text-gray-500 text-sm">Escanea productos para contar. Los datos se guardan en este navegador hasta que confirmes.</p>
                </div>
                <button onClick={handleReset} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors border border-transparent hover:border-red-100">
                    <RotateCcw size={16} className="mr-2" /> Reiniciar Sesión
                </button>
            </div>

            {/* INPUT ESCANEO */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                <form onSubmit={handleScan} className="flex gap-4 items-center">
                    <div className="relative flex-1">
                        <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            ref={inputRef}
                            value={skuInput}
                            onChange={e => setSkuInput(e.target.value)}
                            placeholder="Escanea el código de barras aquí..."
                            className="w-full pl-12 pr-4 py-4 text-2xl border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 uppercase font-mono transition-all"
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="hidden md:block bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 shadow-md hover:shadow-xl transition-all">
                        ENTER
                    </button>
                </form>
            </div>

            {/* ZONA DE CONFIGURACIÓN Y GUARDADO */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">

                {/* Panel Izquierdo: Lista */}
                <div className="flex-1 flex flex-col">
                    <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <span className="font-bold text-gray-700 flex items-center">
                            <RotateCcw size={16} className="mr-2 text-gray-400" /> Ítems en memoria: {scannedItems.length}
                        </span>
                        <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                            Total Unidades: {scannedItems.reduce((acc, i) => acc + i.cantidad, 0)}
                        </span>
                    </div>

                    <div className="flex-1 max-h-[500px] overflow-y-auto bg-white min-h-[300px]">
                        <table className="w-full text-left">
                            <thead className="bg-white text-xs uppercase text-gray-500 sticky top-0 border-b shadow-sm z-10">
                                <tr>
                                    <th className="p-3 pl-4">Producto</th>
                                    <th className="p-3 font-mono">SKU</th>
                                    <th className="p-3 text-center">Actual (Sistema)</th>
                                    <th className="p-3 text-center w-32 bg-blue-50 text-blue-700">Conteo Nuevo</th>
                                    <th className="p-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {scannedItems.map((item) => (
                                    <tr key={item.sku} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="p-3 pl-4">
                                            <p className="font-bold text-gray-800 text-sm">{item.nombre}</p>
                                            <p className="text-xs text-gray-500">Talle: {item.talle}</p>
                                        </td>
                                        <td className="p-3 font-mono text-xs text-gray-500">{item.sku}</td>
                                        <td className="p-3 text-center text-gray-400 font-mono">{item.stock_sistema}</td>

                                        {/* Input Cantidad Resaltado */}
                                        <td className="p-2 text-center bg-blue-50/30">
                                            <input
                                                type="number"
                                                value={item.cantidad}
                                                onChange={(e) => updateQuantity(item.sku, e.target.value)}
                                                className="w-20 p-2 border border-blue-200 rounded-lg text-center font-black text-xl text-blue-700 focus:border-blue-500 outline-none shadow-sm"
                                            />
                                        </td>

                                        <td className="p-3 text-right pr-4">
                                            <button onClick={() => setScannedItems(prev => prev.filter(i => i.sku !== item.sku))} className="text-gray-300 hover:text-red-500 transition-colors p-2">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {scannedItems.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                            <ScanBarcode size={48} className="mb-4 opacity-20" />
                                            <p>Lista vacía. Comienza a escanear.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Panel Derecho: Acciones Finales */}
                <div className="w-full md:w-80 bg-slate-50 border-l border-gray-200 p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                            <Save size={18} className="mr-2" /> Finalizar
                        </h3>

                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 font-medium uppercase mb-2">Modo de Actualización</p>

                            {/* Selector de Modo */}
                            <div className="flex flex-col gap-2">
                                <label className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'replace' ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-gray-200 hover:bg-white'}`}>
                                    <input type="radio" name="mode" value="replace" checked={updateMode === 'replace'} onChange={() => setUpdateMode('replace')} className="mt-1 mr-3" />
                                    <div>
                                        <span className="block font-bold text-sm text-gray-800">Reemplazar (Arqueo)</span>
                                        <span className="text-[10px] text-gray-500 leading-tight block mt-1">El conteo es el TOTAL. Borra el stock anterior. (Ej: Inventario anual)</span>
                                    </div>
                                </label>

                                <label className={`flex items-start p-3 rounded-xl border cursor-pointer transition-all ${updateMode === 'add' ? 'bg-white border-green-500 shadow-md ring-1 ring-green-500' : 'border-gray-200 hover:bg-white'}`}>
                                    <input type="radio" name="mode" value="add" checked={updateMode === 'add'} onChange={() => setUpdateMode('add')} className="mt-1 mr-3" />
                                    <div>
                                        <span className="block font-bold text-sm text-gray-800">Sumar (Ajuste)</span>
                                        <span className="text-[10px] text-gray-500 leading-tight block mt-1">SUMAR al stock actual. (Ej: Encontré cajas perdidas)</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        {updateMode === 'replace' && (
                            <div className="flex items-start mb-4 bg-orange-50 p-3 rounded-lg border border-orange-100 text-orange-700 text-xs">
                                <AlertTriangle size={14} className="mr-2 mt-0.5 shrink-0" />
                                <p>Cuidado: Si el sistema dice 10 y escaneas 2, el stock pasará a ser 2.</p>
                            </div>
                        )}

                        <button
                            onClick={handleSaveStock}
                            disabled={scannedItems.length === 0}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex justify-center items-center transition-all ${scannedItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' :
                                    updateMode === 'add' ? 'bg-green-600 hover:bg-green-700 hover:shadow-green-500/30' :
                                        'bg-slate-900 hover:bg-black hover:shadow-slate-500/30'
                                }`}
                        >
                            {updateMode === 'add' ? <PlusCircle className="mr-2" /> : <Save className="mr-2" />}
                            {updateMode === 'add' ? 'SUMAR AL STOCK' : 'GUARDAR ARQUEO'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StockTakePage;