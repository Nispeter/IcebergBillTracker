/**
 * La frase con la que se cifra lo que sale a la carpeta compartida.
 *
 * La app se inventa una la primera vez que alguien la pide, y desde ahi el
 * archivo sale cifrado siempre. Antes el campo arrancaba vacio y vacio queria
 * decir "en claro": el respaldo con todo el historial financiero se escribia sin
 * cifrar salvo que a alguien se le ocurriera escribir una frase.
 *
 * `leerOCrear` hace que generarla sea **una sola vez**: si dos pantallas la
 * piden a la vez, las dos ven la misma, que es lo unico que importa --dos frases
 * distintas dejarian archivos que no se abren entre si--.
 */

import { crypto } from '@iceberg/core';
import {
  CLAVE_FRASE_DE_CIFRADO, consultaDeAjuste, escribirAjuste, leerOCrear,
  type BaseDeDatos,
} from '@iceberg/db';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo } from 'react';
import { useDatos } from './BaseDeDatos';

/**
 * La frase, creandola si todavia no hay.
 *
 * Fuera de React a proposito: quien esta por escribir en la carpeta no puede
 * esperar a que un efecto corra. Antes de que el efecto del hook alcance a
 * pasar, `frase` vale la cadena vacia, y cadena vacia significa **sin cifrar**:
 * una sincronizacion en ese instante dejaria el respaldo en claro, que es justo
 * lo que esto vino a impedir.
 */
export function asegurarFrase(db: BaseDeDatos): string {
  return leerOCrear(db, CLAVE_FRASE_DE_CIFRADO, () => crypto.generarFrase());
}

export interface FraseDeCifrado {
  /** La frase en uso. Nunca vacia. */
  readonly frase: string;
  /** La cambia. Vacia o solo espacios no se acepta: dejaria de cifrar. */
  cambiar(nueva: string): void;
  /** Se inventa otra. Ojo: los archivos ya escritos con la anterior no se abren. */
  renovar(): string;
}

export function useFraseDeCifrado(): FraseDeCifrado {
  const { db } = useDatos();
  const consulta = useMemo(() => consultaDeAjuste(db, CLAVE_FRASE_DE_CIFRADO), [db]);
  const { data } = useLiveQuery(consulta);
  const guardada = data?.[0]?.valor ?? '';

  // En un efecto y no durante el render: crearla escribe en la base, y escribir
  // mientras React dibuja es lo que deja una pantalla en bucle.
  useEffect(() => {
    if (guardada.trim() === '') asegurarFrase(db);
  }, [db, guardada]);

  return {
    frase: guardada,
    cambiar: (nueva) => {
      const limpia = nueva.trim();
      if (limpia === '') return;
      escribirAjuste(db, CLAVE_FRASE_DE_CIFRADO, limpia);
    },
    renovar: () => {
      const nueva = crypto.generarFrase();
      escribirAjuste(db, CLAVE_FRASE_DE_CIFRADO, nueva);
      return nueva;
    },
  };
}
