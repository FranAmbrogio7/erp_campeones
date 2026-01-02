import { X, Printer } from 'lucide-react';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  if (!isOpen || !productData) return null;

  // URL directa a tu backend que genera la imagen
  const barcodeUrl = `/api/products/barcode/${productData.sku}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800">Etiqueta de Producto</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">
          <p className="text-sm text-gray-500 mb-2">{productData.nombre}</p>
          <p className="font-bold text-xl mb-4">{productData.talle}</p>

          {/* Aquí cargamos la imagen directa desde Python */}
          <div className="border-2 border-dashed border-gray-300 p-4 rounded bg-gray-50">
            <img
              src={barcodeUrl}
              alt="Barcode"
              className="max-h-24 object-contain"
              onError={(e) => {
                e.target.src = "https://via.placeholder.com/300x100?text=Error+SKU";
                e.target.alt = "Error generando código";
              }}
            />
          </div>

          <p className="mt-2 text-xs font-mono text-gray-400">{productData.sku}</p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.print()} // Por ahora impresión simple del navegador
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