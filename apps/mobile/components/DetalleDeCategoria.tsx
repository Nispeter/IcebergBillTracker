/**
 * Lo que se lee al tocar una categoría en el reparto del gasto.
 *
 * Cuánto se fue ahí en el período, en cuántos movimientos, y las dos cosas que
 * se pueden hacer con eso: ver la lista o cambiarle el nombre.
 *
 * ## Por qué es un componente aparte
 *
 * Porque la hoja que lo contiene **sigue montada mientras se cierra**, y en ese
 * rato la pantalla ya puso la categoría elegida en `null`. Si el contenido
 * viviera en la pantalla habría que escribir una guarda por cada dato que usa;
 * montándolo solo cuando hay una elegida, el id que recibe nunca es nulo y no
 * hay nada que guardar.
 *
 * ## El monto no se recalcula
 *
 * Llega el mismo que pinta la fila. Rehacer la cuenta acá sería la forma más
 * fácil de que el detalle diga una cosa y la fila otra. Es la misma regla que
 * sigue la hoja de "de dónde sale este número" del Resumen.
 *
 * ## Los movimientos se cuentan de los que ya están cargados
 *
 * Y no con una consulta nueva. La pantalla ya tiene todos los del período en
 * memoria --su análisis cuelga de ahí-- así que contar es recorrer una lista
 * que ya existe. Una consulta aparte además tendría el problema de que
 * `useLiveQuery` devuelve el resultado anterior hasta que resuelve la nueva: al
 * abrir "Comida" lo primero que se leería es el conteo del período entero.
 */

import { money } from '@iceberg/core';
import { fonts, pesos, spacing, type Letra, type Theme } from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { iconoDeCategoria } from './iconos';
import { useLetra } from '../datos/letra';

export function DetalleDeCategoria(
  { theme, categoriaId, nombre, total, cuantos, periodo, sePuedeEditar, onVer, onEditar }: {
    theme: Theme;
    categoriaId: string;
    nombre: string;
    total: money.Money;
    cuantos: number;
    /** El nombre del período, para que la cifra diga de cuándo es. */
    periodo: string;
    /**
     * Si tiene nombre propio que cambiar.
     *
     * No lo tienen la fila de "sin categoría", que no es una categoría sino su
     * ausencia, ni una propia que el usuario ya borró y que sigue apareciendo
     * solo porque quedan movimientos viejos con su id: renombrar una de esas la
     * devolvería a todos los selectores sin que nada lo anuncie.
     */
    sePuedeEditar: boolean;
    onVer: () => void;
    onEditar: () => void;
  },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  const Icono = iconoDeCategoria(categoriaId);

  return (
    <View style={styles.raiz}>
      <View style={styles.cifra}>
        <Icono size={20} weight="regular" color={theme.silencio} />
        <Text style={styles.monto}>{money.format(total)}</Text>
      </View>
      <Text style={styles.pie}>
        {cuantos} {cuantos === 1 ? 'movimiento' : 'movimientos'} · {periodo}
      </Text>

      {/* Sueltas y sin panel: los datos viven en paneles, las acciones no. */}
      <Pressable
        onPress={onVer}
        style={styles.accion}
        accessibilityRole="button"
        accessibilityLabel={`Ver los movimientos de ${nombre}`}
      >
        <Text style={styles.accionTexto}>Ver movimientos</Text>
        <CaretRight size={12} weight="bold" color={theme.acentoTexto} />
      </Pressable>

      {sePuedeEditar ? (
        <Pressable
          onPress={onEditar}
          style={styles.accion}
          accessibilityRole="button"
          accessibilityLabel={`Editar la categoría ${nombre}`}
        >
          <Text style={styles.accionTexto}>Editar categoría</Text>
          <CaretRight size={12} weight="bold" color={theme.acentoTexto} />
        </Pressable>
      ) : null}
    </View>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    raiz: { gap: spacing.sm },
    cifra: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    monto: {
      fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xl, color: theme.tinta,
    },
    pie: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      color: theme.silencio,
      marginBottom: spacing.md,
    },
    accion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    accionTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.acentoTexto,
    },
  });
}
