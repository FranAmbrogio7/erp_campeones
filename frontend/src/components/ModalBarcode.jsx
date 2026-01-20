import { X, Printer } from 'lucide-react';
import { api } from '../context/AuthContext';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  if (!isOpen || !productData) return null;

  const barcodeUrl = `${api.defaults.baseURL}/products/barcode/${productData.sku}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      {/* CSS para Impresión - Ajustado para evitar márgenes fantasmas */}
      <style>
        {`
          @media print {
            @page { size: 50mm 25mm; margin: 0; }
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { 
              position: fixed; left: 0; top: 0; 
              width: 50mm; height: 25mm;
              display: flex; flex-direction: column;
              background: white; overflow: hidden;
              justify-content: space-between;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Vista Previa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>

        {/* Body Visual */}
        <div className="p-8 flex flex-col items-center justify-center bg-gray-100">

          {/* --- ETIQUETA --- */}
          <div className="printable-area bg-white border border-gray-400 flex flex-col items-center overflow-hidden relative"
            style={{ width: '50mm', height: '25mm', padding: '1mm 2mm' }}
          >

            {/* 1. Nombre (Arriba - Truncado para que no empuje todo) */}
            <p className="text-[9px] font-bold text-center leading-tight w-full truncate text-black mb-0.5">
              {productData.nombre}
            </p>

            {/* 2. CÓDIGO DE BARRAS (Corrección Clave) */}
            <div className="flex-1 w-full flex items-center justify-center overflow-hidden h-full py-0.5">
              <img
                src={barcodeUrl}
                alt="Barcode"
                // CAMBIO CLAVE: object-contain evita la distorsión
                className="w-full h-full object-contain grayscale"
                style={{ imageRendering: 'pixelated' }} // Ayuda a la nitidez en impresoras térmicas
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>

            {/* 3. SKU GRANDE (Solo Texto, para lectura humana) */}
            <p className="text-[11px] font-black text-center leading-none text-black tracking-tight mb-0.5">
              {productData.sku}
            </p>

            {/* 4. Pie: Talle */}
            <div className="w-full flex justify-between items-end border-t border-black/10 pt-0.5">
              <span className="text-[10px] font-bold text-black leading-none">T: {productData.talle}</span>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded hover:bg-black font-bold shadow-lg"
            onClick={() => window.print()}
          >
            <Printer size={18} className="mr-2" /> Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalBarcode;