/**
 * Tema compartido por toda la app.
 *
 * Estaba en un `useState` por pantalla: cambiar a "Noche polar" en Home no
 * llegaba al listado, y los dos modales no tenian interruptor —se abrian
 * siempre en el tema del sistema— asi que una hoja clara caia encima de una
 * pantalla oscura.
 *
 * ## Por que la eleccion vive en la base pero el proveedor no
 *
 * El proveedor envuelve **todo**, incluidas la pantalla de carga y la de error,
 * para que el arranque no parpadee en el tema equivocado. Eso lo deja por fuera
 * de la base de datos, que se abre despues. Pero la eleccion tiene que
 * guardarse en alguna parte, y en este proyecto ese lugar es `ajustes`.
 *
 * Se resuelve con dos piezas: el proveedor guarda el tema en memoria y arranca
 * siguiendo al sistema, y `TemaGuardado` --que si cuelga de la base-- le pasa
 * la eleccion en cuanto la base abre. Escribir el ajuste es lo unico que cambia
 * el tema, asi que no hay dos fuentes de verdad: la base manda y la memoria es
 * su reflejo.
 *
 * El costo es un parpadeo de unos milisegundos en el arranque frio, y solo para
 * quien eligio un tema distinto al de su telefono: se ve la pantalla de carga
 * en el tema del sistema y despues cambia. La alternativa era leer la eleccion
 * antes de dibujar nada, y para eso hace falta un almacen sincrono que este
 * proyecto no tiene: `expo-sqlite/kv-store` lo es en Android pero no en web.
 */

import { CLAVE_TEMA, consultaDeAjuste, escribirAjuste } from '@iceberg/db';
import { themes, type Theme, type ThemeName } from '@iceberg/ui';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useDatos } from './BaseDeDatos';

interface ValorDelTema {
  readonly nombre: ThemeName;
  readonly theme: Theme;
  /** Lo pone en memoria. Para guardarlo, ver `useCambiarTema`. */
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

/**
 * Le pasa al proveedor el tema guardado, y lo sigue mirando.
 *
 * No dibuja nada: existe solo para vivir dentro del proveedor de datos, que es
 * donde hay base, y empujar hacia arriba lo que encuentre. Que sea una consulta
 * viva y no una lectura suelta es lo que hace que tocar el boton en Ajustes se
 * vea en el acto: se escribe el ajuste y el cambio vuelve por aca.
 */
export function TemaGuardado() {
  const { db } = useDatos();
  const { fijar } = useTema();
  const consulta = useMemo(() => consultaDeAjuste(db, CLAVE_TEMA), [db]);
  const { data } = useLiveQuery(consulta);
  const guardado = data?.[0]?.valor;

  useEffect(() => {
    if (guardado === 'dark' || guardado === 'light') fijar(guardado);
  }, [guardado, fijar]);

  return null;
}

/** Guarda el tema. Es lo unico que lo cambia: ver `TemaGuardado`. */
export function useCambiarTema(): (nombre: ThemeName) => void {
  const { db } = useDatos();
  return (nombre) => escribirAjuste(db, CLAVE_TEMA, nombre);
}

export function useTema(): ValorDelTema {
  const valor = useContext(ContextoDeTema);
  if (valor === null) throw new Error('useTema fuera de ProveedorDeTema');
  return valor;
}
