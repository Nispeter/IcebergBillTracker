/**
 * Torta de categorias, en SVG.
 *
 * **Cinco sectores y "Otras", no doce.** Una torta de doce porciones es
 * ilegible: las de abajo son astillas y no hay paleta fria que las distinga.
 * Con cinco, cada una lleva un color propio de la serie de graficos y se
 * reconoce sin ir a la leyenda.
 *
 * El primer intento fue un solo color con opacidad decreciente. Se veia
 * ordenado pero no se distinguian los sectores contiguos, que es justamente lo
 * unico que una torta tiene que lograr.
 *
 * La geometria del arco vive en `@iceberg/ui/geometry`, con tests: el flag de
 * arco grande y el sentido del borde interior son dos errores clasicos que solo
 * se ven cuando la torta ya salio mal.
 *
 * **La leyenda va abajo y no al costado.** Compartiendo fila, el dibujo se
 * quedaba con los 132px que sobraban y la leyenda con seis filas apretadas.
 * Puestos uno sobre otro, el donut crece a 176 y cada fila de la leyenda tiene
 * la pantalla entera para el nombre, el monto y el porcentaje. Cuesta unos
 * pixeles de alto y los dos dejan de estorbarse.
 *
 * **La leyenda no apaga nada.** Muestra solo lo que esta en el dibujo; la
 * casilla para sacar una categoria del reparto vive en la lista completa de la
 * pantalla. Ver `TortaDeCategorias`.
 */

import { analytics, money } from '@iceberg/core';
import {
  charts, donutArcPath, fonts, pesos, sectoresDeTorta, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useCallback, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconoDeCategoria } from './iconos';
import { Pinguino } from './Pinguino';
import { useCategorias } from '../datos/catalogo';
import { useLetra } from '../datos/letra';

export interface PorcionDeTorta {
  readonly categoriaId: string;
  readonly total: money.Money;
  readonly participacion: number | null;
}

const LADO = 176;
const RADIO_EXTERIOR = 86;
const RADIO_INTERIOR = 52;

/** El ancho que ocupa el `>` de las filas que llevan a algun lado. */
const ANCHO_CARET = 12;

/** Cuanto brinca el pinguino del hueco al tocarlo. */
const REBOTE = 12;

/** Cuantas categorias llevan color propio antes de agruparse en "Otras". */
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

/**
 * Como se llama un sector.
 *
 * `SIN_CATEGORIA` es una clave interna de `analytics`, no un id de categoria,
 * asi que el catalogo la devolveria pelada: la leyenda decia `__sin__`. Se
 * resuelve como la ausencia que es, igual que en la lista de la pantalla.
 */
function etiquetaDe(categoriaId: string, nombreCorto: (id: string | null) => string): string {
  return nombreCorto(categoriaId === analytics.SIN_CATEGORIA ? null : categoriaId);
}

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
      // La niebla azul es el color mas apagado de la serie: sirve justo para
      // "lo que no vale la pena distinguir".
      color: charts[charts.length - 1]!,
      esOtras: true,
    });
  }

  return sectores;
}

