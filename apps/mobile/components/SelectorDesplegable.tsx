/**
 * Un disparador compacto y, cuando se abre, una lista vertical de opciones.
 *
 * Van separados —`ChipDisparador` y `ListaDeOpciones`— porque el llamador
 * necesita poner **varios disparadores en una linea** y un solo panel debajo,
 * a lo ancho. Metidos en un mismo componente, cada uno abriria su propia grilla
 * y el layout se partiria.
 *
 * La lista reemplaza a la grilla de chips: con doce categorias, una grilla se
 * lee como una nube de etiquetas donde hay que buscar. En columna se recorre de
 * arriba abajo, cada fila tiene su icono, y la elegida se marca.
 */

import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { Check } from 'phosphor-react-native/src/icons/Check';
import type { IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface OpcionDeSelector<T> {
  readonly valor: T;
  readonly etiqueta: string;
  readonly icono?: ComponentType<IconProps> | null;
  /** Texto chico a la derecha: un conteo, un monto. */
  readonly detalle?: string;
}

export function ChipDisparador({
  theme, etiqueta, icono: Icono, abierto, activo, onPress, accesible,
}: {
  theme: Theme;
  etiqueta: string;
  icono?: ComponentType<IconProps> | null;
  abierto: boolean;
  /** Si hay algo elegido (no es el valor "todos"). */
  activo: boolean;
  onPress: () => void;
  accesible: string;
}) {
  const styles = crearEstilos(theme);
  const color = activo ? theme.fondo : theme.tinta;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, activo && styles.chipActivo, abierto && !activo && styles.chipAbierto]}
      accessibilityRole="button"
      accessibilityLabel={accesible}
      accessibilityState={{ expanded: abierto, selected: activo }}
    >
      {Icono ? <Icono size={14} weight="regular" color={color} /> : null}
      <Text style={[styles.chipTexto, { color }]} numberOfLines={1}>{etiqueta}</Text>
      <CaretDown
        size={12}
        weight="bold"
        color={activo ? theme.fondo : theme.silencio}
        style={{ transform: [{ rotate: abierto ? '180deg' : '0deg' }] }}
      />
    </Pressable>
  );
}

export function ListaDeOpciones<T>({
  theme, opciones, seleccionado, onElegir,
}: {
  theme: Theme;
  opciones: readonly OpcionDeSelector<T>[];
  seleccionado: T;
  onElegir: (valor: T) => void;
}) {
  const styles = crearEstilos(theme);

  return (
    // Se limita la altura y se deja desplazar: doce categorias en una pantalla
    // chica empujarian la lista de movimientos fuera de la vista.
    <ScrollView style={styles.panel} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {opciones.map((opcion, indice) => {
        const Icono = opcion.icono;
        const activa = opcion.valor === seleccionado;
        return (
          <Pressable
            key={String(opcion.valor)}
            onPress={() => onElegir(opcion.valor)}
            style={[styles.opcion, indice > 0 && styles.opcionConLinea]}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
          >
            <View style={styles.iconoOpcion}>
              {Icono ? <Icono size={16} weight="regular" color={activa ? theme.tinta : theme.silencio} /> : null}
            </View>
            <Text style={activa ? styles.opcionTextoActivo : styles.opcionTexto} numberOfLines={1}>
              {opcion.etiqueta}
            </Text>
            {opcion.detalle ? <Text style={styles.detalle}>{opcion.detalle}</Text> : null}
            {activa ? <Check size={14} weight="bold" color={theme.acentoTexto} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    chipActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    chipAbierto: { borderColor: theme.silencio },
    chipTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs },

    panel: {
      maxHeight: 260,
      marginTop: spacing.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      backgroundColor: theme.superficie,
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    opcionConLinea: { borderTopWidth: elevation.hairlineWidth, borderTopColor: theme.hairline },
    iconoOpcion: { width: 16, alignItems: 'center' },
    opcionTexto: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    opcionTextoActivo: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    detalle: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
  });
}
