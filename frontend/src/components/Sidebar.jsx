import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import {
  // Iconos Generales
  LayoutDashboard, ChevronDown, ChevronRight, LogOut, Menu, X, // <--- NUEVOS ICONOS (Menu, X)

  // Iconos de Módulos
  Store, Package, Users, BarChart4,

  // Iconos de Items
  ShoppingCart, Lock, ScrollText, History, FileText,
  Shirt, ArrowRightLeft, ClipboardCheck, Truck, QrCode, Tags,
  CalendarClock, FileSpreadsheet, PieChart
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  // --- ESTADO PARA EL MENÚ MÓVIL ---
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Función para cerrar el menú al hacer clic en un link (UX Móvil)
  const closeMobileMenu = () => setIsMobileOpen(false);

  // Función auxiliar para verificar permisos
  const canSee = (requiredRole) => {
    if (user?.rol === 'admin') return true;
    return user?.rol === requiredRole;
  };

  const [openMenus, setOpenMenus] = useState({
    ventas: true,
    inventario: false,
    gestion: false,
    reportes: false
  });

  const toggleMenu = (key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- ESTRUCTURA DEL MENÚ (Misma que tenías) ---
  const menuStructure = [
    { type: 'link', path: '/', name: 'Dashboard', icon: LayoutDashboard },
    {
      type: 'folder', key: 'ventas', name: 'Caja y Ventas', icon: Store,
      items: [
        { path: '/caja', name: 'Punto de Venta', icon: ShoppingCart },
        { path: '/caja-control', name: 'Cierre de Caja', icon: Lock },
        { path: '/ventas', name: 'Historial Ventas', icon: ScrollText },
        { path: '/caja-historial', name: 'Historial Cajas', icon: History },
      ]
    },
    {
      type: 'folder', key: 'gestion', name: 'Gestión Comercial', icon: Users,
      items: [
        { path: '/cambios', name: 'Cambios / Devol.', icon: ArrowRightLeft },
        { path: '/reservas', name: 'Reservas y Señas', icon: CalendarClock },
        { path: '/notas-credito', name: 'Notas de Crédito', icon: QrCode },
        { path: '/presupuestos', name: 'Presupuestos', icon: FileSpreadsheet },
      ]
    },
    {
      type: 'folder', key: 'inventario', name: 'Stock y Productos', icon: Package,
      items: [
        { path: '/productos', name: 'Catálogo Productos', icon: Shirt },
        { path: '/inventario', name: 'Inventario', icon: ArrowRightLeft },
        { path: '/recuento', name: 'Recuento Físico', icon: ClipboardCheck },
        { path: '/compras', name: 'Registro Compras', icon: Truck },
        { path: '/etiquetas', name: 'Etiquetas / Códigos', icon: QrCode },
        { path: '/categorias', name: 'Categorías', icon: Tags },
      ]
    },
    {
      type: 'folder', key: 'reportes', name: 'Estadísticas', icon: PieChart,
      items: [
        { path: '/reportes', name: 'Estadísticas', icon: PieChart },
        { path: '/reporte-stock', name: 'Reporte de Stock', icon: ArrowRightLeft },
      ]
    },
    { type: 'link', key: 'notas', name: 'Notas', icon: FileText, path: '/notas' }
  ];

  return (
    <>
      {/* 1. BOTÓN HAMBURGUESA (Solo visible en Móvil) */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-colors"
      >
        <Menu size={24} />
      </button>

      {/* 2. OVERLAY OSCURO (Backdrop) - Solo visible cuando el menú está abierto en móvil */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* 3. SIDEBAR PRINCIPAL */}
      <div className={`
        flex flex-col h-screen w-72 bg-slate-950 text-slate-300 shadow-2xl border-r border-slate-900 select-none
        fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:static md:inset-auto
      `}>

        {/* --- HEADER --- */}
        <div className="relative">
          <Link to="/" onClick={closeMobileMenu}>
            <div className="flex flex-col items-center justify-center py-8 border-b border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
              <div className="p-1 bg-white/10 rounded-full shadow-inner mb-3 ring-2 ring-slate-800">
                <img src={logoImg} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
              </div>
              <h1 className="text-lg font-black tracking-wider text-white uppercase">CAMPEONES</h1>
              <p className="text-[10px] font-bold text-blue-500 tracking-[0.3em] uppercase">Sistema de Gestión</p>
            </div>
          </Link>

          {/* Botón CERRAR (Solo Móvil, dentro del menú) */}
          <button
            onClick={closeMobileMenu}
            className="md:hidden absolute top-2 right-2 p-2 text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* --- NAVEGACIÓN --- */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 space-y-1">
          {menuStructure.map((item, idx) => {

            // RENDER: ENLACE DIRECTO
            if (item.type === 'link') {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={idx}
                  to={item.path}
                  onClick={closeMobileMenu} // <--- Cierra el menú al navegar
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-bold mb-2 ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'hover:bg-slate-800 hover:text-white'
                    }`}
                >
                  <item.icon size={20} className={`mr-3 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            }

            // RENDER: CARPETA DESPLEGABLE
            if (item.type === 'folder') {
              const isOpen = openMenus[item.key];
              const isChildActive = item.items.some(sub => sub.path === pathname);

              return (
                <div key={idx} className="mb-2">
                  <button
                    onClick={() => toggleMenu(item.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold ${isChildActive ? 'text-blue-400 bg-slate-900' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center">
                      <item.icon size={20} className="mr-3" />
                      <span>{item.name}</span>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                    <div className="ml-4 pl-4 border-l-2 border-slate-800 space-y-1 py-1">
                      {item.items.map((subItem) => {
                        const isSubActive = pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.path}
                            to={subItem.path}
                            onClick={closeMobileMenu} // <--- Cierra el menú al navegar
                            className={`flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${isSubActive
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                              }`}
                          >
                            <subItem.icon size={16} className={`mr-3 ${isSubActive ? 'text-blue-400' : 'text-slate-600'}`} />
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </nav>

        {/* --- FOOTER USER --- */}
        <div className="p-4 border-t border-slate-900 bg-slate-950">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg text-white">
              {user?.nombre?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.nombre || 'Usuario'}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{user?.rol || 'Vendedor'}</p>
            </div>
          </div>

          <button
            onClick={() => { logout(); closeMobileMenu(); }}
            className="flex items-center justify-center w-full px-4 py-2 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200 border border-red-900/50 hover:border-red-500"
          >
            <LogOut size={14} className="mr-2" />
            CERRAR SESIÓN
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;