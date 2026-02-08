import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
                relative w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300
                ${theme === 'dark' ? 'bg-slate-700' : 'bg-blue-100'}
            `}
            title="Cambiar tema"
        >
            <div
                className={`
                    flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300
                    ${theme === 'dark' ? 'translate-x-7' : 'translate-x-0'}
                `}
            >
                {theme === 'dark' ? (
                    <Moon size={12} className="text-slate-900" />
                ) : (
                    <Sun size={12} className="text-orange-500" />
                )}
            </div>
        </button>
    );
};

export default ThemeToggle;