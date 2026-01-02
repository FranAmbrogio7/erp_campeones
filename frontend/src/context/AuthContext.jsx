import { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Configuración de Axios
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Interceptor para agregar el token a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    // Limpieza de comillas
    const cleanToken = token.replace(/"/g, '');

    // --- AGREGA ESTA LÍNEA PARA VER EN CONSOLA ---
    console.log("📤 Enviando Token:", cleanToken);
    // ---------------------------------------------

    config.headers.Authorization = `Bearer ${cleanToken}`;
  } else {
    console.warn("⚠️ No hay token en localStorage");
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

      // AQUÍ ESTABA EL PROBLEMA PROBABLEMENTE:
      // El backend devuelve: { success: true, token: "...", user: {...} }

      if (res.data.success) {
        const { token, user } = res.data;

        // Guardar en LocalStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Guardar en Estado
        setToken(token);
        setUser(user);

        return { success: true };
      }

      return { success: false, message: "Respuesta inesperada del servidor" };

    } catch (error) {
      console.error("Error en Login:", error);
      // Devolver mensaje claro
      return {
        success: false,
        message: error.response?.data?.msg || "Error de conexión con el servidor"
      };
    }
  };

  // --- FUNCIÓN LOGOUT ---
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.href = '/login'; // Redirigir forzadamente
  };

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