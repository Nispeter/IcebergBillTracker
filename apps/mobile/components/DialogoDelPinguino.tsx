/**
 * El pingüino hablando: el dibujo a la izquierda y sus burbujas a la derecha.
 * Lo comparten la hoja de las `i` y el tutorial, para que el pingüino tenga una
 * sola forma de hablar; la línea de tiempo de cada uno queda en quien lo usa.
 *
 * El pingüino va arriba y no centrado: las burbujas crecen hacia abajo.
 */

import { elevation, radii, spacing, trozosConEnfasis } from '@iceberg/ui';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Aparecer } from './Aparecer';
import { Pinguino } from './Pinguino';
import { useEstilos, type Estilo } from '../datos/estilos';

/** Lado del cuadrado que hace de colita. Girado, asoma su diagonal. */
const COLITA = 12;

/** Las burbujas caen donde el texto ya separa ideas: en el doble salto de línea. */
export function enParrafos(texto: string): string[] {
  return texto.split('\n\n').map((p) => p.trim()).filter((p) => p !== '');
}

export function DialogoDelPinguino(
  { parrafos, hablando, tamano = 44, pie }: {
    /** Uno por burbuja, ya partidos. */
    parrafos: readonly string[];
    /** Si mueve el pico. Lo decide quien lleva la línea de tiempo. */
    hablando?: boolean;
    tamano?: number;
    /** Debajo de la última burbuja: los puntitos, una pista, un botón. */
    pie?: ReactNode;
  },
) {
  const styles = useEstilos(crearEstilos);

  return (
    <View style={styles.dialogo}>
      <Pinguino tamano={tamano} hablando={hablando} />

      <View style={styles.burbujas}>
        {parrafos.map((parrafo, indice) => (
          // La lista solo crece por el final y se rehace entera al cambiar el
          // texto: el índice es una clave estable.
          // eslint-disable-next-line react/no-array-index-key
          <Aparecer key={indice} visible desplazamiento={-6}>
            <View style={styles.burbuja}>
              {/* Solo la primera del turno apunta a quien habla, como en un chat. */}
              {indice > 0 ? null : <View style={styles.colita} />}
              {/* Un solo `Text` con los trozos adentro: anidados siguen siendo el
                  mismo párrafo y el salto de línea cae donde corresponde. */}
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

function crearEstilos({ theme, t, letra }: Estilo) {
  return StyleSheet.create({
    dialogo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    burbujas: { flex: 1, gap: spacing.sm },
    // Hundida y no elevada: quien la contiene ya es una superficie elevada, y
    // una tarjeta clara sobre otra no se despega de nada.
    burbuja: {
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    // Un cuadrado girado: dos lados asoman y forman el triángulo, los otros dos
    // los tapa la burbuja. A la altura del pico, que es de donde sale la voz.
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
    texto: { ...t.cuerpo, lineHeight: letra.px(22) },
    // Solo el peso: con color el énfasis parecería un enlace.
    fuerte: { fontWeight: t.seccion.fontWeight },
  });
}
