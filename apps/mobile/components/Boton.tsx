/**
 * Los botones de la app. Cuatro variantes y ninguna más:
 *
 * - `principal`: relleno de acento. Una por pantalla, la acción que la cierra.
 * - `secundario`: contorno. Acciones que conviven con otras.
 * - `peligro`: contorno rojo. Lo que no se puede deshacer.
 * - `texto`: sin caja. Enlaces y acciones discretas.
 *
 * Con `confirmar`, el primer toque cambia la etiqueta por esa pregunta y recién
 * el segundo ejecuta: es la confirmación de lo destructivo, sin diálogo.
 *
 * Con `href`, el botón navega. Dentro de `Link asChild` el estilo del hijo tiene
 * que ser un objeto plano (una función o un arreglo lo rompen), así que la
 * respuesta al toque se lleva con estado y el estilo va aplanado.
 */

import { elevation, holguraDeToque, radii, spacing, TOQUE_MINIMO } from '@iceberg/ui';
import { Link, type Href } from 'expo-router';
import type { IconProps } from 'phosphor-react-native';
import { useState, type ComponentType } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle,
} from 'react-native';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

type Variante = 'principal' | 'secundario' | 'peligro' | 'texto';

/** Lo que mide un botón con caja. El `hitSlop` completa el resto hasta 48. */
const ALTO = 40;

export function Boton({
  etiqueta, onPress, variante = 'secundario', deshabilitado, cargando, confirmar, href, accesible, estilo,
}: {
  etiqueta: string;
  onPress?: () => void;
  variante?: Variante;
  deshabilitado?: boolean;
  /** Mientras dura, el botón no se puede tocar y muestra que está trabajando. */
  cargando?: boolean;
  /** La pregunta del segundo toque. Ver arriba. */
  confirmar?: string;
  href?: Href;
  /** Lo que lee el lector de pantalla, si la etiqueta sola no alcanza. */
  accesible?: string;
  estilo?: StyleProp<ViewStyle>;
}) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const [apretado, setApretado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const apagado = deshabilitado || cargando;

  const alTocar = () => {
    if (confirmar !== undefined && !confirmando) {
      setConfirmando(true);
      return;
    }
    setConfirmando(false);
    onPress?.();
  };

  const boton = (
    <Pressable
      onPress={href === undefined ? alTocar : undefined}
      onPressIn={() => setApretado(true)}
      onPressOut={() => setApretado(false)}
      disabled={apagado}
      hitSlop={variante === 'principal' ? 0 : holguraDeToque(ALTO)}
      style={StyleSheet.flatten([
        styles[variante],
        confirmando && styles.confirmando,
        apretado && styles.apretado,
        deshabilitado && styles.apagado,
        estilo,
      ])}
      accessibilityRole="button"
      accessibilityState={{ disabled: apagado, busy: cargando }}
      accessibilityLabel={confirmando ? confirmar : accesible ?? etiqueta}
    >
      {cargando ? (
        <ActivityIndicator
          color={variante === 'principal' ? theme.sobreAcento : theme.acentoTexto}
        />
      ) : (
        <Text style={[styles[`${variante}Texto`], confirmando && styles.confirmandoTexto]}>
          {confirmando ? confirmar : etiqueta}
        </Text>
      )}
    </Pressable>
  );

  return href === undefined ? boton : <Link href={href} asChild>{boton}</Link>;
}

/** Un icono que se toca. El área táctil llega a 48 aunque el dibujo mida 14. */
export function BotonDeIcono({
  icono: Icono, tamano = 16, color, peso = 'regular', onPress, accesible, estilo, seleccionado,
}: {
  icono: ComponentType<IconProps>;
  tamano?: number;
  /** Por omisión, el gris de lo secundario. */
  color?: string;
  peso?: IconProps['weight'];
  onPress: () => void;
  accesible: string;
  estilo?: StyleProp<ViewStyle>;
  seleccionado?: boolean;
}) {
  const { theme } = useTema();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={holguraDeToque(tamano)}
      style={({ pressed }) => [estilo, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={accesible}
      accessibilityState={seleccionado === undefined ? undefined : { selected: seleccionado }}
    >
      <Icono size={tamano} weight={peso} color={color ?? theme.silencio} />
    </Pressable>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const caja = {
    minHeight: ALTO,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return StyleSheet.create({
    principal: { ...caja, minHeight: TOQUE_MINIMO, backgroundColor: theme.acento },
    principalTexto: t.boton,
    secundario: {
      ...caja,
      alignSelf: 'flex-start',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    secundarioTexto: { ...t.accion, fontSize: t.cuerpo.fontSize },
    peligro: {
      ...caja,
      alignSelf: 'flex-start',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.vencido,
    },
    peligroTexto: { ...t.error, fontSize: t.cuerpo.fontSize },
    texto: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    textoTexto: t.accion,
    confirmando: { borderColor: theme.vencido },
    confirmandoTexto: { ...t.error, fontSize: t.cuerpo.fontSize, fontWeight: t.seccion.fontWeight },
    apretado: { opacity: 0.7 },
    apagado: { opacity: 0.4 },
  });
}
