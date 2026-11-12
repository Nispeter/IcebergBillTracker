/**
 * La frase con la que se cifra lo que sale a la carpeta compartida. La app se
 * inventa una la primera vez y desde ahí cifra siempre: vacía significaría
 * escribir el historial financiero en claro.
 */

import { crypto } from '@iceberg/core';
import { CLAVE_FRASE_DE_CIFRADO, escribirAjuste, leerOCrear } from '@iceberg/db';
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
