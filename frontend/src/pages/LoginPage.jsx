import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
// --- IMPORTA TU LOGO AQUÍ ---
// Asegúrate de que la ruta sea correcta según donde guardaste la imagen
import logoImg from '../assets/logo.png';
import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Estado para mostrar feedback visual mientras carga
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true); // Activar estado de carga

    try {
      // La función login viene de tu AuthContext
      const result = await login(email, password);
      if (result.success) {
        navigate('/'); // Redirigir al dashboard si es exitoso
      } else {
        setError(result.message); // Mostrar error si falla
      }
    } catch (err) {
      setError('Ocurrió un error inesperado. Intenta nuevamente.');
    } finally {
      setIsLoading(false); // Desactivar estado de carga siempre
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">

      {/* --- SECCIÓN IZQUIERDA: BRANDING (Solo visible en pantallas grandes 'lg') --- */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-600 items-center justify-center relative overflow-hidden text-white">
        {/* Fondo con degradado y patrón sutil (opcional) */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-900 opacity-90 z-0"></div>

        <div className="relative z-10 text-center p-12">
          {/* Logo Grande */}
          <img
            src={logoImg}
            alt="Campeones Indumentaria Logo"
            className="w-64 mx-auto mb-8 rounded-full shadow-2xl border-4 border-blue-400/30 animate-fade-in-down"
          />
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight">Bienvenido a Campeones</h1>
          <p className="text-xl text-blue-100 max-w-md mx-auto">
            Tu sistema de gestión integral para indumentaria deportiva.
          </p>
        </div>
      </div>

      {/* --- SECCIÓN DERECHA: FORMULARIO --- */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 md:p-24 bg-white">
        <div className="w-full max-w-md space-y-8">

          {/* Encabezado del Formulario */}
          <div className="text-center">
            {/* Logo para móviles (se oculta en 'lg') */}
            <img src={logoImg} alt="Logo" className="h-28 w-auto mx-auto mb-6 lg:hidden rounded-full" />

            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="p-4 mb-4 text-sm text-red-700 bg-red-50 rounded-xl border-l-4 border-red-500 flex items-center animate-shake" role="alert">
              <svg className="h-6 w-6 text-red-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label htmlFor="email-address" className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    placeholder="ejemplo@campeones.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="ml-2 block text-gray-900">Recuérdame</span>
              </label>

              <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white 
                  ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform active:scale-[0.98]`}
              >
                {isLoading ? (
                  // Spinner de carga
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Ingresando...
                  </span>
                ) : (
                  'INGRESAR'
                )}
              </button>
            </div>

            <div className="mt-6 text-center border-t pt-4">
              <p className="text-sm text-gray-600">
                ¿Eres nuevo en el equipo?{' '}
                <Link to="/register" className="font-bold text-blue-600 hover:text-blue-800 transition-colors">
                  Crear una cuenta
                </Link>
              </p>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;