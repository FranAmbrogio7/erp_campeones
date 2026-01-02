import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import {
  // Iconos Generales
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  LogOut,

  // Iconos de Módulos (Carpetas)
  Store,          // Ventas
  Package,        // Inventario
  Users,          // Clientes/Gestión
  BarChart4,      // Reportes

  // Iconos de Items Específicos
  ShoppingCart,   // Nueva Venta
  Lock,           // Cierre Caja
  ScrollText,     // Historial Ventas
  History,        // Historial Cajas
  FileText,       // Notas

  Shirt,          // Catálogo
  ArrowRightLeft, // Movimientos/Cambios
  ClipboardCheck, // Recuento
  Truck,          // Compras
  QrCode,         // Etiquetas
  Tags,           // Categorías

  CalendarClock,  // Reservas
  FileSpreadsheet,// Presupuestos

  PieChart        // Estadísticas
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth(); // Asumiendo que user = { nombre: 'Juan', rol: 'vendedor' }
  const { pathname } = useLocation();

  // Función auxiliar para verificar permisos
  const canSee = (requiredRole) => {
    if (user?.rol === 'admin') return true; // Admin ve todo
    return user?.rol === requiredRole;
  };

  // Estado para controlar qué menús están abiertos
  // Iniciamos con el menú de ventas abierto por defecto si quieres
  const [openMenus, setOpenMenus] = useState({
    ventas: true,
    inventario: false,
    gestion: false,
    reportes: false
  });

  const toggleMenu = (key) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- ESTRUCTURA DEL MENÚ ---
  const menuStructure = [
    {
      type: 'link',
      path: '/',
      name: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      type: 'folder',
      key: 'ventas',
      name: 'Caja y Ventas',
      icon: Store,
      items: [
        { path: '/caja', name: 'Punto de Venta', icon: ShoppingCart },
        { path: '/caja-control', name: 'Cierre de Caja', icon: Lock },
        { path: '/ventas', name: 'Historial Ventas', icon: ScrollText },
        { path: '/caja-historial', name: 'Historial Cajas', icon: History },
      ]
    },
    {
      type: 'folder',
      key: 'gestion',
      name: 'Gestión Comercial',
      icon: Users,
      items: [
        { path: '/cambios', name: 'Cambios / Devol.', icon: ArrowRightLeft },
        { path: '/reservas', name: 'Reservas y Señas', icon: CalendarClock },
        { path: '/notas-credito', name: 'Notas de Crédito', icon: QrCode },
        { path: '/presupuestos', name: 'Presupuestos', icon: FileSpreadsheet },
      ]
    },
    {
      type: 'folder',
      key: 'inventario',
      name: 'Stock y Productos',
      icon: Package,
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
      type: 'folder',
      key: 'reportes',
      name: 'Estadísticas',
      icon: PieChart,
      items: [
        { path: '/reportes', name: 'Estadísticas', icon: PieChart },
        { path: '/reporte-stock', name: 'Reporte de Stock', icon: ArrowRightLeft },
      ]
    },
    {
      type: 'link',
      key: 'notas',
      name: 'Notas',
      icon: FileText,
      path: '/notas'
    }
  ];

  return (
    <div className="flex flex-col h-screen w-72 bg-slate-950 text-slate-300 shadow-2xl border-r border-slate-900 select-none">

      {/* --- HEADER --- */}
      <Link to="/">
        <div className="flex flex-col items-center justify-center py-8 border-b border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
          <div className="p-1 bg-white/10 rounded-full shadow-inner mb-3 ring-2 ring-slate-800">
            <img src={logoImg} alt="Logo" className="w-16 h-16 rounded-full object-cover" />
          </div>
          <h1 className="text-lg font-black tracking-wider text-white uppercase">CAMPEONES</h1>
          <p className="text-[10px] font-bold text-blue-500 tracking-[0.3em] uppercase">Sistema de Gestión</p>
        </div>
      </Link>

      {/* --- NAVEGACIÓN --- */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-6 px-3 space-y-1">
        {menuStructure.map((item, idx) => {

          // RENDER: ENLACE DIRECTO (DASHBOARD, REPORTES)
          if (item.type === 'link') {
            const isActive = pathname === item.path;
            return (
              <Link
                key={idx}
                to={item.path}
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
            // Verificar si algún hijo está activo para resaltar la carpeta padre
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

                {/* SUBMENÚ */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="ml-4 pl-4 border-l-2 border-slate-800 space-y-1 py-1">
                    {item.items.map((subItem) => {
                      const isSubActive = pathname === subItem.path;
                      return (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
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
          onClick={logout}
          className="flex items-center justify-center w-full px-4 py-2 text-xs font-bold text-red-400 bg-red-950/30 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200 border border-red-900/50 hover:border-red-500"
        >
          <LogOut size={14} className="mr-2" />
          CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
};

export default Sidebar;