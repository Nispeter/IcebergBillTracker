/**
 * Torta de categorias, en SVG.
 *
 * **Un solo color con opacidad decreciente**, no doce colores distintos. Con
 * doce categorias, una paleta categorica seria el arcoiris que el sistema de
 * diseno prohibe, y ademas nadie recuerda que color es cual: hay que ir a la
 * leyenda igual. Con una rampa ordenada, el sector mas oscuro es el mas grande y
 * eso se lee sin leyenda.
 *
 * La geometria del arco vive en `@iceberg/ui/geometry`, con tests: el flag de
 * arco grande y el sentido del borde interior son dos errores clasicos que solo
 * se ven cuando la torta ya salio mal.
 */

import { categories, money } from '@iceberg/core';
import {
  charts, donutArcPath, fontSizes, fonts, pesos, sectoresDeTorta, spacing, type Theme,
} from '@iceberg/ui';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconoDeCategoria } from './iconos';

export interface PorcionDeTorta {
  readonly categoriaId: string;
  readonly total: money.Money;
  readonly participacion: number | null;
}

const LADO = 120;
const RADIO_EXTERIOR = 58;
const RADIO_INTERIOR = 34;

/** De la mas grande a la mas chica: 1 a 0,3. */
function opacidadDe(indice: number, total: number): number {
  if (total <= 1) return 1;
  return 1 - ((indice / (total - 1)) * 0.7);
}

export function TortaDeCategorias(
  { porciones, theme }: { porciones: readonly PorcionDeTorta[]; theme: Theme },
) {
  const styles = crearEstilos(theme);
  const sectores = sectoresDeTorta(porciones.map((p) => p.total.amountMinor));
  const total = money.sum(porciones.map((p) => p.total));

  if (porciones.length === 0) {
    return <Text style={styles.vacio}>Sin gastos en este período.</Text>;
  }

  return (
    <View style={styles.bloque}>
      <Svg width={LADO} height={LADO} viewBox={`0 0 ${LADO} ${LADO}`}>
        {porciones.map((porcion, indice) => {
          const sector = sectores[indice];
          if (!sector) return null;
          return (
            <Path
              key={porcion.categoriaId}
              d={donutArcPath(
                LADO / 2, LADO / 2, RADIO_INTERIOR, RADIO_EXTERIOR, sector.desde, sector.hasta,
              )}
              fill={charts[0]}
              fillOpacity={opacidadDe(indice, porciones.length)}
              // La linea del color del fondo separa sectores contiguos con
              // opacidad parecida, que si no se leen como uno solo.
              stroke={theme.fondo}
              strokeWidth={1.5}
            />
          );
        })}
      </Svg>

      <View style={styles.leyenda}>
        {porciones.slice(0, 5).map((porcion, indice) => {
          const Icono = iconoDeCategoria(porcion.categoriaId);
          return (
            <View key={porcion.categoriaId} style={styles.fila}>
              <View
                style={[
                  styles.punto,
                  { backgroundColor: charts[0], opacity: opacidadDe(indice, porciones.length) },
                ]}
              />
              {Icono ? <Icono size={12} weight="regular" color={theme.silencio} /> : null}
              <Text style={styles.nombre} numberOfLines={1}>
                {categories.categoryShortName(porcion.categoriaId)}
              </Text>
              <Text style={styles.porcentaje}>
                {porcion.participacion === null ? '' : `${Math.round(porcion.participacion * 100)}%`}
              </Text>
            </View>
          );
        })}
        {porciones.length > 5 ? (
          <Text style={styles.resto}>
            +{porciones.length - 5} más · {money.format(total)} total
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    bloque: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    leyenda: { flex: 1, gap: 3 },
    fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    punto: { width: 7, height: 7, borderRadius: 4 },
    nombre: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    porcentaje: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    resto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: 2 },
    vacio: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
  });
}
