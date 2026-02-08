import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { Toaster } from 'react-hot-toast';

const MainLayout = () => {
  const navigate = useNavigate();

  // --- ATAJOS DE TECLADO GLOBALES ---
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Evitamos conflictos si el usuario está escribiendo en un input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

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
    // CAMBIO CLAVE: Agregamos 'dark:bg-slate-950' y 'dark:text-white'
    // 'transition-colors' suaviza el cambio entre modos
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-slate-950 font-sans overflow-hidden transition-colors duration-300">

      {/* Topbar Fija (z-index alto) */}
      <Topbar />

      {/* Toast Global */}
      <Toaster position="top-center"
        toastOptions={{
          // Opcional: Personalizar toasts para dark mode automáticamente
          className: 'dark:bg-slate-800 dark:text-white',
        }}
      />

      {/* Contenedor Principal */}
      <main className="flex-1 pt-16 overflow-y-auto relative scroll-smooth">

        {/* Renderizamos la página hija */}
        <Outlet />

      </main>
    </div>
  );
};

export default MainLayout;