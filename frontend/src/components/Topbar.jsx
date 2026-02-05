import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import {
  LayoutDashboard, ChevronDown, LogOut, Menu, X,
  Store, Package, Users, ShoppingCart, Lock, ScrollText, History, FileText,
  Shirt, ArrowRightLeft, ClipboardCheck, Truck, QrCode, Tags,
  CalendarClock, FileSpreadsheet, PieChart
} from 'lucide-react';

const Topbar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Cerrar menú móvil al navegar
  useEffect(() => setIsMobileOpen(false), [pathname]);

  const menuStructure = [
    { type: 'link', path: '/', name: 'Dashboard', icon: LayoutDashboard },
    {
      type: 'folder', key: 'ventas', name: 'Ventas', icon: Store,
      items: [
        { path: '/caja', name: 'Punto de Venta', icon: ShoppingCart },
        { path: '/caja-control', name: 'Cierre Caja', icon: Lock },
        { path: '/ventas', name: 'Historial', icon: ScrollText },
        { path: '/caja-historial', name: 'Cajas Pasadas', icon: History },
      ]
    },
    {
      type: 'folder', key: 'gestion', name: 'Gestión', icon: Users,
      items: [
        { path: '/cambios', name: 'Cambios', icon: ArrowRightLeft },
        { path: '/reservas', name: 'Reservas', icon: CalendarClock },
        { path: '/notas-credito', name: 'Notas Crédito', icon: QrCode },
        { path: '/presupuestos', name: 'Presupuestos', icon: FileSpreadsheet },
      ]
    },
    {
      type: 'folder', key: 'inventario', name: 'Stock', icon: Package,
      items: [
        { path: '/productos', name: 'Productos', icon: Shirt },
        { path: '/inventario', name: 'Inventario', icon: ArrowRightLeft },
        { path: '/recuento', name: 'Recuento', icon: ClipboardCheck },
        { path: '/compras', name: 'Compras', icon: Truck },
        { path: '/etiquetas', name: 'Etiquetas', icon: QrCode },
        { path: '/categorias', name: 'Categorías', icon: Tags },
      ]
    },
    {
      type: 'folder', key: 'reportes', name: 'Reportes', icon: PieChart,
      items: [
        { path: '/reportes', name: 'Estadísticas', icon: PieChart },
        { path: '/reporte-stock', name: 'Rep. Stock', icon: ArrowRightLeft },
      ]
    },
    { type: 'link', key: 'notas', name: 'Notas', icon: FileText, path: '/notas' }
  ];

  return (
    <header className="bg-slate-900 text-white shadow-md fixed top-0 left-0 right-0 z-[1000] h-16 transition-all">
      <div className="h-full max-w-[1920px] mx-auto px-4 flex items-center justify-between">

        {/* --- 1. LOGO --- */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-white/10 rounded-full p-1 border border-white/10 group-hover:border-blue-500 transition-colors">
              <img src={logoImg} className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="hidden lg:block leading-tight">
              <h1 className="font-black tracking-wider text-sm uppercase">CAMPEONES</h1>
              <p className="text-[9px] font-bold text-blue-400 tracking-widest uppercase">ERP | GESTION</p>
            </div>
          </Link>
        </div>

        {/* --- 2. NAVEGACIÓN DESKTOP (SIN FLICKER) --- */}
        <nav className="hidden md:flex items-center gap-1 h-full mx-4">
          {menuStructure.map((item, idx) => {

            // LINK SIMPLE
            if (item.type === 'link') {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={idx}
                  to={item.path}
                  className={`relative h-full flex items-center px-4 text-sm font-bold transition-all border-b-2 ${isActive ? 'border-blue-500 text-white bg-slate-800/50' : 'border-transparent text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  <item.icon size={18} className="mr-2 opacity-80" />
                  {item.name}
                </Link>
              );
            }

            // DROPDOWN (Folder) - SOLUCIÓN "GROUP"
            if (item.type === 'folder') {
              const isActiveParent = item.items.some(sub => sub.path === pathname);

              return (
                <div key={idx} className="group relative h-full flex items-center">

                  {/* Botón Trigger (ocupa toda la altura) */}
                  <button
                    className={`h-full flex items-center px-4 text-sm font-bold transition-all border-b-2 outline-none ${isActiveParent
                      ? 'border-blue-500 text-white bg-slate-800/50'
                      : 'border-transparent text-slate-300 group-hover:text-white group-hover:bg-slate-800'
                      }`}
                  >
                    <item.icon size={18} className={`mr-2 ${isActiveParent ? 'text-blue-400' : 'opacity-80'}`} />
                    {item.name}
                    <ChevronDown size={14} className="ml-1 transition-transform group-hover:rotate-180 duration-200" />
                  </button>

                  {/* Dropdown Menu (Mecánica GROUP-HOVER) */}
                  {/* invisible + opacity-0: Oculto por defecto
                      group-hover:visible + opacity-100: Se muestra al pasar el mouse sobre el PADRE
                      top-full: Pegado exactamente al borde inferior (sin huecos)
                  */}
                  <div className="absolute top-full left-0 w-60 pt-2 invisible opacity-0 translate-y-2 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 ease-out transform origin-top-left">

                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden relative">
                      {/* Triangulito decorativo (opcional) */}
                      <div className="absolute top-0 left-6 w-3 h-3 bg-white border-l border-t border-gray-200 transform -translate-y-1/2 rotate-45"></div>

                      <div className="bg-slate-50 px-4 py-3 border-b border-gray-100">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Módulo {item.name}
                        </span>
                      </div>

                      <div className="p-2 grid gap-1">
                        {item.items.map((sub, subIdx) => (
                          <Link
                            key={subIdx}
                            to={sub.path}
                            className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${pathname === sub.path
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                              }`}
                          >
                            <sub.icon size={16} className={`mr-3 ${pathname === sub.path ? 'text-blue-600' : 'text-gray-400'}`} />
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            }
          })}
        </nav>

        {/* --- 3. USUARIO Y MENU MÓVIL --- */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-700">
            <div className="text-right">
              <p className="text-xs font-bold text-white leading-tight">{user?.nombre || 'Usuario'}</p>
              <p className="text-[10px] text-blue-400 uppercase font-bold">{user?.rol}</p>
            </div>
            <button onClick={logout} className="p-2 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white rounded-lg transition-colors">
              <LogOut size={18} />
            </button>
          </div>
          <button className="md:hidden p-2 text-slate-300 hover:text-white" onClick={() => setIsMobileOpen(!isMobileOpen)}>
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* --- 4. MENÚ MÓVIL (Sin cambios) --- */}
      {isMobileOpen && (
        <div className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-slate-950/95 backdrop-blur-sm z-40 overflow-y-auto p-4 border-t border-slate-800 animate-fade-in">
          <div className="space-y-4 pb-20">
            {menuStructure.map((item, idx) => {
              if (item.type === 'link') {
                return (
                  <Link key={idx} to={item.path} className="flex items-center p-4 rounded-xl bg-slate-900 text-slate-200 font-bold border border-slate-800" onClick={() => setIsMobileOpen(false)}>
                    <item.icon size={20} className="mr-3 text-blue-400" /> {item.name}
                  </Link>
                )
              }
              if (item.type === 'folder') {
                return (
                  <div key={idx} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                    <div className="p-4 flex items-center text-slate-400 font-bold border-b border-slate-800 bg-black/20">
                      <item.icon size={20} className="mr-3 text-blue-500" /> {item.name}
                    </div>
                    <div className="p-2 space-y-1">
                      {item.items.map((sub, sIdx) => (
                        <Link key={sIdx} to={sub.path} className="flex items-center p-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setIsMobileOpen(false)}>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-3"></div>
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              }
            })}
            <button onClick={logout} className="w-full mt-6 p-4 rounded-xl bg-red-900/20 text-red-400 font-bold border border-red-900/50 flex justify-center items-center">
              <LogOut size={20} className="mr-2" /> Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;  