import { useEffect } from 'react';

export const useScanDetection = (inputRef) => {
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // 1. Si el usuario ya está escribiendo en un input o textarea, NO interrumpir
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

            // 2. Ignorar teclas de control (Ctrl, Alt, Esc, etc.) para no bloquear atajos
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            // 3. Si la tecla es imprimible (letras, números, símbolos) o Enter
            // El escáner envía una ráfaga de teclas rápidas.
            if (e.key.length === 1 || e.key === 'Enter') {
                if (inputRef.current) {
                    inputRef.current.focus();
                    // Al hacer focus aquí, el carácter presionado se escribirá automáticamente en el input
                }
            }
        };

        // Escuchamos en toda la ventana
        window.addEventListener('keydown', handleGlobalKeyDown);

        // Limpieza al desmontar
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [inputRef]);
};