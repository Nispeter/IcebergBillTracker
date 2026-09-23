/**
 * El pinguino hablando: el dibujo a la izquierda y sus burbujas a la derecha.
 *
 * Existe porque hay **dos** lugares donde el pinguino explica algo --la hoja de
 * las `i` y el tutorial de bienvenida-- y dos maneras distintas de dibujar lo
 * mismo es exactamente lo que `datos/explicacion.tsx` cuenta que vino a
 * eliminar. Lo que se comparte es la forma de hablar; la maquinaria no: la hoja
 * dice los parrafos de a uno con una linea de tiempo propia y el tutorial dice
 * uno por paso, y eso se queda en cada llamador.
 *
 * El pinguino va **arriba** y no centrado: las burbujas crecen hacia abajo, y
 * con una explicacion de cuatro parrafos uno centrado terminaria hablando desde
 * el medio de la conversacion.
 */

import {
  elevation, fonts, pesos, radii, spacing, trozosConEnfasis, type Letra, type Theme,
} from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aparecer } from './Aparecer';
import { Pinguino } from './Pinguino';
import { useLetra } from '../datos/letra';

/** Lado del cuadrado que hace de colita. Girado, asoma su diagonal. */
const COLITA = 12;

export function DialogoDelPinguino(
  { theme, parrafos, hablando, tamano = 44, pie }: {
    theme: Theme;
    /** Uno por burbuja. Ya partidos: este componente no interpreta el texto. */
    parrafos: readonly string[];
    /** Si mueve el pico. Lo decide quien lleva la linea de tiempo. */
    hablando?: boolean;
    tamano?: number;
    /** Debajo de la ultima burbuja: los puntitos, una pista, un boton. */
    pie?: ReactNode;
  },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);

  return (
    <View style={styles.dialogo}>
      <Pinguino theme={theme} tamano={tamano} hablando={hablando} />

      <View style={styles.burbujas}>
        {parrafos.map((parrafo, indice) => (
          // El indice como clave es correcto aca: la lista solo crece por el
          // final y se rehace entera cuando cambia el texto.
          // eslint-disable-next-line react/no-array-index-key
          <Aparecer key={indice} visible desplazamiento={-6}>
            <View style={styles.burbuja}>
              {/* La colita solo en la primera: las que siguen son el mismo que
                  sigue hablando, y en un chat solo la primera del turno apunta
                  a quien habla. */}
              {indice > 0 ? null : <View style={styles.colita} />}

              {/*
                Un solo `Text` con los trozos adentro, no uno por trozo:
                anidados heredan el estilo y siguen siendo el mismo parrafo, asi
                que el salto de linea cae donde tiene que caer. Uno por trozo los
                pondria uno debajo del otro.
              */}
              <Text style={styles.texto}>
                {trozosConEnfasis(parrafo).map((trozo, cual) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Text key={cual} style={trozo.fuerte ? styles.fuerte : undefined}>
                    {trozo.texto}
                  </Text>
                ))}
              </Text>
            </View>
          </Aparecer>
        ))}

        {pie}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    // Arriba y no al medio: ver la cabecera.
    dialogo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    // La columna de la derecha: las burbujas, una debajo de otra.
    burbujas: { flex: 1, gap: spacing.sm },
    /**
     * La burbuja.
     *
     * Se hunde en vez de levantarse --`superficieHonda`-- porque quien la
     * contiene ya es una superficie elevada: una tarjeta clara encima de otra
     * clara no se despega de nada. Hundida se lee como un hueco dentro de la
     * tarjeta, que es como se ven las burbujas de chat de todo el mundo.
     */
    burbuja: {
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    /**
     * La colita, apuntando al pico.
     *
     * Un cuadrado girado 45 grados: dos de sus lados quedan afuera y forman el
     * triangulo, y los otros dos quedan tapados por la burbuja, que se dibuja
     * despues. Por eso se corre media diagonal hacia adentro --si asomara
     * entero, se le verian las cuatro lineas del borde--.
     *
     * A la altura del pico y no del centro: sale de donde esta la boca.
     */
    colita: {
      position: 'absolute',
      left: -(COLITA / 2) - 1,
      top: 16,
      width: COLITA,
      height: COLITA,
      transform: [{ rotate: '45deg' }],
      backgroundColor: theme.superficieHonda,
      borderLeftWidth: elevation.hairlineWidth,
      borderBottomWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.sm,
      lineHeight: letra.px(22),
      color: theme.tinta,
    },
    // Solo el peso: cambiar ademas el color haria que el enfasis pareciera un
    // enlace, y en una explicacion no hay a donde ir.
    fuerte: { fontWeight: pesos.semibold },
  });
}
