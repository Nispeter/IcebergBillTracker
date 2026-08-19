/**
 * Tema compartido por toda la app.
 *
 * Estaba en un `useState` por pantalla: cambiar a "Noche polar" en Home no
 * llegaba al listado, y los dos modales no tenian interruptor —se abrian
 * siempre en el tema del sistema— asi que una hoja clara caia encima de una
 * pantalla oscura.
 *
 * Vive en un contexto y no en la base porque es preferencia de vista, no dato
 * del hogar: no tiene por que viajar a los otros dispositivos.
 */

import { themes, type Theme, type ThemeName } from '@iceberg/ui';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

interface ValorDelTema {
  readonly nombre: ThemeName;
  readonly theme: Theme;
  alternar(): void;
}

const ContextoDeTema = createContext<ValorDelTema | null>(null);

export function ProveedorDeTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [nombre, setNombre] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');

  const valor = useMemo<ValorDelTema>(() => ({
    nombre,
    theme: themes[nombre],
    alternar: () => setNombre((actual) => (actual === 'dark' ? 'light' : 'dark')),
  }), [nombre]);

  return <ContextoDeTema.Provider value={valor}>{children}</ContextoDeTema.Provider>;
}

export function useTema(): ValorDelTema {
  const valor = useContext(ContextoDeTema);
  if (valor === null) throw new Error('useTema fuera de ProveedorDeTema');
  return valor;
}
