import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast'; // <--- IMPORTANTE: Importar Toast

const AuthContext = createContext();

// Configuración de Axios
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Interceptor de SOLICITUD (Request): Agrega el token saliente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    const cleanToken = token.replace(/"/g, '');
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Verificar sesión al cargar
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, [token]);

  // --- FUNCIÓN LOGIN ---
  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });

      if (res.data.success) {
        const { token, user } = res.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        setToken(token);
        setUser(user);

        return { success: true };
      }

      return { success: false, message: "Respuesta inesperada del servidor" };

    } catch (error) {
      console.error("Error en Login:", error);
      return {
        success: false,
        message: error.response?.data?.msg || "Error de conexión con el servidor"
      };
    }
  };

  // --- FUNCIÓN LOGOUT ---
  // Usamos useCallback para que sea estable y no cause re-renders innecesarios
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  // =================================================================
  //  NUEVO: INTERCEPTOR DE RESPUESTA (Response) - "El Portero"
  // =================================================================
  useEffect(() => {
    // Configuramos el interceptor
    const interceptor = api.interceptors.response.use(
      (response) => response, // Si todo sale bien, pasa la respuesta
      (error) => {
        // Si hay error, verificamos si es por sesión vencida
        if (error.response && (error.response.status === 401 || error.response.status === 422)) {

          // Solo actuamos si actualmente creemos que estamos logueados
          if (localStorage.getItem('token')) {
            console.warn("⚠️ Sesión expirada detectada por el interceptor.");

            // 1. Ejecutar Logout
            logout();

            // 2. Avisar al usuario (El toast se verá en la pantalla de login)
            toast.error("Tu sesión ha expirado. Ingresa nuevamente.", {
              duration: 5000,
              icon: '🔒'
            });
          }
        }
        return Promise.reject(error); // Rechazamos para que el componente maneje su error localmente si quiere
      }
    );

    // LIMPIEZA: Eyectar el interceptor cuando el componente se desmonte o cambie
    // Esto es vital para no tener interceptores duplicados
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [logout]); // Dependemos de logout

  const value = {
    user,
    token,
    login,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);