export function TortaDeCategorias(
  { porciones, theme, apagadas, onElegir, onTocarPinguino }:
  {
    /**
     * **Todas** las categorias del periodo, apagadas incluidas.
     *
     * El dibujo y la leyenda salen solo de las encendidas, pero hace falta la
     * lista entera para distinguir un periodo sin gastos de uno en que se
     * apagaron todas.
     */
    porciones: readonly PorcionDeTorta[];
    theme: Theme;
    /** Las que el usuario saco del reparto, por id. */
    apagadas: ReadonlySet<string>;
    /** Si viene, cada fila de la leyenda abre esa categoria. */
    onElegir?: (categoriaId: string) => void;
    /** Si viene, el pinguino del hueco brinca al tocarlo y lo avisa. */
    onTocarPinguino?: () => void;
  },
) {
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  /**
   * El brinco del pinguino del hueco.
   *
   * Vive aca y no en `Pinguino` porque el dibujo no sabe nada de gestos: es una
   * figura, y quien decide si responde al toque es quien la pone.
   */
  const rebote = useRef(new Animated.Value(0)).current;
  const brincar = useCallback(() => {
    onTocarPinguino?.();
    rebote.setValue(0);
    Animated.sequence([
      Animated.timing(rebote, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(rebote, { toValue: 0, friction: 4, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [onTocarPinguino, rebote]);

  const categorias = useCategorias();
  const encendidas = porciones.filter((p) => !apagadas.has(p.categoriaId));
  const sectores = armarSectores(encendidas, categorias.nombreCorto);

  if (sectores.length === 0) {
    return (
      <View style={styles.sinGastos}>
        <Pinguino theme={theme} tamano={40} estado="dormido" />
        <Text style={styles.vacio}>
          {encendidas.length < porciones.length
            ? 'Apagaste todas las categorías.'
            : 'Sin gastos en este período.'}
        </Text>
      </View>
    );
  }

  const angulos = sectoresDeTorta(sectores.map((s) => s.total.amountMinor));

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
              // La linea del color del fondo separa sectores contiguos; sin
              // ella, dos colores parecidos se leen como uno solo.
              stroke={theme.fondo}
              strokeWidth={1.5}
            />
          );
        })}
        </Svg>

        {/* En el hueco del anillo, que si no es un agujero. El radio interior
            son 52 de 176, o sea 104 de diámetro: un pingüino de 44 entra con
            aire de sobra y no toca ningún sector. */}
        <Animated.View
          style={[styles.enElHueco, {
            transform: [{ translateY: rebote.interpolate({ inputRange: [0, 1], outputRange: [0, -REBOTE] }) }],
          }]}
          pointerEvents={onTocarPinguino ? 'box-none' : 'none'}
        >
          {onTocarPinguino ? (
            <Pressable
              onPress={brincar}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="El pingüino"
            >
              <Pinguino theme={theme} tamano={44} />
            </Pressable>
          ) : <Pinguino theme={theme} tamano={44} />}
        </Animated.View>
      </View>

      {/*
        La leyenda: solo lo que esta en el dibujo.

        Hubo una casilla aca tambien, y las apagadas se quedaban al final de la
        leyenda para poder volver a prenderlas. Cada una que se apagaba era una
        fila mas, y todo lo de abajo --la variacion, la lista completa-- se
        corria hacia abajo justo cuando uno iba a buscarlo. La casilla quedo
        solo en la lista completa, que ya tenia una por categoria y ademas
        alcanza a las que aca se juntan en "Otras".
      */}
      <View style={styles.leyenda}>
        {sectores.map((sector) => (
          <FilaDeLeyenda
            key={sector.id}
            theme={theme}
            styles={styles}
            id={sector.id}
            // La que armo `armarSectores`: ya resuelve "sin categoria" y el
            // "Otras N". Recalcularla aca traia de vuelta el `__sin__` pelado.
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

/**
 * Una fila de la leyenda: punto de color, nombre, monto y parte.
 *
 * La fila entera lleva a los movimientos de la categoria, no solo el `>`: sin
 * la casilla al lado ya no hay otro gesto con el que pelearse el toque. "Otras"
 * no lleva a ningun lado porque no es una categoria.
 */
function FilaDeLeyenda(
  { theme, styles, id, etiqueta, total, color, porcentaje, esOtras, onElegir }: {
    theme: Theme;
    styles: ReturnType<typeof crearEstilos>;
    id: string;
    etiqueta: string;
    total: money.Money;
    color: string;
    porcentaje: string;
    esOtras: boolean;
    onElegir?: (categoriaId: string) => void;
  },
) {
  const Icono = esOtras ? null : iconoDeCategoria(id);
  const tocable = onElegir && !esOtras;

  return (
    <Pressable
      onPress={tocable ? () => onElegir(id) : undefined}
      disabled={!tocable}
      style={styles.fila}
      accessibilityRole={tocable ? 'button' : undefined}
      accessibilityLabel={tocable ? `Ver movimientos de ${etiqueta}` : undefined}
    >
      <View style={[styles.punto, { backgroundColor: color }]} />
      {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
      <Text style={styles.nombre} numberOfLines={1}>{etiqueta}</Text>
      <Text style={styles.monto}>{money.formatNumber(total)}</Text>
      <Text style={styles.porcentaje}>{porcentaje}</Text>
      {tocable
        ? <CaretRight size={ANCHO_CARET} weight="bold" color={theme.silencio} />
        : <View style={styles.sinCaret} />}
    </Pressable>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    bloque: { alignItems: 'center', gap: spacing.md },
    leyenda: { alignSelf: 'stretch', gap: 2 },
    /**
     * Sin subrayado.
     *
     * La primera version subrayaba las filas tocables, y era la unica pista de
     * que se podian tocar. Con seis sectores eso son seis lineas horizontales
     * que no separan nada --las filas ya se distinguen solas-- y que sumadas al
     * resto de la pantalla la volvian un rayado. El `>` del final dice lo mismo
     * con un glifo, y ademas se alinea en columna en vez de cortar el ancho.
     */
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
    sinCaret: { width: ANCHO_CARET },
    punto: { width: 8, height: 8, borderRadius: 4 },
    nombre: { flex: 1, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.tinta },
    porcentaje: { width: 30, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio },
    vacio: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio },
    sinGastos: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    enElHueco: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
