/**
 * Categorias: en que se me va la plata en este periodo.
 *
 * La torta arriba para la proporcion, las barras abajo para comparar montos.
 * Las dos cosas responden preguntas distintas: la torta dice "que parte del
 * total", las barras dicen "cuanto mas que la siguiente".
 *
 * ## Apagar una categoria para contrastar
 *
 * Cuando una categoria se lleva el 60 % del gasto, las once restantes quedan
 * aplastadas y la torta no distingue entre la segunda y la ultima. Apagando la
 * grande, el reparto se recalcula sobre las que quedan y ahi si se ven.
 *
 * **Es estado de la pantalla, no una preferencia guardada.** Se apaga, se mira,
 * se vuelve a prender: es un gesto de analisis, no una configuracion. Al salir
 * de la vista vuelven todas, porque la barra de abajo navega reemplazando y la
 * pantalla se desmonta. Bajar al listado de una categoria y volver con atras si
 * lo conserva, que es lo correcto: eso es bajar al detalle, no salir.
 *
 * La escala de las barras **no** se recalcula: sale de la lista completa. Si
 * saliera de las encendidas, apagar la mas grande --que es el gesto obvio--
 * reescalaria la pista y la fila apagada quedaria con todas las muescas llenas,
 * o sea midiendo lo mismo que la nueva mayor. Lo que la fila apagada tiene que
 * seguir diciendo es justamente cuanto era lo que sacaste.
 *
 * **La casilla vive solo en la lista completa.** Estuvo tambien en la leyenda
 * de la torta, y las apagadas se quedaban ahi al final para poder volver a
 * prenderlas: cada una que se apagaba empujaba el resto de la pantalla hacia
 * abajo. Ahora la leyenda muestra solo lo que esta en el dibujo, y la lista de
 * abajo lleva todas las categorias del periodo, apagadas incluidas.
 *
 * ## Tocar una categoria lleva a sus movimientos
 *
 * Y nada mas. Hubo un intento de abrir una hoja con dos opciones --ver la lista
 * o editar la categoria-- y se saco: la pregunta que trae a alguien a esta
 * pantalla es "en que se me fue la plata", y la respuesta a eso es la lista de
 * movimientos, no un menu. **Configurar una categoria vive en Ajustes**, que es
 * donde ya estaba su lista, y desde ahi se le cambia el nombre, si cuenta como
 * compromiso, y sus reglas de categorizacion.
 *
 * Lo que si se queda aca es la casilla, porque apagar una categoria no es
 * configurarla: es mirar lo mismo de otra manera, y dura lo que dura la visita.
 */

