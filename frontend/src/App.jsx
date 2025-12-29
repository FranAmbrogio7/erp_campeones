import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LabelProvider } from './context/LabelContext';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
// --- NUEVO: Importa tu página de inventario ---
import InventoryPage from './pages/InventoryPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import CashRegisterPage from './pages/CashRegisterPage';
import StockTakePage from './pages/StockTakePage';
import CashHistoryPage from './pages/CashHistoryPage';
import PurchasesPage from './pages/PurchasesPage';
import ReturnsPage from './pages/ReturnsPage';
import LabelPrinterPage from './pages/LabelPrinterPage';
import StatsPage from './pages/StatsPage';
import CategoriesPage from './pages/CategoriesPage';
import ReservationsPage from './pages/ReservationsPage';
import BudgetPage from './pages/BudgetPage';
import RegisterPage from './pages/RegisterPage';
import CreditNotesPage from './pages/CreditNotesPage';
import StockReportPage from './pages/StockReportPage';
import NotesPage from './pages/NotesPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LabelProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Rutas Protegidas dentro del Layout Principal */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/caja-control" element={<CashRegisterPage />} />
                <Route path="/ventas" element={<SalesHistoryPage />} />
                <Route path="/productos" element={<ProductsPage />} />
                <Route path="/caja" element={<POSPage />} />
                <Route path="/pos" element={<POSPage />} />
                <Route path="/inventario" element={<InventoryPage />} />
                <Route path="/recuento" element={<StockTakePage />} />
                <Route path="/caja-historial" element={<CashHistoryPage />} />
                <Route path="/compras" element={<PurchasesPage />} />
                <Route path="/cambios" element={<ReturnsPage />} />
                <Route path="/etiquetas" element={<LabelPrinterPage />} />
                <Route path="/reportes" element={<StatsPage />} />
                <Route path="/categorias" element={<CategoriesPage />} />
                <Route path="/reservas" element={<ReservationsPage />} />
                <Route path="/presupuestos" element={<BudgetPage />} />
                <Route path="/notas-credito" element={<CreditNotesPage />} />
                <Route path="/reporte-stock" element={<StockReportPage />} />
                <Route path="/notas" element={<NotesPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </LabelProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;