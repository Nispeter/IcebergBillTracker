/**
 * Dia a dia: cuando se me va la plata.
 *
 * La grilla arriba y, debajo, los datos que solo tienen sentido mirando el
 * calendario: que dia de la semana pesa mas y cuanto se aguanta sin gastar.
 */

import { dates, money } from '@iceberg/core';
import {
  charts, elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { analytics } from '@iceberg/core';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { Calendario } from '../../components/Calendario';
import { Ayuda } from '../../components/Ayuda';
import { LineaDeSaldo } from '../../components/LineaDeSaldo';
import { Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior } from '../../datos/desplazamiento';
import { useAnalisisDeRango, usePrimerDia, useSaldoAlEmpezar } from '../../datos/consultas';
import { useHoy } from '../../datos/hoy';
import { useLetra } from '../../datos/letra';
import { usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

export default function DiaADia() {
  const { theme } = useTema();
  const letra = useLetra();
  const aireInferior = useAireInferior();
  const styles = useMemo(() => crearEstilos(theme, letra), [theme, letra]);
  const { rango, corte } = usePeriodo();
  /**
   * Se mide el rango, no el tipo.
   *
   * Antes preguntaba `tipo === 'year'`, y eso dejaba pasar todo lo demas que
   * tambien es largo: un rango libre de seis meses, o el "último año", que dura
   * lo mismo que un ano pero no se llama asi. Lo que no entra en la grilla es el
   * largo, no el nombre.
   *
   * El tope son unas nueve semanas: dos meses seguidos todavia se leen, y de ahi
   * en adelante la celda baja de los treinta pixeles y el monto no entra.
   */
  const cabeEnLaGrilla = dates.lengthInDays(rango) <= 70;
  const router = useRouter();
  const hoy = useHoy();
  const primerDia = usePrimerDia();

  const a = useAnalisisDeRango(rango, corte);

  const tandas = useMemo(() => analytics.finDeSemanaContraSemana(a.serie), [a.serie]);
  const mayorTanda = Math.max(
    tandas.finDeSemana.promedio.amountMinor, tandas.entreSemana.promedio.amountMinor, 1,
  );
  const cuantoPesan = useMemo(() => analytics.concentracion(a.serie), [a.serie]);
  const diaNormal = useMemo(() => analytics.gastoDiarioTipico(a.serie), [a.serie]);
  const sinGastar = useMemo(() => analytics.diasSinGastar(a.serie), [a.serie]);
  /**
   * La racha se mide solo entre lo que la app vivio.
   *
   * Sin la ventana, un mes en el que se empezo a anotar el 22 reportaba "21 dias
   * sin gastar": son veintiun dias sin datos, que es lo contrario de un merito.
   * Por el otro lado, los dias que todavia no llegan tampoco son racha.
   */
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

        {!cabeEnLaGrilla ? (
          <Text style={styles.aviso}>
            El calendario se ve hasta dos meses. Un año son 365 celdas de tres píxeles.
          </Text>
        ) : (
          /*
            `hoy` y no `corte`: el corte es hasta donde llegan los datos y se
            queda en el ultimo movimiento anotado, asi que el pinguino marcaba el
            25 cuando ya era 26 solo porque ese dia no habia nada escrito.
          */
          <Calendario
            serie={a.serie}
            theme={theme}
            hoy={hoy}
            onElegirDia={(fecha) => router.push({ pathname: '/movimientos', params: { dia: fecha } })}
          />
        )}

        <Titulo
          texto="Saldo día a día"
          theme={theme}
          ayuda={'Cuánta plata te quedaba al cerrar cada día. Baja con cada gasto y sube '
            + 'cuando entra un ingreso. El punto ámbar marca el día en que estuviste más abajo.\n\n'
            + 'Tocá la curva para ver un día: cuánto quedaba al cerrarlo y qué se movió ese día.'}
        />
        <LineaDeSaldo serie={serieDeSaldo} theme={theme} />

        <Titulo
          texto="Cuándo pesa"
          theme={theme}
          ayuda={'Se compara por **promedio diario** y no por total: un mes tiene cinco '
            + 'veces más días entre semana que de fin de semana, así que el total le '
            + 'daría ventaja a la semana solo por existir más veces.\n\n'
            + 'Los **días más caros** dicen algo que el total no: dos meses que gastaron '
            + 'lo mismo no se parecen en nada si en uno el grueso se fue en tres días y '
            + 'en el otro en goteo. El primero se arregla mirando tres decisiones; el '
            + 'segundo, cambiando un hábito.'}
        />

        {/*
          Dos barras y no siete filas.

          La tabla por dia de la semana decia lo mismo repartido en siete
          renglones, y por eso no decia nada: para leerla habia que promediar de
          cabeza mientras se miraba. La pregunta que uno tiene de verdad es si el
          fin de semana sale caro, y esa se contesta con dos numeros.
        */}
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
                    <View style={[
                      styles.relleno,
                      esLaCara && styles.rellenoMayor,
                      { flex: Math.max(parte, 0.001) },
                    ]} />
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

        {/* Solo si hay con que: sin gasto, "el 0 % se fue en 0 dias" no es un
            dato, es una division por cero disfrazada. */}
        {cuantoPesan.dias.length === 0 ? null : (
          <View style={styles.concentracion}>
            <Text style={styles.concentracionCifra}>
              {Math.round(cuantoPesan.parte * 100)}%
            </Text>
            <Text style={styles.concentracionTexto}>
              del gasto del período se fue en
              {cuantoPesan.dias.length === 1 ? ' un solo día' : ` ${cuantoPesan.dias.length} días`}
              {': '}
              {cuantoPesan.dias.map((dia) => dates.formatDate(dia.fecha).slice(0, 5)).join(', ')}
            </Text>
          </View>
        )}

        <Titulo
          texto="Detalle del período"
          theme={theme}
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
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Día normal" valor={money.format(diaNormal)} />
          <Dato styles={styles} etiqueta="Día más caro"
            valor={masCaro === null ? '—' : `${money.format(masCaro.gasto)}`} />
          <Dato styles={styles} etiqueta="Días sin gastar"
            valor={`${sinGastar} de ${a.serie.length}`} />
          <Dato styles={styles} etiqueta="Racha sin gastar"
            valor={racha === 0 ? 'ninguna' : `${racha} ${racha === 1 ? 'día' : 'días'}`} />
        </Panel>

        {/* Al final y solo si el periodo esta vacio: ver `Anteriores`. */}
        <Anteriores theme={theme} />
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

function crearEstilos(theme: Theme, letra: Letra) {
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
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio },

    // Elevada para que la burbuja de la ayuda tape lo que viene debajo.

    tandas: { gap: spacing.xs },
    tanda: { paddingVertical: 5 },
    filaSemana: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    /**
     * La cifra grande de la concentracion.
     *
     * Es el unico numero de la pantalla que no es plata, y por eso puede ser
     * grande sin competir con los montos: se lee como un titular y la frase de
     * al lado lo explica.
     */
    concentracion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
    concentracionCifra: {
      fontFamily: fonts.mono,
      fontWeight: pesos.medium,
      fontSize: letra.xl,
      color: theme.acentoTexto,
      letterSpacing: -0.5,
    },
    concentracionTexto: {
      flex: 1,
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      lineHeight: letra.px(17),
      color: theme.silencio,
    },
    nombreDia: { width: 96, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    // El dia mas caro se marca: es lo que uno viene a buscar a este grafico.
    nombreDiaMayor: { width: 96, fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.tinta },
    rellenoMayor: { backgroundColor: theme.acento },
    detalleDia: {
      marginLeft: 96 + spacing.sm,
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.px(10),
      color: theme.silencio,
    },
    pista: { flex: 1, flexDirection: 'row', height: 6 },
    relleno: { backgroundColor: charts[0], borderRadius: radii.sm },
    montoDia: { width: 62, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio, marginTop: spacing.xs },

    // Sin subrayado: el panel agrupa, y dos columnas alineadas ya se leen como
    // tabla. La etiqueta va en el gris que se lee sobre el fondo hundido.
    dato: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    datoEtiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencioHondo },
    datoValor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.tinta },
  });
}
