import React from 'react';

export const Ticket = React.forwardRef(({ saleData }, ref) => {
  const empty = !saleData;
  // Extraemos metodo_pago si viene, sino por defecto vacío
  const { items = [], total = 0, fecha = "", id_venta = "", cliente = "", metodo_pago = "" } = saleData || {};

  return (
    <div
      ref={ref}
      // CAMBIOS CLAVE AQUÍ:
      // 1. font-sans: Se ve mucho más moderno y nítido que font-mono.
      // 2. uppercase: Todo en mayúsculas facilita la lectura rápida.
      // 3. text-black: Asegura negro puro.
      // 4. font-bold: Ayuda a que la impresora térmica "queme" mejor el papel.
      className="p-4 bg-white text-black font-sans text-xs font-bold leading-tight uppercase"
      style={{ width: '80mm', margin: '0 auto' }}
    >
      <style>
        {`
          @media print {
            @page { margin: 0; size: auto; }
            body * { visibility: hidden; }
            .ticket-content, .ticket-content * { visibility: visible; }
            .ticket-content { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}
      </style>

      <div className="ticket-content flex flex-col items-center pb-8">

        {/* --- HEADER --- */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-black tracking-tighter">CAMPEONES</h1>
          <p className="text-[10px] mt-1">Indumentaria & Merch</p>
        </div>

        {/* Separador Sólido (se imprime mejor que el dashed a veces) */}
        <div className="w-full border-b-2 border-black mb-3"></div>

        {!empty && (
          <>
            {/* --- INFO VENTA --- */}
            <div className="w-full mb-3 space-y-1">
              <div className="flex justify-between">
                <span>Fecha:</span>
                <span>{fecha}</span>
              </div>
              <div className="flex justify-between">
                <span>Ticket #:</span>
                <span>{id_venta}</span>
              </div>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="truncate max-w-[150px] text-right">{cliente || 'Consumidor Final'}</span>
              </div>
              {/* Agregamos Método de Pago si existe */}
              {metodo_pago && (
                <div className="flex justify-between">
                  <span>Pago:</span>
                  <span>{metodo_pago}</span>
                </div>
              )}
            </div>

            <div className="w-full border-b border-black border-dashed mb-3"></div>

            {/* --- TABLA PRODUCTOS --- */}
            <table className="w-full text-left mb-3">
              <thead>
                <tr className="border-b border-black">
                  <th className="pb-1 w-[55%]">Descrip</th>
                  <th className="pb-1 w-[15%] text-center">Cant</th>
                  <th className="pb-1 w-[30%] text-right">Total</th>
                </tr>
              </thead>
              <tbody className="leading-none">
                {items.map((item, i) => (
                  <tr key={i}>
                    {/* Nombre del producto un poco más grande */}
                    <td className="py-2 pr-1 align-top">
                      <span className="block">{item.nombre}</span>
                      {item.talle && item.talle !== '-' && (
                        <span className="text-[10px] bg-black text-white px-1 rounded-sm mt-0.5 inline-block">
                          T: {item.talle}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center align-top text-sm">{item.cantidad}</td>
                    <td className="py-2 text-right align-top text-sm">
                      $ {item.subtotal?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="w-full border-b-2 border-black mb-3"></div>

            {/* --- TOTAL --- */}
            <div className="w-full flex justify-between items-center mb-6 text-xl">
              <span className="font-black">TOTAL</span>
              <span className="font-black bg-black text-white px-2 py-1 rounded-sm">
                $ {parseFloat(total).toLocaleString()}
              </span>
            </div>
          </>
        )}

        {/* --- FOOTER --- */}
        <div className="text-center space-y-2">
          <p className="font-black text-sm">¡Gracias por tu compra!</p>

          <div className="text-[9px] font-medium normal-case"> {/* normal-case para la web */}
            www.campeonesindumentaria.com.ar
          </div>

          <div className="border border-black p-2 mt-2">
            <p className="text-[9px] font-bold">
              NO SE ACEPTAN CAMBIOS<br />SIN ESTA ETIQUETA/TICKET
            </p>
          </div>

          <p className="text-[8px] mt-2 text-gray-500">Documento no válido como factura.</p>
        </div>

      </div>
    </div>
  );
});

Ticket.displayName = 'Ticket';

export default Ticket;