import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Shirt,
  ShoppingCart,
  LogOut,
  PackageSearch,
  FileText,
  DollarSign,
  PackageCheck,
  Truck,
  BarChart3,
  CalendarClock,
  Tags
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';

const Sidebar = () => {
  const { pathname } = useLocation();
  const { logout, user } = useAuth();

  // --- NUEVA ESTRUCTURA JERÁRQUICA DEL MENÚ ---
  const menuSections = [
    {
      title: 'OPERACIONES DIARIAS',
      items: [
        { path: '/', name: 'Dashboard', icon: LayoutDashboard },
        { path: '/caja', name: 'Nueva Venta', icon: ShoppingCart },
        { path: '/caja-control', name: 'Cierre de Caja', icon: DollarSign },
        { path: '/cambios', name: 'Cambio/ Devolucion', icon: DollarSign },
        { path: '/reservas', name: 'Reservas', icon: CalendarClock },
      ],
    },
    {
      title: 'INVENTARIO Y PRODUCTOS',
      items: [
        { path: '/productos', name: 'Catálogo de Productos', icon: Shirt },
        { path: '/inventario', name: 'Gestión de Inventario', icon: PackageSearch },
        { path: '/recuento', name: 'Recuento de Stock', icon: PackageCheck },
        { path: '/compras', name: 'Registro de Compras', icon: Truck },
        { path: '/etiquetas', name: 'Impresión de Etiquetas', icon: Truck },
        { path: '/categorias', name: 'Gestión de Categorías', icon: Tags },
      ],
    },
    {
      title: 'REPORTES Y CONTROL',
      items: [
        { path: '/ventas', name: 'Historial de Ventas', icon: FileText },
        { path: '/caja-historial', name: 'Historial de Cajas', icon: FileText },
        { path: '/reportes', name: 'Estadísticas', icon: BarChart3 },
      ],
    },
  ];
  // ---------------------------------------------

  return (
    <div className="flex flex-col h-screen w-72 bg-slate-900 text-white shadow-2xl border-r border-slate-800">

      {/* --- HEADER: LOGO Y MARCA --- */}
      <a href="/">
        <div className="flex flex-col items-center justify-center py-8 border-b border-slate-800 bg-slate-900/50">
          <div className="p-1 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-3 transition-transform hover:scale-105 cursor-pointer">
            <img
              src={logoImg}
              alt="Campeones"
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
            />
          </div>
          <h1 className="text-xl font-black tracking-wider text-white uppercase mt-1">
            CAMPEONES
          </h1>
          <p className="text-[10px] font-bold text-blue-400 tracking-[0.2em] uppercase">
            Indumentaria
          </p>
        </div></a>

      {/* --- NAVEGACIÓN (CON SECCIONES) --- */}
      <nav className="flex-1 px-4 py-6 space-y-4 overflow-y-auto custom-scrollbar">

        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">

            {/* Título del Grupo / Sección */}
            <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {section.title}
            </p>

            {/* Ítems dentro del Grupo */}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 translate-x-1'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
                    }`}
                >
                  <Icon
                    size={20}
                    className={`mr-3 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'
                      }`}
                  />
                  <span>{item.name}</span>

                  {/* Indicador activo (punto) */}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* --- FOOTER: PERFIL Y SALIR --- */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-inner">
            {user?.nombre?.charAt(0) || 'U'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">
              {user?.nombre || 'Usuario'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.rol || 'Vendedor'}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center w-full px-4 py-2 text-sm font-bold text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-lg transition-all duration-200 border border-transparent hover:border-red-400"
        >
          <LogOut size={16} className="mr-2" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;