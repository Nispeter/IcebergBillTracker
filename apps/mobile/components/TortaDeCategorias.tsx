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
 */

import { categories, money } from '@iceberg/core';
import {
  charts, donutArcPath, fontSizes, fonts, pesos, sectoresDeTorta, spacing, type Theme,
} from '@iceberg/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconoDeCategoria } from './iconos';

export interface PorcionDeTorta {
  readonly categoriaId: string;
  readonly total: money.Money;
  readonly participacion: number | null;
}

const LADO = 132;
const RADIO_EXTERIOR = 64;
const RADIO_INTERIOR = 38;

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

function armarSectores(porciones: readonly PorcionDeTorta[]): Sector[] {
  const total = money.sum(porciones.map((p) => p.total));
  if (total.amountMinor === 0) return [];

  const principales = porciones.slice(0, CON_COLOR);
  const resto = porciones.slice(CON_COLOR);

  const sectores: Sector[] = principales.map((porcion, indice) => ({
    id: porcion.categoriaId,
    etiqueta: categories.categoryShortName(porcion.categoriaId),
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
  { porciones, theme, onElegir }:
  {
    porciones: readonly PorcionDeTorta[];
    theme: Theme;
    /** Si viene, cada fila de la leyenda filtra por esa categoria. */
    onElegir?: (categoriaId: string) => void;
  },
) {
  const styles = crearEstilos(theme);
  const sectores = armarSectores(porciones);

  if (sectores.length === 0) {
    return <Text style={styles.vacio}>Sin gastos en este período.</Text>;
  }

  const angulos = sectoresDeTorta(sectores.map((s) => s.total.amountMinor));

  return (
    <View style={styles.bloque}>
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

      <View style={styles.leyenda}>
        {sectores.map((sector) => {
          const Icono = sector.esOtras ? null : iconoDeCategoria(sector.id);
          const contenido = (
            <>
              <View style={[styles.punto, { backgroundColor: sector.color }]} />
              {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
              <Text style={styles.nombre} numberOfLines={1}>{sector.etiqueta}</Text>
              <Text style={styles.monto}>{money.formatNumber(sector.total)}</Text>
              <Text style={styles.porcentaje}>{Math.round(sector.parte * 100)}%</Text>
            </>
          );

          return onElegir && !sector.esOtras ? (
            <Pressable
              key={sector.id}
              onPress={() => onElegir(sector.id)}
              style={styles.filaTocable}
              accessibilityRole="button"
              accessibilityLabel={`Ver movimientos de ${sector.etiqueta}`}
            >
              {contenido}
            </Pressable>
          ) : (
            <View key={sector.id} style={styles.fila}>{contenido}</View>
          );
        })}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    bloque: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    leyenda: { flex: 1, gap: 2 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 3 },
    // Las filas que llevan a algun lado se subrayan: sin eso no hay como saber
    // que se pueden tocar.
    filaTocable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 3,
      borderBottomWidth: 1,
      borderBottomColor: theme.hairline,
    },
    punto: { width: 8, height: 8, borderRadius: 4 },
    nombre: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    monto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.tinta },
    porcentaje: { width: 30, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
  });
}
