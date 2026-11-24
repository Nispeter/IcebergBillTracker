/**
 * Juntar dos teléfonos en un hogar, venga la invitación pegada o desde el link.
 */

import {
  CLAVE_FRASE_DE_CIFRADO, CLAVE_MODO_DE_COMPARTIR, armarInvitacion, escribirAjuste, unirseAHogar,
  type Invitacion,
} from '@iceberg/db';
import { avisarTrasRemontar, useAvisar } from './aviso';
import { useDatos } from './BaseDeDatos';

/**
 * La página que abre la app con la invitación. Va en el fragmento (`#`), que el
 * navegador nunca le manda a ningún servidor.
 */
const PAGINA_DE_INVITACION = 'https://nispeter.github.io/IcebergBillTracker/unirse/';

/**
 * El mensaje que se comparte: el link para tocar y, al final, la invitación
 * para pegar a mano si el link no abre la app. Al final porque un campo de una
 * línea se come los saltos, y lo que siga quedaría pegado a la palabra.
 */
export function mensajeDeInvitacion(invitacion: Invitacion): string {
  const texto = armarInvitacion(invitacion);
  return 'Únete a mi hogar en Iceberg tocando este link:\n'
    + `${PAGINA_DE_INVITACION}#i=${encodeURIComponent(texto)}\n\n`
    + 'Si el link no abre la app, pega este mensaje en Ajustes, Sincronizar, '
    + '"Unirme con una invitación".\n\n'
    + texto;
}

/**
 * Une este teléfono al hogar de la invitación y adopta su modo: con palabra es
 * el cifrado, sin palabra la planilla. Revienta si el código no sirve.
 */
export function useUnirse(): (invitacion: Invitacion) => void {
  const { db, contexto, cambiarHogar } = useDatos();
  const avisar = useAvisar();

  return (invitacion) => {
    const filas = unirseAHogar(db, contexto, invitacion.hogar);
    if (invitacion.frase === undefined) {
      escribirAjuste(db, CLAVE_MODO_DE_COMPARTIR, 'planilla');
    } else {
      escribirAjuste(db, CLAVE_FRASE_DE_CIFRADO, invitacion.frase);
      escribirAjuste(db, CLAVE_MODO_DE_COMPARTIR, 'cifrado');
    }
    if (filas === 0) {
      avisar('Listo. Ya estaban en el mismo hogar');
      return;
    }
    // Sin apuntar el contexto al hogar nuevo, las consultas seguirían en el
    // viejo. Eso remonta la app, y con ella el aviso.
    avisarTrasRemontar('Listo. Ahora los dos teléfonos están en el mismo hogar');
    cambiarHogar(invitacion.hogar);
  };
}
