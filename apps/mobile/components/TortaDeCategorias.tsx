/**
 * La torta del gasto por categoría, con su leyenda debajo a todo el ancho.
 *
 * Cinco categorías llevan color propio y el resto se junta en "Otras": doce
 * porciones no se distinguen. La serie de colores es la de los tokens, en orden.
 *
 * La leyenda muestra solo lo que está en el dibujo y no apaga nada: la casilla
 * vive en la lista completa de la pantalla. Cuando estuvo acá, cada apagada
 * quedaba al final de la leyenda y empujaba el resto de la pantalla hacia abajo.
 */

import { analytics, money } from '@iceberg/core';
import { charts, donutArcPath, sectoresDeTorta, spacing } from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useCallback, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconoDeCategoria } from './iconos';
import { Pinguino } from './Pinguino';
import { Vacio } from './Vacio';
import { useMovimientoReducido } from '../datos/animacion';
import { useCategorias } from '../datos/catalogo';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

interface PorcionDeTorta {
  readonly categoriaId: string;
  readonly total: money.Money;
  readonly participacion: number | null;
}

const LADO = 176;
const RADIO_EXTERIOR = 86;
const RADIO_INTERIOR = 52;
const ANCHO_CARET = 12;
/** Cuánto salta el pingüino del hueco al tocarlo. */
const REBOTE = 12;
/** Cuántas categorías llevan color propio antes de juntar el resto. */
const CON_COLOR = 5;
const OTRAS = '__otras__';

interface Sector {
  readonly id: string;
  readonly etiqueta: string;
  readonly total: money.Money;
  readonly parte: number;
  readonly color: string;
  readonly esOtras: boolean;
}

function etiquetaDe(categoriaId: string, nombreCorto: (id: string | null) => string): string {
  return nombreCorto(categoriaId === analytics.SIN_CATEGORIA ? null : categoriaId);
}

/** Suma lo que recibe: con categorías apagadas, "Otras" se rearma sola. */
function armarSectores(
  porciones: readonly PorcionDeTorta[],
  nombreCorto: (id: string | null) => string,
): Sector[] {
  const total = money.sum(porciones.map((p) => p.total));
  if (total.amountMinor === 0) return [];

  const principales = porciones.slice(0, CON_COLOR);
  const resto = porciones.slice(CON_COLOR);

  const sectores: Sector[] = principales.map((porcion, indice) => ({
    id: porcion.categoriaId,
    etiqueta: etiquetaDe(porcion.categoriaId, nombreCorto),
    total: porcion.total,
    parte: porcion.total.amountMinor / total.amountMinor,
    color: charts[indice % charts.length]!,
    esOtras: false,
  }));

  if (resto.length > 0) {
    const sumaResto = money.sum(resto.map((p) => p.total));
    sectores.push({
      id: OTRAS,
      etiqueta: `Otras ${resto.length}`,
      total: sumaResto,
      parte: sumaResto.amountMinor / total.amountMinor,
      // El color más apagado de la serie: lo que no vale la pena distinguir.
      color: charts[charts.length - 1]!,
      esOtras: true,
    });
  }

  return sectores;
}

