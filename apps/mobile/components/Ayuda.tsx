/**
 * Una `i` chica que abre la explicacion en la hoja de siempre.
 *
 * La alternativa era dejar la frase escrita siempre, y eso convierte cada
 * definicion en ruido permanente para quien ya la sabe --que despues de la
 * primera semana es siempre--. Con la `i` la explicacion esta cuando se busca y
 * no ocupa cuando no.
 *
 * ## Por que ya no es un `?` con globo
 *
 * Dos razones, y la primera es un bug que se repitio hasta cansar. El globo iba
 * absoluto y peleaba el apilado con lo que tuviera al lado: `zIndex` en la
 * raiz, en el contenedor, en el padre del padre. Un elemento flotante solo
 * compite dentro de su contexto de apilado y ese contexto lo decide cualquier
 * ancestro, asi que cada pantalla nueva traia otro caso de "se dibuja atras".
 * La hoja no puede tener ese problema: vive una sola vez y arriba de todo.
 *
 * La segunda es que la app ya tenia dos formas de explicar --el globo del `?` y
 * la hoja de la `i` del saldo-- y no habia motivo para dos. Queda la que muestra
 * mejor: cabe texto largo, se lee sin apretar y se cierra deslizando.
 *
 * No es hover: en Android no hay puntero. Es tocar.
 */

import { type Theme } from '@iceberg/ui';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { Pressable } from 'react-native';
import { useExplicar } from '../datos/explicacion';

export function Ayuda(
  { titulo, texto, theme }: {
    /** Encabeza la hoja. Normalmente el titulo de la seccion que la trae. */
    titulo: string;
    texto: string;
    theme: Theme;
  },
) {
  const explicar = useExplicar();

  return (
    <Pressable
      onPress={() => explicar(titulo, texto)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Qué significa: ${titulo}`}
    >
      <Info size={15} weight="regular" color={theme.silencio} />
    </Pressable>
  );
}
