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

import { fonts, pesos, radii, spacing, type Letra, type Theme } from '@iceberg/ui';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLetra } from '../datos/letra';

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
  {
    fuente: require('../assets/lei.jpg'),
    nombre: 'Señorita Rei',
    titulo: 'princesa de los dinosaurios y los ñandús',
  },
  {
    fuente: require('../assets/chum.jpg'),
    nombre: 'Don Sombra Chumbe Chimbarongo',
    titulo: 'magnate del carbón',
  },
];

export function Creditos({ theme }: { theme: Theme }) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);

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
      ) : null}
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    todo: { gap: spacing.md },
    intro: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.sm,
      lineHeight: letra.px(22),
      color: theme.tinta,
    },
    // En fila y repartidos: son dos, y uno debajo del otro obligaría a
    // desplazar la hoja para ver al segundo.
    retratos: { flexDirection: 'row', gap: spacing.md },
    retrato: { flex: 1, gap: spacing.xs },
    /**
     * Alto fijo, no proporcion.
     *
     * Con `aspectRatio` la imagen se dibujaba con su alto natural --1600 px-- y
     * la hoja quedaba mas alta que la pantalla: el recorte se comia al gato y
     * dejaba a la vista el cojin y el suelo. Un alto en pixeles no depende de lo
     * que mida el archivo.
     */
    foto: { width: '100%', height: 150, borderRadius: radii.md },
    nombre: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: letra.sm,
      color: theme.tinta,
    },
    titulo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      lineHeight: letra.px(17),
      color: theme.silencio,
    },
  });
}
