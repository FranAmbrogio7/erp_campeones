import { X, Printer } from 'lucide-react';
import { api } from '../context/AuthContext';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  if (!isOpen || !productData) return null;

  const barcodeUrl = `${api.defaults.baseURL}/products/barcode/${productData.sku}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      {/* CSS para Impresión */}
      <style>
        {`
          @media print {
            @page { size: 50mm 25mm; margin: 0; }
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { 
              position: fixed; left: 0; top: 0; 
              width: 50mm; height: 25mm;
              background: white; overflow: hidden;
              display: flex; flex-direction: row; /* Lado a Lado */
              align-items: center;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">

        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Vista Previa QR</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={24} /></button>
        </div>

        <div className="p-8 flex flex-col items-center justify-center bg-gray-100">

          {/* --- ETIQUETA QR (50mm x 25mm) --- */}
          <div className="printable-area bg-white border border-gray-400 flex flex-row items-center relative"
            style={{ width: '50mm', height: '25mm', padding: '1mm' }}
          >

            {/* IZQUIERDA: EL QR (Cuadrado 23mm) */}
            <div className="h-[23mm] w-[23mm] shrink-0 flex items-center justify-center">
              <img
                src={barcodeUrl}
                alt="QR"
                className="w-full h-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            {/* DERECHA: INFO (El resto del espacio) */}
            <div className="flex-1 flex flex-col justify-center pl-2 h-full overflow-hidden">

              {/* Nombre */}
              <p className="text-[7px] font-bold text-gray-600 leading-tight mb-1 truncate">
                {productData.nombre}
              </p>

              {/* SKU */}
              <p className="text-[8px] font-mono font-bold text-black leading-tight break-all mb-1">
                {productData.sku}
              </p>

              {/* Talle */}
              <p className="text-[12px] font-black text-black mt-auto">
                T: {productData.talle}
              </p>
            </div>

          </div>

        </div>

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