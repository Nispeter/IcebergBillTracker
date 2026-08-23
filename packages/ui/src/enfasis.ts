/**
 * Partir un texto en trozos normales y en negrita.
 *
 * Los textos de ayuda de la app se escriben con `**asi**`, que es como se
 * escriben en el resto del proyecto. La hoja los pintaba tal cual y los
 * asteriscos salian a la vista: el enfasis estaba escrito y no llegaba.
 *
 * Se arregla aca y no sacando los asteriscos de los tres textos que los tenian,
 * porque el que escriba el cuarto los va a volver a poner. Es lo que ya paso
 * tres veces.
 *
 * Vive en `ui` y devuelve datos, no elementos: este paquete no depende de React
 * a proposito --son tokens, geometria y escalas-- y asi la parte que tiene
 * logica se puede probar en Node. Quien la pinta es `datos/explicacion.tsx`.
 */

export interface Trozo {
  readonly texto: string;
  readonly fuerte: boolean;
}

/**
 * Los trozos de un texto, alternando normal y negrita.
 *
 * Un `**` sin pareja **no se interpreta**: el texto entero vuelve como un solo
 * trozo normal. Adivinar donde termina el enfasis dejaria media ayuda en negrita
 * por un asterisco de mas, que es peor que mostrarlo tal como se escribio.
 */
export function trozosConEnfasis(texto: string): readonly Trozo[] {
  const partes = texto.split('**');

  // Impar significa que todos los `**` tienen pareja: n aperturas y n cierres
  // dejan 2n + 1 pedazos.
  if (partes.length % 2 === 0) return [{ texto, fuerte: false }];

  return partes
    .map((parte, indice) => ({ texto: parte, fuerte: indice % 2 === 1 }))
    // Los vacios aparecen cuando el enfasis abre o cierra pegado a otro: no
    // aportan nada y obligarian a quien pinta a filtrarlos igual.
    .filter((trozo) => trozo.texto !== '');
}
