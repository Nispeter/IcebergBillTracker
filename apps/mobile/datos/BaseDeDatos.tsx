/**
 * Conexion a la base local y arranque de la app.
 *
 * Hace cuatro cosas antes de dejar entrar a las pantallas:
 *
 * 1. Abre la base **de forma asincronica**.
 * 2. Corre las migraciones pendientes.
 * 3. Resuelve la identidad de este dispositivo, creandola la primera vez.
 * 4. Se asegura de que exista **una cuenta**, porque sin cuenta no se puede
 *    escribir ni un movimiento.
 *
 * Lo que ya **no** hace es sembrar datos de prueba. Estaba bien mientras esto
 * era una demo, y deja de estarlo apenas alguien quiere usarla con su plata:
 * dieciocho meses de gasto chileno inventado mezclado con lo propio no se
 * arregla sino borrando todo. Los datos de prueba se cargan desde Ajustes,
 * cuando se piden.
 *
 * **Por que asincronica y no `openDatabaseSync` a nivel de modulo**: en web la
 * base vive en un Web Worker y las llamadas sincronicas bloquean el hilo
 * principal esperando su respuesta. Si se abre antes de que el worker termine de
 * cargar, el hilo principal se bloquea justo cuando el worker todavia necesita
 * que ese hilo avance para inicializarse: se traban mutuamente y revienta con
 * "Sync operation timeout". Abriendola async, el worker queda listo antes de la
 * primera operacion sincronica.
 *
 * Todo lo que hace falta rio abajo —la base y el contexto de escritura— sale de
 * `useDatos()`. Las pantallas nunca abren la base por su cuenta.
 */

import type { dates } from '@iceberg/core';
import {
  CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO,
  crearContexto, crearCuenta, leerOCrear, listarCuentas,
  type BaseDeDatos as Base, type Contexto,
} from '@iceberg/db';
import migraciones from '@iceberg/db/migraciones';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ulid } from 'ulid';

const NOMBRE_ARCHIVO = 'iceberg.db';

export interface Datos {
  readonly db: Base;
  readonly contexto: Contexto;
  readonly sqlite: SQLiteDatabase;
}

const ContextoDeDatos = createContext<Datos | null>(null);

export function useDatos(): Datos {
  const datos = useContext(ContextoDeDatos);
  if (datos === null) throw new Error('useDatos fuera de ProveedorDeDatos');
  return datos;
}

export interface ProveedorDeDatosProps {
  readonly children: ReactNode;
  /** Que mostrar mientras abre, migra y arranca. */
  readonly cargando: ReactNode;
  readonly error: (mensaje: string) => ReactNode;
}

interface Conexion {
  readonly sqlite: SQLiteDatabase;
  readonly drizzleDb: ReturnType<typeof drizzle>;
}

export function ProveedorDeDatos(props: ProveedorDeDatosProps) {
  const [conexion, setConexion] = useState<Conexion | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    let abierta: SQLiteDatabase | null = null;

    /**
     * En web la base vive en OPFS, que admite **un solo** handle de acceso por
     * archivo. Al recargar la pagina, el handle de la sesion anterior puede no
     * haberse soltado todavia y abrir falla con `NoModificationAllowedError`.
     * Se reintenta un par de veces con una pausa corta: el sistema lo libera
     * solo, tarda milisegundos.
     */
    const abrirConReintento = async (): Promise<SQLiteDatabase> => {
      for (let intento = 0; ; intento++) {
        try {
          // `enableChangeListener` es lo que hace reactivo a `useLiveQuery`.
          return await openDatabaseAsync(NOMBRE_ARCHIVO, { enableChangeListener: true });
        } catch (e) {
          const esHandleOcupado = (e as Error).name === 'NoModificationAllowedError'
            || /Access Handle/i.test((e as Error).message);
          if (!esHandleOcupado || intento >= 4) throw e;
          await new Promise((listo) => setTimeout(listo, 120 * (intento + 1)));
        }
      }
    };

    (async () => {
      try {
        const sqlite = await abrirConReintento();
        abierta = sqlite;
        if (!vigente) { sqlite.closeAsync().catch(() => {}); return; }
        setConexion({ sqlite, drizzleDb: drizzle(sqlite) });
      } catch (e) {
        if (vigente) setFallo(`No se pudo abrir la base: ${(e as Error).message}`);
      }
    })();

    // React no desmonta al navegar fuera de la pagina, asi que la limpieza del
    // efecto no alcanza: hay que soltar el handle explicitamente al salir.
    const soltar = () => { abierta?.closeAsync().catch(() => {}); };
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pagehide', soltar);
    }

    return () => {
      vigente = false;
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('pagehide', soltar);
      }
    };
  }, []);

  if (fallo !== null) return props.error(fallo);
  if (conexion === null) return props.cargando;
  return <Arranque conexion={conexion} {...props} />;
}

/**
 * Se separa del proveedor porque `useMigrations` es un hook y necesita la base
 * ya abierta: no se puede llamar condicionalmente.
 */
function Arranque({ conexion, children, cargando, error }: ProveedorDeDatosProps & { conexion: Conexion }) {
  const { success, error: errorMigracion } = useMigrations(conexion.drizzleDb, migraciones);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    try {
      const db = conexion.drizzleDb as unknown as Base;

      // La identidad se crea una sola vez y despues no cambia: el
      // `origin_device_id` de cada fila ya escrita apunta a ella.
      const deviceId = leerOCrear(db, CLAVE_DISPOSITIVO, ulid);
      const householdId = leerOCrear(db, CLAVE_HOGAR, ulid);
      const memberId = leerOCrear(db, CLAVE_MIEMBRO, ulid);

      const contexto = crearContexto({ householdId, deviceId, memberId });

      asegurarCuenta(db, contexto);

      setDatos({ db, contexto, sqlite: conexion.sqlite });
    } catch (e) {
      setFallo((e as Error).message);
    }
  }, [success, conexion]);

  if (errorMigracion) return error(`No se pudo migrar la base: ${errorMigracion.message}`);
  if (fallo !== null) return error(fallo);
  if (!success || datos === null) return cargando;

  return <ContextoDeDatos.Provider value={datos}>{children}</ContextoDeDatos.Provider>;
}

/**
 * Crea la cuenta inicial si no hay ninguna.
 *
 * Sin cuenta no se puede escribir ni un movimiento, asi que una base
 * recien creada sin esto abriria en un estado en el que nada funciona. Arranca
 * en cero: el saldo real lo pone el usuario en Ajustes o lo trae el respaldo.
 */
function asegurarCuenta(db: Base, contexto: Contexto): void {
  if (listarCuentas(db, contexto).length > 0) return;
  crearCuenta(db, contexto, {
    nombre: 'Cuenta corriente',
    tipo: 'corriente',
    saldoInicialMinor: 0,
  });
}
