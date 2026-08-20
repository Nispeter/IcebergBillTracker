/**
 * Dia a dia: cuando se me va la plata.
 *
 * La grilla arriba y, debajo, los datos que solo tienen sentido mirando el
 * calendario: que dia de la semana pesa mas y cuanto se aguanta sin gastar.
 */

import { money } from '@iceberg/core';
import {
  AIRE_PARA_EL_FLOTANTE, charts, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { analytics } from '@iceberg/core';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendario } from '../../components/Calendario';
import { Ayuda } from '../../components/Ayuda';
import { LineaDeSaldo } from '../../components/LineaDeSaldo';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useDesplazamiento } from '../../datos/desplazamiento';
import { useAnalisisDeRango, useSaldoAlEmpezar } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

const NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function DiaADia() {
  const { theme } = useTema();
  const desplazamiento = useDesplazamiento();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { rango, corte, tipo } = usePeriodo();
  const router = useRouter();

  const a = useAnalisisDeRango(rango, corte);

  const porDiaDeSemana = useMemo(() => analytics.gastoPorDiaDeSemana(a.serie), [a.serie]);
  const mayorPromedio = Math.max(...porDiaDeSemana.map((d) => d.promedio.amountMinor), 1);
  const racha = analytics.rachaMasLargaSinGasto(a.serie);
  const masCaro = analytics.diaDeMayorGasto(a.serie);

  const saldoAlEmpezar = useSaldoAlEmpezar(rango);
  const serieDeSaldo = useMemo(
    () => analytics.saldoAcumulado(a.serie, saldoAlEmpezar),
    [a.serie, saldoAlEmpezar],
  );

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={styles.contenido} {...desplazamiento}>
        {tipo === 'year' ? (
          <Text style={styles.aviso}>
            El calendario se ve por día, semana o mes. Un año son 365 celdas de tres píxeles.
          </Text>
        ) : (
          <Calendario
            serie={a.serie}
            theme={theme}
            hoy={corte}
            onElegirDia={(fecha) => router.push({ pathname: '/movimientos', params: { dia: fecha } })}
          />
        )}

        <Titulo
          texto="Saldo día a día"
          theme={theme}
          ayuda={'Cuánta plata te quedaba al cerrar cada día. Baja con cada gasto y sube '
            + 'cuando entra un ingreso. El punto ámbar marca el día en que estuviste más abajo.'}
        />
        <LineaDeSaldo serie={serieDeSaldo} theme={theme} />

        <Titulo
          texto="Por día de la semana"
          theme={theme}
          ayuda={'Promedio por vez que cayó ese día dentro del período. Un mes tiene '
            + 'cuatro o cinco de cada uno, así que sumar sin promediar haría ganar '
            + 'siempre al día que se repitió más veces.'}
        />

        {porDiaDeSemana.map((fila) => (
          <View key={fila.dia} style={styles.filaSemana}>
            <Text style={styles.nombreDia}>{NOMBRES[fila.dia - 1]}</Text>
            <View style={styles.pista}>
              <View
                style={[
                  styles.relleno,
                  { flex: Math.max(fila.promedio.amountMinor / mayorPromedio, 0.001) },
                ]}
              />
              <View style={{ flex: Math.max(1 - (fila.promedio.amountMinor / mayorPromedio), 0.001) }} />
            </View>
            <Text style={styles.montoDia}>{money.formatNumber(fila.promedio)}</Text>
          </View>
        ))}

        <Titulo texto="Detalle" theme={theme} />
        <Dato styles={styles} etiqueta="Día más caro"
          valor={masCaro === null ? '—' : `${money.format(masCaro.gasto)}`} />
        <Dato styles={styles} etiqueta="Racha sin gastar"
          valor={racha === 0 ? 'ninguna' : `${racha} ${racha === 1 ? 'día' : 'días'}`} />
        <Dato styles={styles} etiqueta="Promedio diario" valor={money.format(a.ritmo.promedioDiario)} />
      </ScrollView>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Dato({ styles, etiqueta, valor }: { styles: Estilos; etiqueta: string; valor: string }) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={styles.datoValor}>{valor}</Text>
    </View>
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
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    // Elevada para que la burbuja de la ayuda tape lo que viene debajo.

    filaSemana: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
    nombreDia: { width: 72, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    pista: { flex: 1, flexDirection: 'row', height: 6 },
    relleno: { backgroundColor: charts[0], borderRadius: radii.sm },
    montoDia: { width: 62, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.xs },

    dato: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    datoEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    datoValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.tinta },
  });
}
