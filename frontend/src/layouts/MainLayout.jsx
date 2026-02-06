import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { Toaster } from 'react-hot-toast';

const MainLayout = () => {
  const navigate = useNavigate();

  // --- ATAJOS DE TECLADO GLOBALES ---
  useEffect(() => {
    const handleShortcuts = (e) => {
      // F1 -> CAJA
      if (e.key === 'F1') { e.preventDefault(); navigate('/caja'); }
      // F2 -> INVENTARIO
      if (e.key === 'F2') { e.preventDefault(); navigate('/inventario'); }
      // F3 -> CAMBIOS
      if (e.key === 'F3') { e.preventDefault(); navigate('/cambios'); }
      // F4 -> NUEVO PRODUCTO
      if (e.key === 'F4') { e.preventDefault(); navigate('/productos'); }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [navigate]);

  return (
    // CAMBIO CLAVE 1: 'flex-col' para que sea vertical (Arriba hacia abajo)
    <div className="flex flex-col h-screen bg-gray-100 font-sans overflow-hidden">

      {/* Topbar Fija (z-index alto) */}
      <Topbar />

      {/* Toast Global */}
      <Toaster position="top-center" />

      {/* CAMBIO CLAVE 2: Estructura del Main 
          - flex-1: Ocupa todo el espacio restante.
          - pt-16: Deja espacio para la barra de arriba (4rem = 16).
          - overflow-y-auto: HABILITA EL SCROLL si el contenido es muy largo (Arqueo).
          - relative: Para posicionamiento de modales internos.
      */}
      <main className="flex-1 pt-16 overflow-y-auto relative scroll-smooth">

        {/* Renderizamos la página hija. 
            Nota: Quitamos el padding global (p-8) para que el POS y el Inventario 
            puedan usar el 100% del ancho/alto si lo necesitan. 
        */}
        <Outlet />

      </main>
    </div>
  );
};

export default MainLayout;