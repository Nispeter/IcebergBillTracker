/**
 * Conexion a la base local y arranque de la app.
 *
 * Hace cuatro cosas antes de dejar entrar a las pantallas:
 *
 * 1. Abre la base **de forma asincronica**.
 * 2. Corre las migraciones pendientes.
 * 3. Resuelve la identidad de este dispositivo, creandola la primera vez.
 * 4. Si la base esta vacia, la llena con datos de prueba, para que la app no
 *    abra en una pantalla en blanco que no dice nada.
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
  CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO, CLAVE_SEMILLA_CARGADA,
  contarMovimientos, crearContexto, crearCuenta, crearMovimiento, escribirAjuste, leerOCrear,
  type BaseDeDatos as Base, type Contexto,
} from '@iceberg/db';
import migraciones from '@iceberg/db/migraciones';
import { generateSeed } from '@iceberg/seed';
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
    (async () => {
      try {
        // `enableChangeListener` es lo que hace reactivo a `useLiveQuery`.
        const sqlite = await openDatabaseAsync(NOMBRE_ARCHIVO, { enableChangeListener: true });
        if (!vigente) return;
        setConexion({ sqlite, drizzleDb: drizzle(sqlite) });
      } catch (e) {
        if (vigente) setFallo(`No se pudo abrir la base: ${(e as Error).message}`);
      }
    })();
    return () => { vigente = false; };
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

      if (contarMovimientos(db, contexto) === 0) {
        cargarSemilla(db, contexto);
        escribirAjuste(db, CLAVE_SEMILLA_CARGADA, 'si');
      }

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
 * Vuelca el dataset de prueba a la base la primera vez.
 *
 * Entra por los mismos repositorios que usa la app, no por SQL crudo: asi los
 * datos de prueba pasan por las mismas validaciones que un movimiento escrito a
 * mano, y si alguna estuviera mal, se nota aca y no en produccion.
 */
function cargarSemilla(db: Base, contexto: Contexto): void {
  const dataset = generateSeed();

  const cuenta = crearCuenta(db, contexto, {
    nombre: 'Cuenta corriente',
    tipo: 'corriente',
    saldoInicialMinor: dataset.saldoInicialMinor,
  });

  for (const tx of dataset.transactions) {
    crearMovimiento(db, contexto, {
      cuentaId: cuenta.id,
      tipo: tx.type,
      montoMinor: tx.amountMinor,
      ocurridoEn: tx.occurredAt as dates.PlainDate,
      nombre: tx.name,
      categoriaId: tx.category ?? null,
    });
  }
}
