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
 * La `i` va pegada al titulo y no al borde derecho: explica **esto**, y a diez
 * centimetros de distancia deja de estar claro que.
 */

import { fontSizes, fonts, pesos, spacing, type Theme } from '@iceberg/ui';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ayuda } from './Ayuda';

export function Titulo(
  { texto, ayuda, theme, estilo, derecha }: {
    texto: string;
    /** Si viene, agrega la `i` que abre la hoja con esta explicacion. */
    ayuda?: string;
    theme: Theme;
    estilo?: StyleProp<ViewStyle>;
    /** Algo alineado al otro extremo: un "vs. julio", un contador. */
    derecha?: React.ReactNode;
  },
) {
  const styles = crearEstilos(theme);

  return (
    <View style={[styles.fila, estilo]}>
      <Text style={styles.texto}>{texto}</Text>
      {ayuda === undefined ? null : <Ayuda titulo={texto} texto={ayuda} theme={theme} />}
      {derecha === undefined ? null : <View style={styles.derecha}>{derecha}</View>}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xxl,
      marginBottom: spacing.sm,
    },
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: fontSizes.sm,
      color: theme.tinta,
    },
    derecha: { flex: 1, alignItems: 'flex-end' },
  });
}
