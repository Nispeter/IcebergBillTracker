/**
 * Un valor elegido, y la lista de opciones solo cuando se pide.
 *
 * Reemplaza a las grillas de chips siempre visibles. Doce chips ocupan media
 * pantalla para decir una cosa que cabe en una linea, y ademas empujan hacia
 * abajo lo que de verdad importa —los movimientos, el formulario— dejandolo
 * fuera de la primera vista.
 *
 * Lo usan el formulario (categoria del movimiento) y el listado (filtros).
 */

import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export interface OpcionDeSelector<T> {
  readonly valor: T;
  readonly etiqueta: string;
  readonly icono?: ComponentType<IconProps> | null;
}

export interface SelectorDesplegableProps<T> {
  readonly theme: Theme;
  /** Lo que se muestra cuando esta cerrado. */
  readonly resumen: string;
  readonly icono?: ComponentType<IconProps> | null;
  readonly abierto: boolean;
  readonly onAlternar: () => void;
  readonly opciones: readonly OpcionDeSelector<T>[];
  readonly seleccionado: T;
  readonly onElegir: (valor: T) => void;
  /** Etiqueta accesible del control cerrado. */
  readonly accesible: string;
  /** Si el resumen debe verse apagado (nada elegido). */
  readonly vacio?: boolean;
}

export function SelectorDesplegable<T>({
  theme, resumen, icono: Icono, abierto, onAlternar,
  opciones, seleccionado, onElegir, accesible, vacio,
}: SelectorDesplegableProps<T>) {
  const styles = crearEstilos(theme);

  return (
    <View>
      <Pressable
        onPress={onAlternar}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={accesible}
        accessibilityState={{ expanded: abierto }}
      >
        {Icono ? <Icono size={18} weight="regular" color={theme.tinta} /> : null}
        <Text style={vacio ? styles.resumenVacio : styles.resumen}>{resumen}</Text>
        <CaretDown
          size={14}
          weight="bold"
          color={theme.silencio}
          style={{ transform: [{ rotate: abierto ? '180deg' : '0deg' }] }}
        />
      </Pressable>

      {abierto ? (
        <View style={styles.opciones}>
          {opciones.map((opcion) => {
            const IconoOpcion = opcion.icono;
            const activa = opcion.valor === seleccionado;
            return (
              <Pressable
                key={String(opcion.valor)}
                onPress={() => onElegir(opcion.valor)}
                style={[styles.chip, activa && styles.chipActivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
              >
                {IconoOpcion ? (
                  <IconoOpcion size={14} weight="regular" color={activa ? theme.fondo : theme.silencio} />
                ) : null}
                <Text style={activa ? styles.chipTextoActivo : styles.chipTexto}>{opcion.etiqueta}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    control: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.md,
    },
    resumen: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.md, color: theme.tinta },
    resumenVacio: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.md, color: theme.silencio },

    opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    chipActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    chipTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    chipTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.fondo },
  });
}
