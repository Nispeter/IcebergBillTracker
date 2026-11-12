/**
 * La base local y el arranque: abrir, migrar, resolver la identidad de este
 * teléfono (creándola la primera vez) y asegurar que haya una cuenta y la fila
 * de miembro. Las pantallas reciben la base y el contexto de `useDatos()`.
 *
 * Se abre en asíncrono: en web la base vive en un Web Worker, y abrirla
 * sincrónica antes de que el worker cargue traba los dos hilos ("Sync
 * operation timeout").
 */

import {
  CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO,
  asegurarMiembro, crearContexto, crearCuenta, leerOCrear, listarCuentas,
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
  /**
   * Apunta el contexto a otro hogar, para unirse a uno: el hogar se lee al
   * arrancar y vive en el contexto. Recibe el valor en vez de releerlo porque en
   * web la escritura recién hecha todavía no se ve en el mismo tick.
   */
  readonly cambiarHogar: (hogarNuevo: string) => void;
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
     * En web la base vive en OPFS, que admite un solo acceso por archivo: al
     * recargar, el de la sesión anterior puede no haberse soltado todavía. Se
     * reintenta con pausas cortas; el navegador lo libera solo. Según el
     * momento el error llega como `NoModificationAllowedError` o como
     * "Invalid VFS state".
     */
    const abrirConReintento = async (): Promise<SQLiteDatabase> => {
      for (let intento = 0; ; intento++) {
        try {
          // `enableChangeListener` es lo que hace reactivo a `useLiveQuery`.
          return await openDatabaseAsync(NOMBRE_ARCHIVO, { enableChangeListener: true });
        } catch (e) {
          const esHandleOcupado = (e as Error).name === 'NoModificationAllowedError'
            || /Access Handle|Invalid VFS state/i.test((e as Error).message);
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
      // El miembro se registra aca por lo mismo: sin fila con nombre, un
      // conflicto de sincronizacion diria que gano una version y no quien la
      // escribio.
      asegurarMiembro(db, contexto);

      setDatos({
        db,
        contexto,
        sqlite: conexion.sqlite,
        cambiarHogar: (hogarNuevo) => setDatos((antes) => (antes === null ? antes : {
          ...antes,
          contexto: crearContexto({
            householdId: hogarNuevo,
            deviceId: antes.contexto.deviceId,
            memberId: antes.contexto.memberId,
          }),
        })),
      });
    } catch (e) {
      setFallo((e as Error).message);
    }
  }, [success, conexion]);

  if (errorMigracion) return error(`No se pudo migrar la base: ${errorMigracion.message}`);
  if (fallo !== null) return error(fallo);
  if (!success || datos === null) return cargando;

  // El `key` con el hogar remonta todo al cambiar de hogar: las consultas
  // vivas quedan suscritas a sus dependencias, y agregar el hogar a cada una
  // es un bug esperando a que alguien olvide una.
  return (
    <ContextoDeDatos.Provider key={datos.contexto.householdId} value={datos}>
      {children}
    </ContextoDeDatos.Provider>
  );
}

/** Sin ninguna cuenta no se puede escribir ni un movimiento: la base nueva arranca con una, en cero. */
function asegurarCuenta(db: Base, contexto: Contexto): void {
  if (listarCuentas(db, contexto).length > 0) return;
  crearCuenta(db, contexto, {
    nombre: 'Cuenta corriente',
    tipo: 'corriente',
    saldoInicialMinor: 0,
  });
}
