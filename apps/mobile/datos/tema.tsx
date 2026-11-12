/**
 * El tema de toda la app.
 *
 * El proveedor envuelve también la pantalla de carga, para que el arranque no
 * parpadee en el tema equivocado, y por eso queda fuera de la base, que abre
 * después. La elección se guarda en `ajustes` igual: el proveedor arranca
 * siguiendo al sistema y `TemaGuardado`, que sí cuelga de la base, le pasa la
 * elección en cuanto la base abre. Escribir el ajuste es lo único que cambia
 * el tema, así que la base manda y la memoria la refleja.
 */

import { CLAVE_TEMA, escribirAjuste } from '@iceberg/db';
import { themes, type Theme, type ThemeName } from '@iceberg/ui';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useDatos } from './BaseDeDatos';
import { useAjuste } from './consultas';

interface ValorDelTema {
  readonly nombre: ThemeName;
  readonly theme: Theme;
  /** Lo pone en memoria. Para guardarlo, `useCambiarTema`. */
  fijar(nombre: ThemeName): void;
}

const ContextoDeTema = createContext<ValorDelTema | null>(null);

export function ProveedorDeTema({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [nombre, setNombre] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');

  const valor = useMemo<ValorDelTema>(() => ({
    nombre,
    theme: themes[nombre],
    fijar: setNombre,
  }), [nombre]);

  return <ContextoDeTema.Provider value={valor}>{children}</ContextoDeTema.Provider>;
}

/** No dibuja nada: le pasa al proveedor el tema guardado y lo sigue mirando. */
export function TemaGuardado() {
  const { fijar } = useTema();
  const guardado = useAjuste(CLAVE_TEMA);

  useEffect(() => {
    if (guardado === 'dark' || guardado === 'light') fijar(guardado);
  }, [guardado, fijar]);

  return null;
}

/** Guarda el tema. Es lo único que lo cambia: ver `TemaGuardado`. */
export function useCambiarTema(): (nombre: ThemeName) => void {
  const { db } = useDatos();
  return (nombre) => escribirAjuste(db, CLAVE_TEMA, nombre);
}

export function useTema(): ValorDelTema {
  const valor = useContext(ContextoDeTema);
  if (valor === null) throw new Error('useTema fuera de ProveedorDeTema');
  return valor;
}
