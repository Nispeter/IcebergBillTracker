/**
 * La `i` que abre la explicación de algo en la hoja compartida. Así la
 * definición está cuando se busca y no ocupa cuando no. Se toca: en Android no
 * hay hover.
 */

import { Info } from 'phosphor-react-native/src/icons/Info';
import { BotonDeIcono } from './Boton';
import { useExplicar } from '../datos/explicacion';

export function Ayuda(
  { titulo, texto }: {
    /** Encabeza la hoja. Normalmente el título de la sección que la trae. */
    titulo: string;
    texto: string;
  },
) {
  const explicar = useExplicar();
  return (
    <BotonDeIcono
      icono={Info}
      tamano={15}
      onPress={() => explicar(titulo, texto)}
      accesible={`Qué significa: ${titulo}`}
    />
  );
}
