/**
 * La invitación para juntar dos teléfonos: el código del hogar y la palabra de
 * cifrado en un solo texto. Antes eran dos cosas que había que enviar y pegar
 * en dos campos distintos, y bastaba olvidar una para que los archivos de la
 * carpeta no se abrieran.
 *
 * Se envía dentro de un mensaje con instrucciones, y quien la recibe puede
 * pegar el mensaje entero: `leerInvitacion` la busca adentro.
 */

const PREFIJO = 'iceberg:';

/**
 * El hogar no lleva `:` ni espacios, así que el primer `:` después de él separa
 * la palabra, que sí puede llevarlos: es lo que la persona haya escrito. La
 * palabra llega hasta el fin de la línea.
 */
const PATRON = /iceberg:([^:\s]+):([^\r\n]+)/i;

export interface Invitacion {
  readonly hogar: string;
  readonly frase: string;
}

export function armarInvitacion(invitacion: Invitacion): string {
  return `${PREFIJO}${invitacion.hogar}:${invitacion.frase}`;
}

/** La invitación que haya en el texto, o `null` si no hay ninguna. */
export function leerInvitacion(texto: string): Invitacion | null {
  const encontrada = PATRON.exec(texto);
  if (encontrada === null) return null;
  const frase = encontrada[2]!.trim();
  if (frase === '') return null;
  return { hogar: encontrada[1]!, frase };
}