import { analytics, dates, money } from '@iceberg/core';
import {
  elevation, fonts, niceUnit, notchesFor, pesos, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare';
import { Square } from 'phosphor-react-native/src/icons/Square';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Anteriores } from '../../components/Anteriores';
import { BarraSegmentada } from '../../components/BarraSegmentada';
import { Ayuda } from '../../components/Ayuda';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior } from '../../datos/desplazamiento';
import { QueCambio } from '../../components/QueCambio';
import { Creditos } from '../../components/Creditos';
import { Hoja } from '../../components/Hoja';
import { TortaDeCategorias } from '../../components/TortaDeCategorias';
import { iconoDeCategoria } from '../../components/iconos';
import { useAnalisisDeRango } from '../../datos/consultas';
import { useLetra } from '../../datos/letra';
import { nombreDePeriodo, usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';
import { useCategorias } from '../../datos/catalogo';

/**
 * Cuantos toques al pinguino del hueco abren los creditos.
 *
 * Seis es bastante, y esa es la idea: el pinguino brinca desde el primer toque,
 * asi que quien lo toca ya recibio lo suyo. Los creditos son para el que
 * insiste.
 */
const TOQUES_PARA_LOS_CREDITOS = 6;

export default function Categorias() {
  const { theme } = useTema();
  const letra = useLetra();
  const [toquesAlPinguino, setToquesAlPinguino] = useState(0);
  const [creditos, setCreditos] = useState(false);
  const aireInferior = useAireInferior();
  const styles = useMemo(() => crearEstilos(theme, letra), [theme, letra]);
  const categorias = useCategorias();
  const { tipo, rango, corte } = usePeriodo();
  const router = useRouter();

  const a = useAnalisisDeRango(rango, corte);
  // `nombreDePeriodo` viene con mayuscula porque normalmente es un titulo; aca
  // va detras de "vs." y en medio de una frase.
  const referencia = useMemo(() => {
    const nombre = nombreDePeriodo(tipo, dates.previousPeriod(rango));
    return nombre.charAt(0).toLowerCase() + nombre.slice(1);
  }, [tipo, rango]);
  // Sobre la lista completa y no sobre las encendidas: ver la cabecera.
  const unidad = niceUnit(a.mayorCategoria);
  const muescas = notchesFor(a.mayorCategoria, unidad);

  const [apagadas, setApagadas] = useState<ReadonlySet<string>>(() => new Set());

  const alternar = (categoriaId: string) => setApagadas((previas) => {
    const siguientes = new Set(previas);
    if (!siguientes.delete(categoriaId)) siguientes.add(categoriaId);
    return siguientes;
  });

  /**
   * Si hay alguna apagada **de las que se ven ahora**.
   *
   * Y no `apagadas.size > 0`: cambiar de periodo trae otras categorias, y el
   * boton de prender todas quedaria colgado por ids que ya no estan en
   * pantalla. Asi tampoco hace falta un efecto que limpie el conjunto.
   */
  const hayApagadas = a.porCategoria.some((p) => apagadas.has(p.categoriaId));

  const verMovimientos = (categoriaId: string) =>
    router.push({ pathname: '/movimientos', params: { categoria: categoriaId } });

  /**
   * El nombre de la fila de "sin categoria".
   *
   * `analytics.SIN_CATEGORIA` es una clave interna, no un id de categoria, asi
   * que el catalogo la devolveria pelada. Se resuelve como la ausencia que es.
   */
  const nombreDe = (categoriaId: string) =>
    (categoriaId === analytics.SIN_CATEGORIA ? undefined : categoriaId);

  return (
    <Pantalla titulo="Categorías">
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
      >
        <Titulo
          texto="Reparto del gasto"
          theme={theme}
          estilo={styles.primerTitulo}
          ayuda={'Las cinco categorías más grandes llevan color propio; el resto se '
            + 'junta en "Otras" porque doce porciones no se distinguen. Los porcentajes '
            + 'son sobre el gasto del período, no sobre el total del año.\n\n'
            + 'Las casillas de "Todas las categorías", más abajo, sacan una del reparto '
            + 'y la torta se rehace sobre las que quedan, que es la forma de ver cómo se '
            + 'reparte el resto cuando una sola se lleva casi todo. Las apagadas no '
            + 'aparecen acá.'}
        />
        {/* La torta recibe **todas**, apagadas incluidas, para distinguir un
            periodo sin gastos de uno en que se apagaron todas. */}
        <TortaDeCategorias
          onTocarPinguino={() => {
            const van = toquesAlPinguino + 1;
            setToquesAlPinguino(van);
            if (van === TOQUES_PARA_LOS_CREDITOS) setCreditos(true);
          }}
          porciones={a.porCategoria}
          theme={theme}
          apagadas={apagadas}
          onElegir={verMovimientos}
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
            <Titulo
              texto="Todas las categorías"
              theme={theme}
              ayuda={'Cada barra es una categoría del período, de mayor a menor. Tocar '
                + 'una lleva al listado filtrado por ella. Las muescas son de un mismo '
                + 'tamaño, así que dos barras se comparan contándolas.\n\n'
                + 'La casilla la saca del reparto de la torta de arriba. Apagada conserva '
                + 'su barra, para que se siga viendo cuánto era lo que sacaste. Se apaga '
                + 'solo para mirar: no borra nada y vuelven todas al salir.\n\n'
                + 'Para cambiarle el nombre o si cuenta como compromiso fijo, entra a '
                + 'Ajustes y toca la categoría en la lista.'}
              derecha={hayApagadas ? (
                <Pressable
                  onPress={() => setApagadas(new Set())}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a prender todas las categorías"
                >
                  <Text style={styles.prenderTodas}>Prender todas</Text>
                </Pressable>
              ) : undefined}
            />

            {a.porCategoria.map(({ categoriaId, total }) => {
              const Icono = iconoDeCategoria(categoriaId);
              const apagada = apagadas.has(categoriaId);
              const comoSeLlama = categorias.nombre(nombreDe(categoriaId));
              const Casilla = apagada ? Square : CheckSquare;
              // Dos zonas hermanas y no una dentro de otra: un tocable adentro
              // de otro se pelea el toque segun la plataforma, y aca son dos
              // acciones distintas.
              return (
                <View key={categoriaId} style={styles.fila}>
                  <Pressable
                    onPress={() => alternar(categoriaId)}
                    hitSlop={10}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !apagada }}
                    accessibilityLabel={apagada
                      ? `${comoSeLlama} está fuera del reparto. Tocar para volver a incluirla`
                      : `${comoSeLlama} entra en el reparto. Tocar para sacarla`}
                  >
                    {/* Una casilla y no el icono de la categoria: el icono no se
                        lee como algo tocable, y estuvo tan escondido que hubo
                        que preguntar donde estaba. */}
                    <Casilla
                      size={16}
                      weight={apagada ? 'regular' : 'fill'}
                      color={apagada ? theme.silencio : theme.acentoTexto}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => verMovimientos(categoriaId)}
                    style={styles.filaTocable}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver movimientos de ${comoSeLlama}, ${money.format(total)}`}
                  >
                    <Icono size={15} weight="regular" color={theme.silencio} />
                    <Text
                      style={[styles.nombre, apagada && styles.textoApagado]}
                      numberOfLines={1}
                    >
                      {categorias.nombreCorto(nombreDe(categoriaId))}
                    </Text>
                    <BarraSegmentada
                      valor={total.amountMinor}
                      unidad={unidad}
                      total={muescas}
                      theme={theme}
                      apagada={apagada}
                    />
                    <Text style={[styles.monto, apagada && styles.textoApagado]}>
                      {money.formatNumber(total)}
                    </Text>
                    <CaretRight size={12} weight="bold" color={theme.silencio} />
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}

        {/* Al final y solo si el periodo esta vacio: ver `Anteriores`. */}
        <Anteriores theme={theme} />
      </ScrollView>

      <Hoja
        abierta={creditos}
        titulo="Gracias"
        theme={theme}
        onCerrar={() => { setCreditos(false); setToquesAlPinguino(0); }}
      >
        <Creditos theme={theme} />
      </Hoja>
    </Pantalla>
  );
}

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    // El primero no necesita el aire de arriba: ya lo da el encabezado.
    primerTitulo: { marginTop: 0 },

    // Sin subrayado: eran diez lineas horizontales seguidas para decir algo que
    // el `>` del final dice sin cortar el ancho de la pantalla.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    // El resto de la fila, que es lo que abre la hoja. Sin el, la zona tocable
    // seria solo el texto y el monto quedaria muerto.
    filaTocable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    /**
     * Apagada, pero legible.
     *
     * `silencio` y no una opacidad sobre la fila entera: a la opacidad que hace
     * falta para que se lea como apagada, el texto se cae del contraste AA.
     */
    textoApagado: { color: theme.silencio },
    prenderTodas: {
      fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.acentoTexto,
    },
    nombre: { width: 78, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    monto: { width: 66, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
  });
}
