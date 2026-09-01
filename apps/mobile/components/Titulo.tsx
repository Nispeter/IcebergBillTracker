/**
 * El encabezado de una seccion. Sin regla.
 *
 * Reemplaza al patron `Titulo ───────── ?` que estaba en once secciones y era la
 * firma mas reconocible del panel generado: ningun producto real titula asi. La
 * regla ademas solo marcaba **donde empieza** una seccion, nunca donde termina,
 * asi que con once secciones lo que se veia era una escalera de lineas y no los
 * grupos.
 *
 * Lo que separa ahora es el aire de arriba, que es mas que el de adentro. Es la
 * regla de agrupacion de siempre y no cuesta una sola linea horizontal.
 *
 * ## Cuando si va una linea
 *
 * `separado` dibuja una hairline **arriba de todo el encabezado**, con aire
 * entre la linea y el titulo. Es otra cosa que la regla vieja: aquella cruzaba
 * el renglon del titulo y decoraba; esta cierra el bloque anterior antes de
 * abrir el siguiente.
 *
 * Va donde una seccion es una lista de controles o de filas de datos --Ajustes,
 * que son diez seguidas y todas se ven igual-- y no donde el contenido ya forma
 * bloques por su cuenta: en el Resumen hay un iceberg, un panel y un grafico
 * entre titulo y titulo, y ahi las lineas serian la escalera de siempre.
 *
 * La `i` va pegada al titulo y no al borde derecho: explica **esto**, y a diez
 * centimetros de distancia deja de estar claro que.
 */

import { elevation, fonts, pesos, spacing, type Letra, type Theme } from '@iceberg/ui';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ayuda } from './Ayuda';
import { useLetra } from '../datos/letra';

export function Titulo(
  { texto, ayuda, theme, estilo, derecha, separado }: {
    texto: string;
    /** Si viene, agrega la `i` que abre la hoja con esta explicacion. */
    ayuda?: string;
    theme: Theme;
    estilo?: StyleProp<ViewStyle>;
    /** Algo alineado al otro extremo: un "vs. julio", un contador. */
    derecha?: React.ReactNode;
    /** Cierra el bloque anterior con una hairline. Ver arriba. */
    separado?: boolean;
  },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);

  return (
    <View style={[separado === true && styles.separado, estilo]}>
      <View style={styles.fila}>
        <Text style={styles.texto}>{texto}</Text>
        {ayuda === undefined ? null : <Ayuda titulo={texto} texto={ayuda} theme={theme} />}
        {derecha === undefined ? null : <View style={styles.derecha}>{derecha}</View>}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xxl,
      marginBottom: spacing.sm,
    },
    /**
     * La linea que cierra el bloque anterior.
     *
     * Va como borde de arriba del contenedor y no como una vista aparte: asi el
     * `marginTop` de la fila queda **entre la linea y el titulo**, que es lo que
     * hace que la linea se lea pegada a lo de arriba --lo que termina-- y no
     * flotando en el medio de dos secciones sin pertenecer a ninguna.
     */
    separado: {
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
      marginTop: spacing.xl,
    },
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: letra.sm,
      color: theme.tinta,
    },
    derecha: { flex: 1, alignItems: 'flex-end' },
  });
}
