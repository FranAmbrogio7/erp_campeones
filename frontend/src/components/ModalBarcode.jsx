import { X, Printer } from 'lucide-react';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  if (!isOpen || !productData) return null;

  const barcodeUrl = `/api/products/barcode/${productData.sku}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

      {/* CSS para Impresión */}
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { 
              position: absolute; 
              left: 0; 
              top: 0; 
              width: 50mm; 
              height: 25mm;
              display: flex;
              flex-direction: column;
              background: white;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Vista Previa</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Body Visual */}
        <div className="p-8 flex flex-col items-center justify-center bg-gray-100">

          {/* --- ETIQUETA IMPRIMIBLE (50mm x 25mm) --- */}
          <div className="printable-area bg-white border border-gray-400 flex flex-col items-center overflow-hidden"
            style={{ width: '50mm', height: '25mm', padding: '1mm' }}>

            {/* 1. TEXTO SUPERIOR (Nombre pequeñito) */}
            <p className="text-[8px] leading-none text-center truncate w-full mb-0.5 text-black">
              {productData.nombre}
            </p>

            {/* 2. CÓDIGO DE BARRAS (Protagonista principal) */}
            {/* flex-1 hace que ocupe todo el espacio vertical disponible */}
            <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
              <img
                src={barcodeUrl}
                alt="Barcode"
                className="w-full h-full object-fill grayscale" // object-fill estira la imagen para llenar el hueco
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>

            {/* 3. TEXTO INFERIOR (Talle y SKU en una línea) */}
            <div className="flex justify-between w-full mt-0.5 px-1">
              <span className="text-[9px] font-black text-black">T: {productData.talle}</span>
              <span className="text-[7px] font-mono text-black">{productData.sku}</span>
            </div>

          </div>
          {/* ----------------------------------------- */}

        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            className="flex items-center px-4 py-2 bg-slate-900 text-white rounded hover:bg-black font-bold shadow-lg"
            onClick={() => window.print()}
          >
            <Printer size={18} className="mr-2" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalBarcode;