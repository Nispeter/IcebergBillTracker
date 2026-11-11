/**
 * Día a día: cuándo se me va la plata. La grilla arriba y, debajo, lo que solo
 * tiene sentido mirando el calendario: el saldo de cada día, qué pesa más y
 * cuánto se aguanta sin gastar.
 */

import { analytics, dates, money } from '@iceberg/core';
import { charts, columna, radii, spacing } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { Calendario } from '../../components/Calendario';
import { LineaDeSaldo } from '../../components/LineaDeSaldo';
import { Dato, Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAnalisisDeRango, usePrimerDia, useSaldoAlEmpezar } from '../../datos/consultas';
import { useAireInferior } from '../../datos/desplazamiento';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { useHoy } from '../../datos/hoy';
import { usePeriodo } from '../../datos/periodo';

/**
 * Lo que entra en la grilla se mide por largo y no por tipo de período: un
 * rango libre de seis meses tampoco entra. Más de unas nueve semanas y el monto
 * no cabe en la celda.
 */
const DIAS_QUE_CABEN = 70;

export default function DiaADia() {
  const styles = useEstilos(crearEstilos);
  const aireInferior = useAireInferior();
  const { rango, corte } = usePeriodo();
  const router = useRouter();
  const hoy = useHoy();
  const primerDia = usePrimerDia();

  const a = useAnalisisDeRango(rango, corte);
  const cabeEnLaGrilla = dates.lengthInDays(rango) <= DIAS_QUE_CABEN;

  const tandas = useMemo(() => analytics.finDeSemanaContraSemana(a.serie), [a.serie]);
  const mayorTanda = Math.max(
    tandas.finDeSemana.promedio.amountMinor, tandas.entreSemana.promedio.amountMinor, 1,
  );
  const cuantoPesan = useMemo(() => analytics.concentracion(a.serie), [a.serie]);
  const diaNormal = useMemo(() => analytics.gastoDiarioTipico(a.serie), [a.serie]);
  const sinGastar = useMemo(() => analytics.diasSinGastar(a.serie), [a.serie]);
  // La racha se mide entre lo que la app vivió: los días antes del primer
  // movimiento no tienen datos, y los que no llegan todavía no pasaron.
  const racha = useMemo(
    () => analytics.rachaMasLargaSinGasto(a.serie, { desde: primerDia ?? undefined, hasta: hoy }),
    [a.serie, primerDia, hoy],
  );
  const masCaro = analytics.diaDeMayorGasto(a.serie);

  const saldoAlEmpezar = useSaldoAlEmpezar(rango);
  const serieDeSaldo = useMemo(
    () => analytics.saldoAcumulado(a.serie, saldoAlEmpezar),
    [a.serie, saldoAlEmpezar],
  );

  return (
    <Pantalla titulo="Día a día">
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}>
        <Titulo
          primero
          texto="Gasto por día"
          ayuda={'Cada celda es un día del período y su tono dice cuánto se gastó: '
            + 'mientras más claro, más. Los días sin gasto quedan apagados.\n\n'
            + 'Tocar un día lleva al listado de sus movimientos.'}
        />
        {cabeEnLaGrilla ? (
          // `hoy` y no `corte`: el corte se queda en el último día con movimientos.
          <Calendario
            serie={a.serie}
            hoy={hoy}
            onElegirDia={(fecha) => router.push({ pathname: '/movimientos', params: { dia: fecha } })}
          />
        ) : (
          <Text style={styles.aviso}>
            El calendario se ve hasta dos meses. Un año son 365 celdas de tres píxeles.
          </Text>
        )}

        <Titulo
          texto="Saldo día a día"
          ayuda={'Cuánta plata te quedaba al cerrar cada día. Baja con cada gasto y sube '
            + 'cuando entra un ingreso. El punto ámbar marca el día en que estuviste más abajo.\n\n'
            + 'Toca la curva para ver un día: cuánto quedaba al cerrarlo y qué se movió ese día.'}
        />
        <LineaDeSaldo serie={serieDeSaldo} />

        <Titulo
          texto="Cuándo pesa"
          ayuda={'Se compara por **promedio diario** y no por total: un mes tiene cinco '
            + 'veces más días entre semana que de fin de semana, así que el total le '
            + 'daría ventaja a la semana solo por existir más veces.\n\n'
            + 'Los **días más caros** dicen algo que el total no: dos meses que gastaron '
            + 'lo mismo no se parecen en nada si en uno el grueso se fue en tres días y '
            + 'en el otro en goteo. El primero se arregla mirando tres decisiones; el '
            + 'segundo, cambiando un hábito.'}
        />
        {/* Dos barras y no siete filas: la pregunta de verdad es si el fin de semana sale caro. */}
        <View style={styles.tandas}>
          {([
            ['Entre semana', tandas.entreSemana],
            ['Fin de semana', tandas.finDeSemana],
          ] as const).map(([nombre, tanda]) => {
            const parte = tanda.promedio.amountMinor / mayorTanda;
            const esLaCara = tanda.promedio.amountMinor === mayorTanda && mayorTanda > 1;
            return (
              <View key={nombre} style={styles.tanda}>
                <View style={styles.filaSemana}>
                  <Text style={esLaCara ? styles.nombreDiaMayor : styles.nombreDia}>{nombre}</Text>
                  <View style={styles.pista}>
                    <View style={[styles.relleno, esLaCara && styles.rellenoMayor, { flex: Math.max(parte, 0.001) }]} />
                    <View style={{ flex: Math.max(1 - parte, 0.001) }} />
                  </View>
                  <Text style={styles.montoDia}>{money.formatNumber(tanda.promedio)}</Text>
                </View>
                <Text style={styles.detalleDia}>
                  {tanda.dias === 0
                    ? 'no hubo ninguno en este período'
                    : `por día · ${money.format(tanda.total)} en ${tanda.dias} días`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Sin gasto, "el 0 % se fue en 0 días" es una división por cero disfrazada. */}
        {cuantoPesan.dias.length === 0 ? null : (
          <View style={styles.concentracion}>
            <Text style={styles.concentracionCifra}>{Math.round(cuantoPesan.parte * 100)}%</Text>
            <Text style={styles.concentracionTexto}>
              del gasto del período se fue en
              {cuantoPesan.dias.length === 1 ? ' un solo día' : ` ${cuantoPesan.dias.length} días`}
              {': '}
              {cuantoPesan.dias.map((dia) => dates.formatDateShort(dia.fecha)).join(', ')}
            </Text>
          </View>
        )}

        <Titulo
          texto="Detalle del período"
          ayuda={'El **día normal** es la mediana de los días en que gastaste algo, no el '
            + 'promedio de todos. Las dos decisiones apuntan a lo mismo: el promedio de un '
            + 'mes con arriendo está tirado por un solo día, y meter los días en cero lo '
            + 'tira para el otro lado. Lo que queda es contra lo que uno compara cuando se '
            + 'pregunta si hoy gastó mucho.\n\n'
            + 'La **racha sin gastar** son los días seguidos sin un solo gasto. Se cuenta '
            + 'desde que empezaste a anotar y hasta hoy: los días anteriores al primer '
            + 'movimiento están vacíos porque no hay datos, no porque no se haya gastado, y '
            + 'los que todavía no llegan no han pasado.'}
        />
        <Panel>
          <Dato etiqueta="Día normal" valor={money.format(diaNormal)} />
          <Dato
            etiqueta="Día más caro"
            valor={masCaro === null ? '—' : `${money.format(masCaro.gasto)} el ${dates.formatDateShort(masCaro.fecha)}`}
          />
          <Dato etiqueta="Días sin gastar" valor={`${sinGastar} de ${a.serie.length}`} />
          <Dato
            etiqueta="Racha sin gastar"
            valor={racha === 0 ? 'ninguna' : `${racha} ${racha === 1 ? 'día' : 'días'}`}
          />
        </Panel>

        <Anteriores />
      </ScrollView>
    </Pantalla>
  );
}

/** El ancho de la columna de nombres de "Cuándo pesa". */
const ANCHO_NOMBRE = 96;

function crearEstilos({ theme, t, letra }: Estilo) {
  return StyleSheet.create({
    contenido: { ...columna, paddingTop: spacing.lg },
    aviso: t.etiqueta,

    tandas: { gap: spacing.xs },
    tanda: { paddingVertical: 5 },
    filaSemana: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    nombreDia: { ...t.etiqueta, width: ANCHO_NOMBRE, color: theme.tinta },
    // El más caro se marca: es lo que uno viene a buscar a este gráfico.
    nombreDiaMayor: { ...t.etiqueta, width: ANCHO_NOMBRE, color: theme.tinta, fontWeight: t.seccion.fontWeight },
    pista: { flex: 1, flexDirection: 'row', height: 6 },
    relleno: { backgroundColor: charts[0], borderRadius: radii.sm },
    rellenoMayor: { backgroundColor: theme.acento },
    montoDia: { ...t.cifra, width: 62, textAlign: 'right' },
    detalleDia: { ...t.nota, marginLeft: ANCHO_NOMBRE + spacing.sm },

    // La única cifra de la pantalla que no es plata: puede ser grande sin
    // competir con los montos, y la frase de al lado la explica.
    concentracion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
    concentracionCifra: {
      ...t.cifra,
      fontSize: letra.xl,
      fontWeight: t.accion.fontWeight,
      color: theme.acentoTexto,
      letterSpacing: -0.5,
    },
    concentracionTexto: { ...t.etiqueta, flex: 1, lineHeight: letra.px(17) },
  });
}
