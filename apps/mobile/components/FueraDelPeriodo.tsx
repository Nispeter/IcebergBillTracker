/**
 * El aviso de que lo que se esta mirando **no es hoy**.
 *
 * Las seis vistas comparten un solo periodo, asi que retroceder un mes en
 * Movimientos deja tambien el Resumen, las Categorias y el Dia a dia en ese mes.
 * Eso es deliberado --cambiar de vista no deberia cambiar de fecha-- pero tiene
 * un costo: uno navega, se va a otra pantalla, vuelve, y lee cifras de julio
 * creyendo que son de este mes. El nombre del periodo lo decia, arriba, en doce
 * puntos y en el mismo gris de siempre.
 *
 * Aca se dice con el unico color calido de la app. El ambar tiene dos trabajos
 * --la accion principal y lo que pide atencion-- y esto es de los segundos: no
 * hay nada roto, pero el numero que se esta leyendo no es el que uno cree.
 *
 * ## Dos piezas y no una
 *
 * El `!` **explica** y el circulo **arregla**, y estan separados porque quien ya
 * entendio el aviso --que es cualquiera despues de la primera vez-- solo quiere
 * el segundo. Si el circulo tambien abriera la hoja, volver a hoy costaria dos
 * toques para siempre. La hoja igual lleva su propio boton para volver, porque
 * quien la abrio para entender ya tiene ahi lo que necesita.
 *
 * No se dibuja nada cuando se esta en el periodo actual, que es casi todo el
 * tiempo: un aviso permanente deja de leerse en una semana.
 */

import { radii, spacing, type Theme } from '@iceberg/ui';
import { CalendarCheck } from 'phosphor-react-native/src/icons/CalendarCheck';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { Pressable, StyleSheet, View } from 'react-native';
import { useExplicar } from '../datos/explicacion';
import { nombreDePeriodo, usePeriodo } from '../datos/periodo';

export function FueraDelPeriodo({ theme }: { theme: Theme }) {
  const periodo = usePeriodo();
  const explicar = useExplicar();
  const styles = crearEstilos(theme);

  if (periodo.esElActual) return null;

  const mirando = nombreDePeriodo(periodo.tipo, periodo.rango);

  return (
    <View style={styles.fila}>
      <Pressable
        onPress={() => explicar(
          'No estás en el período actual',
          `Estás mirando **${mirando}**, y todas las vistas lo comparten: el resumen, `
          + 'las categorías, el día a día y los movimientos son de ese período, no de hoy.\n\n'
          + 'Se queda donde lo dejaste a propósito, para que cambiar de vista no te '
          + 'cambie la fecha. El botón de al lado te devuelve a hoy cuando quieras.',
          { etiqueta: 'Volver a hoy', alTocar: periodo.alDia },
        )}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Estás mirando ${mirando}, que no es el período actual. Tocar para saber más`}
      >
        <Warning size={15} weight="fill" color={theme.alerta} />
      </Pressable>

      <Pressable
        onPress={periodo.alDia}
        style={styles.circulo}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Volver al período de hoy"
      >
        <CalendarCheck size={13} weight="bold" color={theme.alerta} />
      </Pressable>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    /**
     * Contorno y no relleno.
     *
     * Relleno de ambar seria el mismo tratamiento que el mas de la barra de
     * abajo, que es **la** accion de la app; esto es una salida de emergencia
     * chica. El contorno lo deja legible sin ponerlo al mismo nivel.
     */
    circulo: {
      width: 22,
      height: 22,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.alerta,
    },
  });
}
