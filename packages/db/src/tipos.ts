/**
 * El tipo de la base que reciben los repositorios.
 *
 * Es deliberadamente el tipo **base** de Drizzle y no el de un driver concreto:
 * en la app la base es `expo-sqlite` y en los tests es `better-sqlite3`. Los dos
 * son sincronicos y hablan el mismo dialecto, asi que el mismo repositorio corre
 * en Node en milisegundos y en el telefono sin cambiar una linea.
 */

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

export type BaseDeDatos = BaseSQLiteDatabase<'sync', unknown>;
