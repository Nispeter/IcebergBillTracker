/**
 * Los créditos, escondidos detrás del pingüino.
 *
 * Salen tras tocar seis veces al pingüino del medio. No hay forma de llegar por
 * accidente y no hay nada que se pierda por no encontrarlo: es un agradecimiento,
 * y los agradecimientos no se ponen en un menú.
 *
 * Las fotos van en `RETRATOS`. Si el arreglo está vacío la hoja se muestra igual,
 * solo con los nombres: agregar una foto es agregar su `require`, y quitarla es
 * borrar la línea, sin tocar nada más.
 */

import { fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Retrato {
  readonly fuente: number;
  readonly nombre: string;
  readonly titulo: string;
}

/**
 * Quiénes son y de qué son dueños.
 *
 * `fuente` es lo que devuelve `require`. Metro resuelve esas rutas al empaquetar,
 * así que un archivo que no existe rompe la compilación: por eso se agregan de a
 * una y recién cuando el archivo está.
 */
const RETRATOS: readonly Retrato[] = [
  // { fuente: require('../assets/lei.jpg'), nombre: 'La Reineta', titulo: '…' },
  // { fuente: require('../assets/chum.jpg'), nombre: 'Don Sombra…', titulo: '…' },
];

/** Los nombres, que se muestran haya fotos o no. */
const DUEÑOS = [
  { nombre: 'La Reineta', titulo: 'princesa de los dinosaurios y los ñandús' },
  { nombre: 'Don Sombra Chumbe Chimbarongo', titulo: 'magnate del carbón' },
];

export function Creditos({ theme }: { theme: Theme }) {
  const styles = crearEstilos(theme);

  return (
    <View style={styles.todo}>
      <Text style={styles.intro}>
        Esta app se escribió con dos supervisores encima del teclado.
      </Text>

      {RETRATOS.length > 0 ? (
        <View style={styles.retratos}>
          {RETRATOS.map((retrato) => (
            <View key={retrato.nombre} style={styles.retrato}>
              <Image source={retrato.fuente} style={styles.foto} resizeMode="cover" />
              <Text style={styles.nombre}>{retrato.nombre}</Text>
              <Text style={styles.titulo}>{retrato.titulo}</Text>
            </View>
          ))}
        </View>
      ) : (
        DUEÑOS.map((dueño) => (
          <View key={dueño.nombre} style={styles.sinFoto}>
            <Text style={styles.nombre}>{dueño.nombre}</Text>
            <Text style={styles.titulo}>{dueño.titulo}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    todo: { gap: spacing.md },
    intro: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      lineHeight: 22,
      color: theme.tinta,
    },
    // En fila y repartidos: son dos, y uno debajo del otro obligaría a
    // desplazar la hoja para ver al segundo.
    retratos: { flexDirection: 'row', gap: spacing.md },
    retrato: { flex: 1, gap: spacing.xs },
    sinFoto: { gap: 2 },
    foto: { width: '100%', aspectRatio: 3 / 4, borderRadius: radii.md },
    nombre: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: fontSizes.sm,
      color: theme.tinta,
    },
    titulo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      lineHeight: 17,
      color: theme.silencio,
    },
  });
}
