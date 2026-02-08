import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import logoImg from '../assets/logo.png';
import { User, Mail, Lock, Briefcase, CheckCircle, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const RegisterPage = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        email: '',
        password: '',
        confirmPassword: '',
        id_rol: '2' // 2 = Vendedor
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }
        setIsLoading(true);
        try {
            const res = await api.post('/auth/register', {
                nombre: formData.nombre,
                apellido: formData.apellido,
                email: formData.email,
                password: formData.password,
                id_rol: parseInt(formData.id_rol)
            });
            if (res.status === 201) {
                toast.success("¡Empleado registrado!");
                setTimeout(() => navigate('/login'), 1500);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.msg || "Error al registrar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950 font-sans transition-colors duration-300">
            <Toaster position="top-center" />

            {/* IZQUIERDA (Branding) - Se mantiene oscuro siempre */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 items-center justify-center relative overflow-hidden text-white">
                <div className="relative z-10 text-center p-12">
                    <img src={logoImg} alt="Logo" className="w-48 mx-auto mb-8 rounded-full border-4 border-slate-700 shadow-2xl" />
                    <h1 className="text-4xl font-extrabold mb-4">Alta de Empleado</h1>
                    <p className="text-slate-400 max-w-md mx-auto">
                        Registra un nuevo miembro del equipo en la base de datos de Campeones.
                    </p>
                </div>
            </div>

            {/* DERECHA (Formulario) */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white dark:bg-slate-950 overflow-y-auto transition-colors">
                <div className="w-full max-w-md space-y-6">

                    <Link to="/login" className="inline-flex items-center text-sm text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors">
                        <ArrowLeft size={16} className="mr-1" /> Volver al Login
                    </Link>

                    <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">Nuevo Usuario</h2>

                    <form className="space-y-4" onSubmit={handleSubmit}>

                        {/* GRUPO NOMBRE Y APELLIDO */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Nombre</label>
                                <input name="nombre" type="text" required className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600" placeholder="Juan" value={formData.nombre} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Apellido</label>
                                <input name="apellido" type="text" required className="w-full p-3 border dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600" placeholder="Pérez" value={formData.apellido} onChange={handleChange} />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
                                <input name="email" type="email" required className="w-full pl-10 p-3 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="usuario@campeones.com" value={formData.email} onChange={handleChange} />
                            </div>
                        </div>

                        {/* Rol */}
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Rol / Permisos</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
                                <select name="id_rol" className="w-full pl-10 p-3 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white appearance-none" value={formData.id_rol} onChange={handleChange}>
                                    <option value="1">Administrador (Total)</option>
                                    <option value="2">Vendedor (Caja)</option>
                                </select>
                            </div>
                        </div>

                        {/* Contraseñas */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
                                    <input name="password" type="password" required className="w-full pl-10 p-3 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="******" value={formData.password} onChange={handleChange} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1">Confirmar</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-gray-400 dark:text-gray-500" size={18} />
                                    <input name="confirmPassword" type="password" required className="w-full pl-10 p-3 border dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white" placeholder="******" value={formData.confirmPassword} onChange={handleChange} />
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading} className="w-full bg-slate-900 dark:bg-blue-600 text-white py-3.5 rounded-lg font-bold hover:bg-black dark:hover:bg-blue-700 transition-all flex justify-center items-center shadow-lg dark:shadow-none">
                            {isLoading ? 'Registrando...' : 'Dar de Alta'} <CheckCircle size={20} className="ml-2" />
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;