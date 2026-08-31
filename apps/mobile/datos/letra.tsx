/**
 * El tamano de letra elegido, compartido por toda la app.
 *
 * Va en un contexto y no en un hook por pantalla porque son casi treinta las
 * que lo necesitan: treinta `useLiveQuery` sobre la misma fila de una tabla de
 * clave-valor seria treinta suscripciones para leer un numero. Aca se lee una
 * vez y se reparte.
 *
 * `useLetra` **no revienta fuera del proveedor**, al reves que `useTema` o
 * `useDatos`. La razon es donde vive: el proveedor cuelga de la base --el ajuste
 * esta en SQLite-- asi que lo que se dibuja antes de que la base abra queda
 * afuera por fuerza. Eso es la pantalla de "Preparando la base…", que se ve un
 * instante y con el tamano de siempre.
 */

import { letraConEscala, LETRA_NORMAL, type Letra } from '@iceberg/ui';
import {
  CLAVE_ESCALA_DE_LETRA, consultaDeAjuste, escribirAjuste,
} from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useDatos } from './BaseDeDatos';

const Contexto = createContext<Letra>(LETRA_NORMAL);

export function ProveedorDeLetra({ children }: { children: ReactNode }) {
  const { db } = useDatos();
  const consulta = useMemo(() => consultaDeAjuste(db, CLAVE_ESCALA_DE_LETRA), [db]);
  const { data } = useLiveQuery(consulta);
  const crudo = data?.[0]?.valor;

  // La identidad del objeto es lo que hace que las pantallas recalculen sus
  // estilos: `crearEstilos` esta memoizado contra el, igual que contra el tema.
  const letra = useMemo(() => letraConEscala(Number(crudo)), [crudo]);

  return <Contexto.Provider value={letra}>{children}</Contexto.Provider>;
}

/** Los tamanos de letra ya escalados. Para `crearEstilos(theme, letra)`. */
export function useLetra(): Letra {
  return useContext(Contexto);
}

/** Cambia el tamano para toda la app. El valor se acota al leerlo. */
export function useCambiarEscala(): (escala: number) => void {
  const { db } = useDatos();
  return (escala: number) => escribirAjuste(db, CLAVE_ESCALA_DE_LETRA, String(escala));
}
