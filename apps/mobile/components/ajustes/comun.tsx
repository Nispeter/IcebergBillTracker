/**
 * Lo que comparten las secciones de Ajustes: el encabezado de sección, la fila
 * de etiqueta y control, y el contador de menos y más.
 *
 * Ajustes son secciones seguidas que se ven todas iguales, así que cada una
 * cierra la anterior con una línea; en el resto de la app separa el aire.
 */

import { elevation, holguraDeToque, radii, spacing } from '@iceberg/ui';
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Titulo } from '../Titulo';
import { useEstilo, useEstilos, type Estilo } from '../../datos/estilos';

export function Seccion(
  { titulo, ayuda, primera, children }: {
    titulo: string;
    ayuda?: string;
    primera?: boolean;
    children: ReactNode;
  },
) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.seccion}>
      <Titulo texto={titulo} ayuda={ayuda} separado={!primera} primero={primera} />
      {children}
    </View>
  );
}

/** Una etiqueta a la izquierda y su control a la derecha. */
export function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const styles = useEstilos(crearEstilos);
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

const BOTON = 28;

/** Menos, el valor y más. El valor tiene ancho fijo para que los botones no bailen. */
export function Contador(
  { valor, ancho, onMenos, onMas, puedeMenos, puedeMas, menos, mas }: {
    valor: string;
    ancho: number;
    onMenos: () => void;
    onMas: () => void;
    puedeMenos: boolean;
    puedeMas: boolean;
    /** Lo que hace cada botón, para el lector de pantalla. */
    menos: string;
    mas: string;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useEstilo();
  const boton = (accion: () => void, puede: boolean, etiqueta: string, Icono: typeof Minus) => (
    <Pressable
      onPress={accion}
      disabled={!puede}
      hitSlop={holguraDeToque(BOTON)}
      style={({ pressed }) => [styles.boton, !puede && styles.apagado, pressed && styles.apretado]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !puede }}
      accessibilityLabel={etiqueta}
    >
      <Icono size={14} weight="bold" color={theme.acentoTexto} />
    </Pressable>
  );
  return (
    <View style={styles.contador}>
      {boton(onMenos, puedeMenos, menos, Minus)}
      <Text style={[styles.valor, { minWidth: ancho }]}>{valor}</Text>
      {boton(onMas, puedeMas, mas, Plus)}
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    seccion: { gap: spacing.sm },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      minHeight: 40,
    },
    etiqueta: { ...t.cuerpo, flexShrink: 1 },
    contador: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    boton: {
      width: BOTON,
      height: BOTON,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    apagado: { opacity: 0.4 },
    apretado: { opacity: 0.6 },
    valor: { ...t.cuerpo, fontWeight: t.accion.fontWeight, textAlign: 'center' },
  });
}
