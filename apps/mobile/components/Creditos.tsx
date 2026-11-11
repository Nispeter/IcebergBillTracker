/**
 * Los créditos, escondidos detrás del pingüino de la torta: seis toques. Es un
 * agradecimiento, y los agradecimientos no se ponen en un menú.
 *
 * Una foto es su `require` en `RETRATOS`. Metro resuelve esas rutas al
 * empaquetar, así que un archivo que no existe rompe la compilación.
 */

import { radii, spacing } from '@iceberg/ui';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useEstilos, type Estilo } from '../datos/estilos';

interface Retrato {
  readonly fuente: number;
  readonly nombre: string;
  readonly titulo: string;
}

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

export function Creditos() {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.todo}>
      <Text style={styles.intro}>Esta app se escribió con dos supervisores encima del teclado.</Text>
      <View style={styles.retratos}>
        {RETRATOS.map((retrato) => (
          <View key={retrato.nombre} style={styles.retrato}>
            <Image source={retrato.fuente} style={styles.foto} resizeMode="cover" accessibilityLabel={retrato.nombre} />
            <Text style={styles.nombre}>{retrato.nombre}</Text>
            <Text style={styles.titulo}>{retrato.titulo}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function crearEstilos({ t, letra }: Estilo) {
  return StyleSheet.create({
    todo: { gap: spacing.md },
    intro: { ...t.cuerpo, lineHeight: letra.px(22) },
    // En fila: uno debajo del otro obligaría a desplazar la hoja para ver al segundo.
    retratos: { flexDirection: 'row', gap: spacing.md },
    retrato: { flex: 1, gap: spacing.xs },
    // Alto fijo y no `aspectRatio`, que dibujaba la foto con su alto natural.
    foto: { width: '100%', height: 150, borderRadius: radii.md },
    nombre: t.seccion,
    titulo: { ...t.etiqueta, lineHeight: letra.px(17) },
  });
}
