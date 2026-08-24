/**
 * Dia a dia: cuando se me va la plata.
 *
 * La grilla arriba y, debajo, los datos que solo tienen sentido mirando el
 * calendario: que dia de la semana pesa mas y cuanto se aguanta sin gastar.
 */

import { money } from '@iceberg/core';
import {
  charts, elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { analytics } from '@iceberg/core';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendario } from '../../components/Calendario';
import { Ayuda } from '../../components/Ayuda';
import { LineaDeSaldo } from '../../components/LineaDeSaldo';
import { Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior } from '../../datos/desplazamiento';
import { useAnalisisDeRango, useSaldoAlEmpezar } from '../../datos/consultas';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

const NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function DiaADia() {
  const { theme } = useTema();
  const aireInferior = useAireInferior();
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
    <Pantalla titulo="Día a día">
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
      >
        <Titulo
          texto="Gasto por día"
          theme={theme}
          estilo={styles.tituloJunto}
          ayuda={'Cada celda es un día del período y su tono dice cuánto se gastó: '
            + 'mientras más claro, más. Los días sin gasto quedan apagados.\n\n'
            + 'Tocar un día lleva al listado de sus movimientos.'}
        />

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
          ayuda={'La barra y la cifra grande son el **promedio por vez** que cayó ese '
            + 'día en el período. Se promedia porque un mes tiene cuatro o cinco de cada '
            + 'uno, y sumar sin promediar haría ganar siempre al que se repitió más.\n\n'
            + 'Debajo va cuántas veces cayó y cuánto suma en total: son los que dicen si '
            + 'un promedio alto es un hábito o una sola compra grande.\n\n'
            + 'El día marcado es el de mayor promedio.'}
        />

        {/*
          Cada fila dice tres cosas y no una.
          El promedio solo no se puede interpretar: 142.400 un miercoles puede ser
          cinco miercoles parecidos o uno solo con el arriendo. El total y las
          veces son lo que distingue un habito de una casualidad, y el analisis ya
          los calculaba --`gastoPorDiaDeSemana` devuelve `total` y `cantidad`--;
          la pantalla simplemente los tiraba a la basura.
        */}
        {porDiaDeSemana.map((fila) => {
          const parte = fila.promedio.amountMinor / mayorPromedio;
          const esElMayor = fila.promedio.amountMinor === mayorPromedio && mayorPromedio > 1;
          return (
            <View key={fila.dia} style={styles.diaSemana}>
              <View style={styles.filaSemana}>
                <Text style={esElMayor ? styles.nombreDiaMayor : styles.nombreDia}>
                  {NOMBRES[fila.dia - 1]}
                </Text>
                <View style={styles.pista}>
                  <View style={[
                    styles.relleno,
                    esElMayor && styles.rellenoMayor,
                    { flex: Math.max(parte, 0.001) },
                  ]} />
                  <View style={{ flex: Math.max(1 - parte, 0.001) }} />
                </View>
                <Text style={styles.montoDia}>{money.formatNumber(fila.promedio)}</Text>
              </View>
              <Text style={styles.detalleDia}>
                {fila.cantidad === 0
                  ? 'no cayó ninguno en este período'
                  : `${fila.cantidad} ${fila.cantidad === 1 ? 'vez' : 'veces'}`
                    + ` · ${money.format(fila.total)} en total`}
              </Text>
            </View>
          );
        })}

        <Titulo texto="Detalle del período" theme={theme} />
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Día más caro"
            valor={masCaro === null ? '—' : `${money.format(masCaro.gasto)}`} />
          <Dato styles={styles} etiqueta="Racha sin gastar"
            valor={racha === 0 ? 'ninguna' : `${racha} ${racha === 1 ? 'día' : 'días'}`} />
          <Dato styles={styles} etiqueta="Promedio diario" valor={money.format(a.ritmo.promedioDiario)} />
        </Panel>
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
    /** Encabeza lo que viene justo abajo, sin el aire de una seccion suelta. */
    tituloJunto: { marginTop: spacing.lg, marginBottom: spacing.xs },
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

    // Elevada para que la burbuja de la ayuda tape lo que viene debajo.

    diaSemana: { paddingVertical: 5 },
    filaSemana: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    nombreDia: { width: 72, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    // El dia mas caro se marca: es lo que uno viene a buscar a este grafico.
    nombreDiaMayor: { width: 72, fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    rellenoMayor: { backgroundColor: theme.acento },
    detalleDia: {
      marginLeft: 72 + spacing.sm,
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.silencio,
    },
    pista: { flex: 1, flexDirection: 'row', height: 6 },
    relleno: { backgroundColor: charts[0], borderRadius: radii.sm },
    montoDia: { width: 62, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.xs },

    // Sin subrayado: el panel agrupa, y dos columnas alineadas ya se leen como
    // tabla. La etiqueta va en el gris que se lee sobre el fondo hundido.
    dato: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    datoEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencioHondo },
    datoValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.tinta },
  });
}
