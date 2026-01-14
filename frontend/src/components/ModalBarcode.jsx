import { X, Printer } from 'lucide-react';

const ModalBarcode = ({ isOpen, onClose, productData }) => {
  if (!isOpen || !productData) return null;

  // URL del backend (asumimos que devuelve la imagen del código de barras)
  const barcodeUrl = `/api/products/barcode/${productData.sku}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">

      {/* --- CSS PARA IMPRESIÓN (Configuración Exacta 50x25mm) --- */}
      <style>
        {`
          @media print {
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
            body * { visibility: hidden; }
            .printable-area, .printable-area * { visibility: visible; }
            .printable-area { 
              position: fixed;
              left: 0;
              top: 0;
              width: 50mm;
              height: 25mm;
              background: white;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between; /* Distribuye espacio equitativamente */
              padding: 1mm 2mm; /* Pequeño margen interno de seguridad */
              overflow: hidden;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100">

        {/* Header del Modal */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h3 className="font-bold text-gray-800">Vista Previa (50x25mm)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo Visual (Previsualización en Pantalla) */}
        <div className="p-8 flex flex-col items-center justify-center bg-gray-100/50">

          {/* ======================================================== */}
          {/* ÁREA IMPRIMIBLE (Réplica exacta de tu diseño)         */}
          {/* ======================================================== */}
          <div className="printable-area bg-white border border-gray-300 shadow-sm"
            style={{
              width: '50mm',
              height: '25mm',
              padding: '1mm 2mm',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>

            {/* 1. NOMBRE DEL PRODUCTO (Arriba, centrado, truncado) */}
            <p className="text-[9px] font-medium text-center leading-none w-full truncate text-black mb-0.5">
              {productData.nombre}
            </p>

            {/* 2. CÓDIGO DE BARRAS (Imagen) */}
            {/* Contenedor flexible para la imagen */}
            <div className="w-full flex justify-center items-center overflow-hidden h-[10mm]">
              <img
                src={barcodeUrl}
                alt="Barcode"
                className="h-full w-auto object-contain grayscale"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>

            {/* 3. SKU GRANDE (Justo debajo de las barras) */}
            {/* font-black para que sea bien grueso como en la foto */}
            <p className="text-[13px] font-black text-center leading-none text-black mt-0.5 tracking-tight">
              {productData.sku}
            </p>

            {/* 4. PIE DE PÁGINA (Talle izq, SKU der) */}
            <div className="w-full flex justify-between items-end mt-0.5">
              {/* Talle en Negrita */}
              <span className="text-[10px] font-bold text-black leading-none">
                T: {productData.talle}
              </span>

              {/* SKU pequeño repetido a la derecha */}
              <span className="text-[7px] text-gray-800 leading-none font-mono">
                {productData.sku}
              </span>
            </div>

          </div>
          {/* ======================================================== */}

        </div>

        {/* Footer con Botón Imprimir */}
        <div className="p-4 bg-gray-50 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            className="flex-1 flex items-center justify-center py-2 bg-slate-900 text-white rounded-lg hover:bg-black font-bold shadow-lg transition-transform active:scale-95 text-sm"
            onClick={() => window.print()}
          >
            <Printer size={16} className="mr-2" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalBarcode;