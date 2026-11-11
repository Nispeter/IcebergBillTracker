/**
 * Qué cuenta se está mirando; `null` es "todas". Es un alcance global, como el
 * período: cambiarlo cambia toda la app, no solo la pantalla actual.
 *
 * La app abre con la cuenta de la estrella (o la primera creada): quien lleva
 * dos libros separados casi siempre quiere ver uno. La estrella vive en
 * `ajustes`, que no se sincroniza, porque es preferencia de cada teléfono. Se
 * lee una sola vez al montar: releerla movería el alcance por debajo de quien
 * está mirando otra cosa.
 *
 * Solo guarda el id. Listar las cuentas acá crearía un ciclo con
 * `consultas.ts`, que es quien filtra todo por este alcance.
 */

import type { TipoDeCuenta } from '@iceberg/db';
import { CLAVE_CUENTA_POR_DEFECTO, escribirAjuste, leerAjuste, listarCuentas } from '@iceberg/db';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDatos } from './BaseDeDatos';

/** Cómo se lee cada tipo de cuenta en pantalla. */
export const NOMBRES_DE_TIPO_DE_CUENTA: Record<TipoDeCuenta, string> = {
  corriente: 'Corriente',
  vista: 'Vista',
  ahorro: 'Ahorro',
  credito: 'Crédito',
  efectivo: 'Efectivo',
};

interface ValorDeCuenta {
  /** La cuenta activa, o `null` para ver todas juntas. */
  readonly cuentaId: string | null;
  readonly elegir: (cuentaId: string | null) => void;
  /** La de la estrella: con la que abre la app. `null` si es "todas". */
  readonly porDefecto: string | null;
  /** Pone o quita la estrella. */
  readonly marcarPorDefecto: (cuentaId: string | null) => void;
}

const Contexto = createContext<ValorDeCuenta>({
  cuentaId: null,
  elegir: () => {},
  porDefecto: null,
  marcarPorDefecto: () => {},
});

export function ProveedorDeCuenta({ children }: { children: ReactNode }) {
  const { db, contexto } = useDatos();

  // En los inicializadores de `useState`, que corren una sola vez.
  const [cuentaId, elegir] = useState<string | null>(
    () => leerAjuste(db, CLAVE_CUENTA_POR_DEFECTO) || (listarCuentas(db, contexto)[0]?.id ?? null),
  );
  const [porDefecto, setPorDefecto] = useState<string | null>(
    () => leerAjuste(db, CLAVE_CUENTA_POR_DEFECTO) || null,
  );

  const marcarPorDefecto = useCallback((id: string | null) => {
    // Cadena vacía y no borrar el ajuste: existe igual, y dice "todas".
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
