/**
 * El aviso de que lo que se mira no es hoy. Las seis vistas comparten período,
 * así que uno puede volver al Resumen y leer cifras de julio creyendo que son
 * de este mes.
 *
 * Dos piezas: el `!` explica y el círculo devuelve a hoy, para que quien ya
 * entendió el aviso vuelva de un toque. No dibuja nada en el período actual,
 * que es casi siempre: un aviso permanente deja de leerse.
 */

import { holguraDeToque, radii, spacing } from '@iceberg/ui';
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { Pressable, StyleSheet, View } from 'react-native';
import { BotonDeIcono } from './Boton';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useExplicar } from '../datos/explicacion';
import { nombreDePeriodo, usePeriodo } from '../datos/periodo';
import { useTema } from '../datos/tema';

const CIRCULO = 22;

export function FueraDelPeriodo() {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const periodo = usePeriodo();
  const explicar = useExplicar();

  if (periodo.esElActual) return null;

  const mirando = nombreDePeriodo(periodo.tipo, periodo.rango);

  return (
    <View style={styles.fila}>
      <BotonDeIcono
        icono={Warning}
        tamano={15}
        peso="fill"
        color={theme.alerta}
        onPress={() => explicar(
          'No estás en el período actual',
          `Estás mirando **${mirando}**, y todas las vistas lo comparten: el resumen, `
          + 'las categorías, el día a día y los movimientos son de ese período, no de hoy.\n\n'
          + 'Se queda donde lo dejaste a propósito, para que cambiar de vista no te '
          + 'cambie la fecha. El botón de al lado te devuelve a hoy cuando quieras.',
          { etiqueta: 'Volver a hoy', alTocar: periodo.alDia },
        )}
        accesible={`Estás mirando ${mirando}, que no es el período actual. Tocar para saber más`}
      />
      {/* Contorno y no relleno: relleno ámbar es el más de la barra, la acción
          de la app; esto es una salida chica. */}
      <Pressable
        onPress={periodo.alDia}
        style={styles.circulo}
        hitSlop={holguraDeToque(CIRCULO)}
        accessibilityRole="button"
        accessibilityLabel="Volver al período de hoy"
      >
        <CalendarCheck size={13} weight="bold" color={theme.alerta} />
      </Pressable>
    </View>
  );
}

function crearEstilos({ theme }: Estilo) {
  return StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    circulo: {
      width: CIRCULO,
      height: CIRCULO,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.alerta,
    },
  });
}
