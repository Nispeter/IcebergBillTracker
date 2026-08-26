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
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
/**
 * El `ScrollView` de `react-native-gesture-handler`, **no el de React Native**.
 *
 * El panel de opciones es un scroll adentro del scroll de la pantalla, y en
 * Android el de afuera se queda con el gesto: la lista de categorias se veia
 * cortada y no habia forma de bajar. `nestedScrollEnabled` es el remedio que
 * documenta React Native y no alcanzo.
 *
 * El de gesture-handler resuelve el conflicto con el sistema de gestos en vez de
 * con el protocolo de scroll anidado de Android, que es lo que falla. La app ya
 * monta `GestureHandlerRootView` en la raiz, que es lo unico que pedia.
 *
 * En web los dos se comportan igual, asi que el cambio no se nota ahi. **Sin
 * probar en Android**: hace falta un telefono.
 */
import { ScrollView } from 'react-native-gesture-handler';
import { useAltoDisponible } from './ConDesplegable';

/**
 * Cuanto de la pantalla puede ocupar un desplegable abierto.
 *
 * Bastante, porque mientras esta abierto es lo unico que importa; pero no todo,
 * para que se siga viendo de que campo salio.
 */
const FRACCION_DE_PANTALLA = 0.45;

/**
 * Lo que el panel se separa del disparador.
 *
 * Sale como constante porque se usa dos veces y **tienen que ser el mismo
 * numero**: una para dibujar la separacion y otra para descontarla del alto
 * disponible. Cuando no se descontaba, el panel pedia todo el sitio y ademas se
 * corria hacia abajo, asi que se pasaba por el pie justo esta cantidad y el
 * contenedor le recortaba el final de la ultima fila.
 */
const AIRE_SOBRE_EL_PANEL = spacing.sm;

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

  /**
   * El alto sale de la pantalla, no de un numero fijo.
   *
   * Estaba en 260, que en un telefono deja ver **seis** de las trece
   * categorias, y el corte caia justo al terminar una fila: se leia como que la
   * lista se acababa ahi. El indicador de desplazamiento de Android se desvanece
   * solo, asi que tampoco quedaba esa pista.
   *
   * Con una fraccion del alto entran mas y el corte cae **a mitad de fila**, que
   * es la unica senal que no se desvanece: media fila asomando dice que hay mas
   * abajo.
   *
   * **Pero la fraccion sola no alcanzaba.** Es un numero ciego: no sabe donde
   * quedo el disparador, asi que abriendo cerca del pie de la pantalla el panel
   * pedia mas alto del que habia y se salia por abajo, donde no hay como
   * desplazarse. `useAltoDisponible` es lo que el desplegable midio contra la
   * pantalla; entre los dos gana el menor.
   */
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

function crearEstilos(theme: Theme) {
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
    chipTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs },

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
    opcionTexto: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.tinta },
    opcionTextoActivo: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    detalle: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
  });
}
