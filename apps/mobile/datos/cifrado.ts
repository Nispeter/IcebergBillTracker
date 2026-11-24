/**
 * Cómo se comparte con la carpeta, y la frase del modo cifrado. La frase se
 * inventa la primera vez aunque el modo sea planilla: con ella se siguen
 * abriendo los archivos cifrados que deje otro teléfono mientras se cambian de
 * modo.
 */

import { crypto } from '@iceberg/core';
import {
  CLAVE_FRASE_DE_CIFRADO, CLAVE_MODO_DE_COMPARTIR, escribirAjuste, leerModoDeCompartir, leerOCrear,
  type ModoDeCompartir,
} from '@iceberg/db';
import { useEffect } from 'react';
import { useDatos } from './BaseDeDatos';
import { useAjuste } from './consultas';

interface FraseDeCifrado {
  /** La frase en uso. */
  readonly frase: string;
  /** La cambia. Vacía no se acepta: dejaría de cifrar. */
  cambiar(nueva: string): void;
  /** Inventa otra. Los archivos ya escritos con la anterior dejan de abrirse. */
  renovar(): string;
}

export function useFraseDeCifrado(): FraseDeCifrado {
  const { db } = useDatos();
  const guardada = useAjuste(CLAVE_FRASE_DE_CIFRADO) ?? '';

  // En un efecto: crearla escribe en la base, y escribir mientras React dibuja
  // deja la pantalla en bucle. `leerOCrear` la crea una sola vez aunque dos
  // pantallas la pidan a la vez: dos frases distintas no se abrirían entre sí.
  useEffect(() => {
    if (guardada.trim() === '') leerOCrear(db, CLAVE_FRASE_DE_CIFRADO, () => crypto.generarFrase());
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

export function useModoDeCompartir(): {
  readonly modo: ModoDeCompartir;
  cambiar(modo: ModoDeCompartir): void;
} {
  const { db } = useDatos();
  const modo = leerModoDeCompartir(useAjuste(CLAVE_MODO_DE_COMPARTIR));
  return { modo, cambiar: (nuevo) => escribirAjuste(db, CLAVE_MODO_DE_COMPARTIR, nuevo) };
}
