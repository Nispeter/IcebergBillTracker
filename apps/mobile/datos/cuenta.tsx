/**
 * Que cuenta se esta mirando. `null` es "todas".
 *
 * Es un alcance global, igual que el periodo: cambiarlo cambia **toda** la app
 * --el saldo, el iceberg, las categorias, el calendario, los tempanos y la
 * lista-- y no solo la pantalla en la que uno esta. El caso que lo motiva es
 * tener un libro compartido y otro personal en el mismo telefono.
 *
 * ## La cuenta por defecto
 *
 * La app abre con la cuenta marcada con estrella en Ajustes, no con "todas".
 * Quien tiene dos libros separados casi siempre quiere ver uno, y el
 * consolidado es la excepcion; arrancar sumandolo todo obliga a elegir en cada
 * arranque.
 *
 * La marca vive en `ajustes`, que **no se sincroniza**: cual mirar primero es
 * preferencia de cada telefono y no tiene por que ser la misma para las dos
 * personas que comparten un libro.
 *
 * Se lee **una sola vez**, al montar. Despues manda lo que el usuario elija en
 * la sesion: si releyera el ajuste, cambiar la estrella movería el alcance por
 * debajo de los pies de quien esta mirando otra cosa.
 *
 * ## Solo guarda el id
 *
 * No consulta las cuentas. Si lo hiciera habria un ciclo: `consultas.ts`
 * necesita saber cual esta activa para filtrar, y este proveedor necesitaria a
 * `consultas.ts` para listarlas. Quien las lista es el selector, que si puede
 * depender de las dos cosas. El ajuste se lee con `leerAjuste`, que es una
 * funcion suelta sobre la base, no un hook de consulta.
 *
 * ## Por que el filtro se inyecta y no se pasa a mano
 *
 * Casi todo el analisis cuelga de `useMovimientos`, y el saldo de
 * `useSaldoInicial`. Poniendo el alcance ahi adentro, las dieciocho consultas de
 * la app quedan filtradas sin que ninguna pantalla tenga que acordarse. Una
 * pantalla que necesite pasar por encima --el detalle de una cuenta puntual--
 * pone su propio `cuentaId` en el filtro y ese gana.
 */

import { CLAVE_CUENTA_POR_DEFECTO, escribirAjuste, leerAjuste } from '@iceberg/db';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDatos } from './BaseDeDatos';

interface ValorDeCuenta {
  /** La cuenta activa, o `null` para ver todas juntas. */
  readonly cuentaId: string | null;
  readonly elegir: (cuentaId: string | null) => void;
  /** La que lleva estrella: con la que abre la app. `null` si es "todas". */
  readonly porDefecto: string | null;
  /** Pone o quita la estrella. Volver a marcar la misma la quita. */
  readonly marcarPorDefecto: (cuentaId: string | null) => void;
}

const Contexto = createContext<ValorDeCuenta>({
  cuentaId: null,
  elegir: () => {},
  porDefecto: null,
  marcarPorDefecto: () => {},
});

export function ProveedorDeCuenta({ children }: { children: ReactNode }) {
  const { db } = useDatos();

  // La lectura va dentro del inicializador: `useState` solo lo corre en el
  // primer render, y si no seria una consulta a la base en cada uno.
  const [cuentaId, elegir] = useState<string | null>(
    () => leerAjuste(db, CLAVE_CUENTA_POR_DEFECTO) || null,
  );
  const [porDefecto, setPorDefecto] = useState<string | null>(
    () => leerAjuste(db, CLAVE_CUENTA_POR_DEFECTO) || null,
  );

  const marcarPorDefecto = useCallback((id: string | null) => {
    // Cadena vacia y no `delete`: el ajuste existe igual, solo que dice "todas".
    escribirAjuste(db, CLAVE_CUENTA_POR_DEFECTO, id ?? '');
    setPorDefecto(id);
  }, [db]);

  const valor = useMemo(
    () => ({ cuentaId, elegir, porDefecto, marcarPorDefecto }),
    [cuentaId, porDefecto, marcarPorDefecto],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCuentaActiva(): ValorDeCuenta {
  return useContext(Contexto);
}