export function TortaDeCategorias(
  { porciones, apagadas, onElegir, onTocarPinguino }:
  {
    /**
     * Todas las del período, apagadas incluidas: sin ellas no se distingue un
     * período sin gastos de uno en que se apagaron todas.
     */
    porciones: readonly PorcionDeTorta[];
    apagadas: ReadonlySet<string>;
    /** Si viene, tocar una fila lleva a sus movimientos. */
    onElegir?: (categoriaId: string) => void;
    onTocarPinguino?: () => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const reducido = useMovimientoReducido();
  const rebote = useRef(new Animated.Value(0)).current;
  const brincar = useCallback(() => {
    onTocarPinguino?.();
    if (reducido) return;
    rebote.setValue(0);
    Animated.sequence([
      Animated.timing(rebote, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(rebote, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [onTocarPinguino, rebote, reducido]);

  const categorias = useCategorias();
  const encendidas = porciones.filter((p) => !apagadas.has(p.categoriaId));
  const sectores = armarSectores(encendidas, categorias.nombreCorto);

  if (sectores.length === 0) {
    const apagoTodas = encendidas.length < porciones.length;
    return <Vacio texto={apagoTodas ? 'Apagaste todas las categorías.' : 'Sin gastos en este período.'} />;
  }

  const angulos = sectoresDeTorta(sectores.map((s) => s.total.amountMinor));
  const pinguino = <Pinguino tamano={44} />;

  return (
    <View style={styles.bloque}>
      <View>
        <Svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`}>
          {sectores.map((sector, indice) => {
            const angulo = angulos[indice];
            if (!angulo) return null;
            return (
              <Path
                key={sector.id}
                d={donutArcPath(LADO / 2, LADO / 2, RADIO_INTERIOR, RADIO_EXTERIOR, angulo.desde, angulo.hasta)}
                fill={sector.color}
                // Una línea del color del fondo separa sectores de colores parecidos.
                stroke={theme.fondo}
                strokeWidth={1.5}
              />
            );
          })}
        </Svg>

        {/* En el hueco del anillo. Seis toques abren los créditos. */}
        <Animated.View
          style={[styles.enElHueco, {
            transform: [{ translateY: rebote.interpolate({ inputRange: [0, 1], outputRange: [0, -REBOTE] }) }],
          }]}
          pointerEvents={onTocarPinguino ? 'box-none' : 'none'}
        >
          {onTocarPinguino ? (
            <Pressable onPress={brincar} accessibilityRole="button" accessibilityLabel="El pingüino">
              {pinguino}
            </Pressable>
          ) : pinguino}
        </Animated.View>
      </View>

      <View style={styles.leyenda}>
        {sectores.map((sector) => (
          <FilaDeLeyenda
            key={sector.id}
            id={sector.id}
            etiqueta={sector.etiqueta}
            total={sector.total}
            color={sector.color}
            porcentaje={`${Math.round(sector.parte * 100)}%`}
            esOtras={sector.esOtras}
            onElegir={onElegir}
          />
        ))}
      </View>
    </View>
  );
}

/** Toda la fila lleva a los movimientos; "Otras" no, porque no es una categoría. */
function FilaDeLeyenda(
  { id, etiqueta, total, color, porcentaje, esOtras, onElegir }: {
    id: string;
    etiqueta: string;
    total: money.Money;
    color: string;
    porcentaje: string;
    esOtras: boolean;
    onElegir?: (categoriaId: string) => void;
  },
) {
  const styles = useEstilos(crearEstilos);
  const { theme } = useTema();
  const Icono = esOtras ? null : iconoDeCategoria(id);
  const lleva = onElegir !== undefined && !esOtras;

  return (
    <Pressable
      onPress={lleva ? () => onElegir(id) : undefined}
      disabled={!lleva}
      style={({ pressed }) => [styles.fila, pressed && styles.apretada]}
      accessibilityRole={lleva ? 'button' : undefined}
      accessibilityLabel={lleva ? `Ver movimientos de ${etiqueta}` : undefined}
    >
      <View style={[styles.punto, { backgroundColor: color }]} />
      {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
      <Text style={styles.nombre} numberOfLines={1}>{etiqueta}</Text>
      <Text style={styles.monto}>{money.formatNumber(total)}</Text>
      <Text style={styles.porcentaje}>{porcentaje}</Text>
      {lleva
        ? <CaretRight size={ANCHO_CARET} weight="bold" color={theme.silencio} />
        : <View style={styles.sinCaret} />}
    </Pressable>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    bloque: { alignItems: 'center', gap: spacing.md },
    leyenda: { alignSelf: 'stretch', gap: 2 },
    // Sin subrayado: lo tocable lo dice el `>`, que además se alinea en columna.
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
    apretada: { opacity: 0.6 },
    sinCaret: { width: ANCHO_CARET },
    punto: { width: 8, height: 8, borderRadius: 4 },
    nombre: { ...t.etiqueta, flex: 1, color: theme.tinta },
    monto: { ...t.cifraDeGrafico, color: theme.tinta },
    porcentaje: { ...t.cifraDeGrafico, width: 30, textAlign: 'right' },
    enElHueco: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  });
}
