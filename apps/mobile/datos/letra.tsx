/**
 * El tamaño de letra elegido en Ajustes, compartido por toda la app.
 *
 * En un contexto: lo necesitan casi todas las pantallas, y una consulta por
 * pantalla sería leer el mismo número treinta veces. Fuera del proveedor (la
 * pantalla de "Preparando la base…", que se dibuja antes de que la base abra)
 * vale el tamaño de siempre.
 */

import { letraConEscala, LETRA_NORMAL, type Letra } from '@iceberg/ui';
import { CLAVE_ESCALA_DE_LETRA, escribirAjuste } from '@iceberg/db';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDatos } from './BaseDeDatos';
import { useAjuste } from './consultas';

const Contexto = createContext<Letra>(LETRA_NORMAL);

export function ProveedorDeLetra({ children }: { children: ReactNode }) {
  const crudo = useAjuste(CLAVE_ESCALA_DE_LETRA);
  // La identidad del objeto es la que hace que `useEstilos` rearme las hojas.
  const letra = useMemo(() => letraConEscala(Number(crudo)), [crudo]);
  return <Contexto.Provider value={letra}>{children}</Contexto.Provider>;
}

/** Los tamaños ya escalados. Las pantallas los reciben por `useEstilos`. */
export function useLetra(): Letra {
  return useContext(Contexto);
}

/** Cambia el tamaño para toda la app. El valor se acota al leerlo. */
export function useCambiarEscala(): (escala: number) => void {
  const { db } = useDatos();
  return (escala: number) => escribirAjuste(db, CLAVE_ESCALA_DE_LETRA, String(escala));
}
