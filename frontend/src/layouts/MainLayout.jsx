import { Outlet } from 'react-router-dom';
import Topbar from '../components/Topbar';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* 1. La Barra Superior Fija */}
      <Topbar />

      {/* 2. El Contenedor del Contenido */}
      {/* 'pt-16' empuja el contenido hacia abajo para que la barra no lo tape */}
      {/* 'h-screen' asegura que ocupe toda la altura disponible */}
      <main className="pt-16 h-screen flex flex-col">

        {/* Este div interno maneja el scroll de cada página individualmente */}
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>

      </main>
    </div>
  );
};

export default MainLayout;