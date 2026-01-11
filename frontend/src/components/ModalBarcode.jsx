import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { useReactToPrint } from 'react-to-print';
import { X, Printer, Package } from 'lucide-react';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  const componentRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: productData ? `Etiqueta-${productData.sku}` : 'Etiqueta',
  });

  if (!isOpen || !productData) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">

        {/* Encabezado del Modal */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Package className="text-blue-600" size={20} />
            Imprimir Etiqueta
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Área de Previsualización */}
        <div className="p-8 bg-gray-100 flex justify-center items-center min-h-[300px]">

          {/* --- ESTA ES LA ETIQUETA QUE SE IMPRIME --- */}
          <div
            ref={componentRef}
            className="bg-white p-4 border border-gray-300 shadow-sm w-[300px] h-[180px] flex flex-col items-center justify-center text-center"
            // Estilo específico para impresión para asegurar fondo blanco y tamaños
            style={{
              printColorAdjust: 'exact',
              WebkitPrintColorAdjust: 'exact'
            }}
          >
            {/* 1. Nombre del Producto (Truncado si es muy largo) */}
            <h2 className="text-sm font-bold text-gray-900 leading-tight mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap uppercase px-2">
              {productData.nombre}
            </h2>

            {/* 2. Talle y Categoría (Sin Precio) */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xs text-gray-500 uppercase">Talle:</span>
              <span className="text-2xl font-black text-gray-800">{productData.talle}</span>
            </div>

            {/* 3. Código de Barras */}
            <div className="w-full flex justify-center overflow-hidden">
              <Barcode
                value={productData.sku}
                width={1.8}      // Barras un poco más anchas
                height={40}      // Altura justa
                fontSize={12}    // Texto del código legible
                margin={0}
                displayValue={true}
                background="#ffffff"
                lineColor="#000000"
              />
            </div>

            {/* 4. Pie de página (Opcional: Nombre del negocio pequeño) */}
            <p className="text-[8px] text-gray-400 mt-1 tracking-widest uppercase">
              CAMPEONES
            </p>
          </div>
          {/* ------------------------------------------ */}

        </div>

        {/* Pie del Modal con Botones */}
        <div className="p-5 border-t bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-black shadow-lg hover:shadow-xl transition-all flex items-center gap-2 active:scale-95"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalBarcode;