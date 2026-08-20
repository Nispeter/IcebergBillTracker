/**
 * Categorias: en que se me va la plata en este periodo.
 *
 * La torta arriba para la proporcion, las barras abajo para comparar montos.
 * Las dos cosas responden preguntas distintas: la torta dice "que parte del
 * total", las barras dicen "cuanto mas que la siguiente".
 */

import { categories, dates, money } from '@iceberg/core';
import {
  AIRE_PARA_EL_FLOTANTE, elevation, fontSizes, fonts, niceUnit, notchesFor, pesos, spacing, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarraSegmentada } from '../../components/BarraSegmentada';
import { Ayuda } from '../../components/Ayuda';
import { Pantalla } from '../../components/Pantalla';
import { useDesplazamiento } from '../../datos/desplazamiento';
import { QueCambio } from '../../components/QueCambio';
import { TortaDeCategorias } from '../../components/TortaDeCategorias';
import { iconoDeCategoria } from '../../components/iconos';
import { useAnalisisDeRango } from '../../datos/consultas';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

export default function Categorias() {
  const { theme } = useTema();
  const desplazamiento = useDesplazamiento();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { tipo, rango, corte } = usePeriodo();
  const router = useRouter();

  const a = useAnalisisDeRango(rango, corte);
  // `nombreDePeriodo` viene con mayuscula porque normalmente es un titulo; aca
  // va detras de "vs." y en medio de una frase.
  const referencia = useMemo(() => {
    const nombre = nombreDePeriodo(tipo, dates.previousPeriod(rango));
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  }, [tipo, rango]);
  const unidad = niceUnit(a.mayorCategoria);
  const muescas = notchesFor(a.mayorCategoria, unidad);

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={styles.contenido} {...desplazamiento}>
        <View style={styles.reglaTorta}>
          <Text style={styles.reglaTitulo}>En qué se fue</Text>
          <View style={styles.reglaLinea} />
          <Ayuda
            theme={theme}
            texto={'Las cinco categorías más grandes llevan color propio; el resto se '
              + 'junta en "Otras" porque doce porciones no se distinguen. Los porcentajes '
              + 'son sobre el gasto del período, no sobre el total del año.'}
          />
        </View>
        <TortaDeCategorias
          porciones={a.porCategoria}
          theme={theme}
          onElegir={(categoriaId) => router.push({
            pathname: '/movimientos',
            params: { categoria: categoriaId },
          })}
        />

        <QueCambio
          deriva={a.deriva}
          referencia={referencia}
          theme={theme}
          onElegir={(categoriaId) => router.push({
            pathname: '/movimientos',
            params: { categoria: categoriaId },
          })}
        />

        {a.porCategoria.length > 0 ? (
          <>
            <View style={styles.regla}>
              <Text style={styles.reglaTitulo}>Todas</Text>
              <View style={styles.reglaLinea} />
              <Ayuda
                theme={theme}
                texto={'Cada barra es una categoría del período, de mayor a menor. Tocar '
                  + 'una lleva al listado filtrado por ella. Las muescas son de un mismo '
                  + 'tamaño, así que dos barras se comparan contándolas.'}
              />
            </View>

            {a.porCategoria.map(({ categoriaId, total }) => {
              const Icono = iconoDeCategoria(categoriaId);
              return (
                <Pressable
                  key={categoriaId}
                  onPress={() => router.push({
                    pathname: '/movimientos',
                    params: { categoria: categoriaId },
                  })}
                  style={styles.fila}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver movimientos de ${categories.categoryName(categoriaId)}`}
                >
                  {Icono ? <Icono size={15} weight="regular" color={theme.silencio} /> : null}
                  <Text style={styles.nombre} numberOfLines={1}>
                    {categories.categoryShortName(categoriaId)}
                  </Text>
                  <BarraSegmentada valor={total.amountMinor} unidad={unidad} total={muescas} theme={theme} />
                  <Text style={styles.monto}>{money.formatNumber(total)}</Text>
                  <CaretRight size={12} weight="bold" color={theme.silencio} />
                </Pressable>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </Pantalla>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: AIRE_PARA_EL_FLOTANTE,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    reglaTorta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, zIndex: 20 },
    regla: { zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xs },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    // Sin subrayado: eran diez lineas horizontales seguidas para decir algo que
    // el `>` del final dice sin cortar el ancho de la pantalla.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    nombre: { width: 78, fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    monto: { width: 66, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
  });
}
