/**
 * Cuanto aire dejarle al final de lo que scrollea.
 *
 * Aca vivia ademas el sistema que escondia el boton de agregar mientras uno
 * bajaba. **Se saco entero**: existia porque el mas flotaba sobre el contenido y
 * tapaba algo flotara donde flotara, y desde que vive en la barra de abajo el
 * contenido reserva su alto y no tapa nada. Ver `components/BarraInferior.tsx`.
 */

import { ALTO_DE_LA_BARRA } from '@iceberg/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Cuanto aire dejarle al final de una lista.
 *
 * El alto de la barra solo no alcanza: **no sabe nada de la barra de gestos**.
 * En un telefono que la tenga, el ultimo elemento queda debajo del sistema
 * porque la app dibuja a pantalla completa; se vio con "Importar cartola"
 * cortado por la barra.
 *
 * Va aca y no en cada pantalla para que sumar el margen del sistema no dependa
 * de acordarse seis veces.
 */
export function useAireInferior(): number {
  return ALTO_DE_LA_BARRA + useSafeAreaInsets().bottom + 12;
}
