import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom'; // Importar useNavigate
import Topbar from '../components/Topbar';
import { Toaster } from 'react-hot-toast'; // Aseguramos Toaster global

const MainLayout = () => {
  const navigate = useNavigate();

  // --- ATAJOS DE TECLADO GLOBALES ---
  useEffect(() => {
    const handleShortcuts = (e) => {
      // F1 -> IR A PUNTO DE VENTA (CAJA)
      if (e.key === 'F1') {
        e.preventDefault(); // Evita que abra la ayuda del navegador
        navigate('/caja');
      }

      // F2 -> IR A INVENTARIO
      if (e.key === 'F2') {
        e.preventDefault();
        navigate('/inventario');
      }

      // F3 -> IR A CAMBIOS
      if (e.key === 'F3') {
        e.preventDefault(); // A veces es buscar
        navigate('/cambios');
      }

      // F4 -> IR A NUEVO PRODUCTO (Directo al form de productos)
      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/productos');
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [navigate]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans overflow-hidden">
      {/* Sidebar / Topbar Fijo */}
      <Topbar />
      <Toaster position="top-center" />

      {/* Área de Contenido Dinámico */}
      {/* Agregamos pt-16 para compensar la Topbar fija */}
      <main className="flex-1 overflow-hidden pt-16 relative">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;