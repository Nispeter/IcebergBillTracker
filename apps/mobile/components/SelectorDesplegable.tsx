/**
 * Un disparador compacto y, al abrirse, una lista vertical de opciones.
 *
 * Van separados (`ChipDisparador` y `ListaDeOpciones`) porque Movimientos pone
 * varios disparadores en una línea y un solo panel a lo ancho. Para el caso
 * común, un disparador con su lista, está `Desplegable`.
 */

import { elevation, radii, spacing } from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { Check } from 'phosphor-react-native/src/icons/Check';
import type { IconProps } from 'phosphor-react-native';
import { useMemo, type ComponentType, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
// El de gesture-handler y no el de React Native: es un scroll dentro del scroll
// de la pantalla, y en Android el de afuera se queda con el gesto aunque se
// pida `nestedScrollEnabled`.
import { ScrollView } from 'react-native-gesture-handler';
import { ConDesplegable, useAltoDisponible } from './ConDesplegable';
import { iconoDeCategoria } from './iconos';
import { useCategorias } from '../datos/catalogo';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

/** Cuánto de la pantalla puede ocupar una lista abierta: casi todo, sin tapar de dónde salió. */
const FRACCION_DE_PANTALLA = 0.45;

/** La separación entre disparador y panel. Se dibuja y se descuenta del alto: mismo número. */
const AIRE_SOBRE_EL_PANEL = spacing.sm;

export interface OpcionDeSelector<T> {
  readonly valor: T;
  readonly etiqueta: string;
  readonly icono?: ComponentType<IconProps> | null;
  /** Texto chico a la derecha: un conteo, un monto. */
  readonly detalle?: string;
}

export function ChipDisparador({
  etiqueta, icono: Icono, abierto, activo, onPress, accesible,
}: {
  etiqueta: string;
  icono?: ComponentType<IconProps> | null;
  abierto: boolean;
  /** Si hay algo elegido (no es el valor "todos"). */
  activo: boolean;
  onPress: () => void;
  accesible: string;
}) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
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
  opciones, seleccionado, onElegir,
}: {
  opciones: readonly OpcionDeSelector<T>[];
  seleccionado: T;
  onElegir: (valor: T) => void;
}) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();

  // El alto es una fracción de la pantalla, acotada a lo que `ConDesplegable`
  // midió que queda libre. Corta a mitad de fila: media fila asomando es la
  // única señal de que hay más que no se desvanece como el indicador de scroll.
  const sitio = useAltoDisponible();
  const fraccion = Math.round(useWindowDimensions().height * FRACCION_DE_PANTALLA);
  const alto = sitio === null
    ? fraccion
    : Math.max(Math.min(fraccion, sitio - AIRE_SOBRE_EL_PANEL), 0);

  return (
    <ScrollView
      style={[styles.panel, { maxHeight: alto }]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
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

/** Un disparador con su lista. `junto` va en la misma fila, al otro extremo. */
export function Desplegable<T>({
  abierto, onAlternar, etiqueta, icono, activo, accesible, opciones, valor, onElegir, junto,
}: {
  abierto: boolean;
  onAlternar: () => void;
  etiqueta: string;
  icono?: ComponentType<IconProps> | null;
  activo: boolean;
  accesible: string;
  opciones: readonly OpcionDeSelector<T>[];
  valor: T;
  onElegir: (valor: T) => void;
  junto?: ReactNode;
}) {
  const styles = useEstilos(crearEstilos);
  return (
    <ConDesplegable
      abierto={abierto}
      disparador={(
        // En fila aunque haya un solo chip: suelto, se estira a todo el ancho.
        <View style={styles.fila}>
          <ChipDisparador
            etiqueta={etiqueta}
            icono={icono}
            abierto={abierto}
            activo={activo}
            onPress={onAlternar}
            accesible={accesible}
          />
          {junto}
        </View>
      )}
      panel={<ListaDeOpciones opciones={opciones} seleccionado={valor} onElegir={onElegir} />}
    />
  );
}

/**
 * Las categorías vivas como opciones, con su icono. Con `primera`, encabeza la
 * lista una opción nula que se llama así ("Sin categoría", "Todas").
 */
export function useOpcionesDeCategoria(): OpcionDeSelector<string>[];
export function useOpcionesDeCategoria(primera: string): OpcionDeSelector<string | null>[];
export function useOpcionesDeCategoria(primera?: string): OpcionDeSelector<string | null>[] {
  const categorias = useCategorias();
  return useMemo(() => [
    ...(primera === undefined ? [] : [{ valor: null, etiqueta: primera }]),
    ...categorias.todas.map((categoria) => ({
      valor: categoria.id,
      etiqueta: categoria.nombre,
      icono: iconoDeCategoria(categoria.id),
    })),
  ], [categorias, primera]);
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    chipActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    chipAbierto: { borderColor: theme.silencio },
    chipTexto: { ...t.etiqueta, fontWeight: t.accion.fontWeight },
    fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    panel: {
      marginTop: AIRE_SOBRE_EL_PANEL,
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
    opcionTexto: { ...t.cuerpo, flex: 1 },
    opcionTextoActivo: { ...t.cuerpo, flex: 1, fontWeight: t.seccion.fontWeight },
    detalle: { ...t.cifra, color: theme.silencio },
  });
}
