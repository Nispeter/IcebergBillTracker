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
 * ## Tocar una categoria abre lo que se puede hacer con ella
 *
 * Antes iba derecho al listado filtrado. Ahora abre una hoja con el total, la
 * cantidad de movimientos y las dos acciones: ver la lista o editarla. El
 * listado sigue estando a un toque de distancia; lo que se gana es que editar
 * exista en alguna parte.
 */

import { analytics, categories, dates, money } from '@iceberg/core';
import {
  elevation, fonts, niceUnit, notchesFor, pesos, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
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
import { DetalleDeCategoria } from '../../components/DetalleDeCategoria';
import { iconoDeCategoria } from '../../components/iconos';
import { useAnalisisDeRango, useMovimientos } from '../../datos/consultas';
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
  const [elegida, setElegida] = useState<string | null>(null);

  const alternar = (categoriaId: string) => setApagadas((previas) => {
    const siguientes = new Set(previas);
    if (!siguientes.delete(categoriaId)) siguientes.add(categoriaId);
    return siguientes;
  });

  const encendidas = useMemo(
    () => a.porCategoria.filter((p) => !apagadas.has(p.categoriaId)),
    [a.porCategoria, apagadas],
  );
  /**
   * Si hay alguna apagada **de las que se ven ahora**.
   *
   * Y no `apagadas.size > 0`: cambiar de periodo trae otras categorias, y el
   * boton de prender todas quedaria colgado por ids que ya no estan en
   * pantalla. Asi tampoco hace falta un efecto que limpie el conjunto.
   */
  const hayApagadas = a.porCategoria.some((p) => apagadas.has(p.categoriaId));

  /** Cuantos movimientos hay en cada categoria del periodo. Ver `DetalleDeCategoria`. */
  const movimientos = useMovimientos();
  const cuantosPorCategoria = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const m of movimientos) {
      if (m.tipo !== 'gasto') continue;
      if (!dates.containsDate(rango, m.ocurridoEn as dates.PlainDate)) continue;
      const clave = m.categoriaId ?? analytics.SIN_CATEGORIA;
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
    }
    return cuenta;
  }, [movimientos, rango]);

  const verMovimientos = (categoriaId: string) => {
    setElegida(null);
    router.push({ pathname: '/movimientos', params: { categoria: categoriaId } });
  };

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
            + 'Puedes apagar una categoría con el punto que lleva a la izquierda, abajo '
            + 'en la lista. La torta se rehace sobre las que quedan, que es la forma de '
            + 'ver el reparto cuando una sola se lleva casi todo. Se apaga solo para '
            + 'mirar: no borra nada y vuelve al salir.'}
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
        {encendidas.length === 0 && a.porCategoria.length > 0 ? (
          // La torta vacia dice "Sin gastos en este período", que aca seria
          // mentira: los gastos estan, lo que pasa es que se apagaron todos.
          <Text style={styles.todasApagadas}>
            Están todas apagadas. Vuelve a prender alguna para ver el reparto.
          </Text>
        ) : (
          <TortaDeCategorias
            onTocarPinguino={() => {
              const van = toquesAlPinguino + 1;
              setToquesAlPinguino(van);
              if (van === TOQUES_PARA_LOS_CREDITOS) setCreditos(true);
            }}
            porciones={encendidas}
            theme={theme}
            onElegir={(categoriaId) => setElegida(categoriaId)}
          />
        )}

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
                + 'una abre qué se puede hacer con ella: ver sus movimientos o cambiarle '
                + 'el nombre. Las muescas son de un mismo tamaño, así que dos barras se '
                + 'comparan contándolas.\n\n'
                + 'El icono de la izquierda la apaga y la vuelve a prender. Apagada sale '
                + 'de la torta pero conserva su barra, para que se siga viendo cuánto era '
                + 'lo que sacaste.'}
            />

            {a.porCategoria.map(({ categoriaId, total }) => {
              const Icono = iconoDeCategoria(categoriaId);
              const apagada = apagadas.has(categoriaId);
              const comoSeLlama = categorias.nombre(nombreDe(categoriaId));
              // Dos zonas hermanas y no una dentro de otra: un tocable adentro
              // de otro se pelea el toque segun la plataforma, y aca son dos
              // acciones distintas.
              return (
                <View key={categoriaId} style={styles.fila}>
                  <Pressable
                    onPress={() => alternar(categoriaId)}
                    hitSlop={10}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !apagada }}
                    accessibilityLabel={apagada
                      ? `${comoSeLlama} está fuera del reparto. Tocar para volver a incluirla`
                      : `${comoSeLlama} entra en el reparto. Tocar para sacarla`}
                  >
                    <Icono
                      size={15}
                      weight="regular"
                      color={apagada ? theme.hairline : theme.silencio}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => setElegida(categoriaId)}
                    style={styles.filaTocable}
                    accessibilityRole="button"
                    accessibilityLabel={`${comoSeLlama}, ${money.format(total)}. Qué hacer con esta categoría`}
                  >
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

      {/*
        El contenido se monta solo con una elegida. La hoja sigue montada
        mientras se cierra, y para entonces `elegida` ya es `null`: dentro del
        hijo el id nunca puede serlo, asi que no hay una guarda por cada dato.
      */}
      <Hoja
        abierta={elegida !== null}
        titulo={elegida === null ? '' : categorias.nombre(nombreDe(elegida))}
        theme={theme}
        onCerrar={() => setElegida(null)}
      >
        {elegida === null ? null : (
          <DetalleDeCategoria
            theme={theme}
            categoriaId={elegida}
            nombre={categorias.nombre(nombreDe(elegida))}
            total={a.porCategoria.find((p) => p.categoriaId === elegida)?.total
              ?? money.money(0, 'CLP')}
            cuantos={cuantosPorCategoria.get(elegida) ?? 0}
            periodo={nombreDePeriodo(tipo, rango)}
            sePuedeEditar={sePuedeEditar(elegida, categorias.todas)}
            onVer={() => verMovimientos(elegida)}
            onEditar={() => {
              setElegida(null);
              router.push({ pathname: '/categoria/[id]', params: { id: elegida } });
            }}
          />
        )}
      </Hoja>
    </Pantalla>
  );
}

/**
 * Si esa categoria tiene un nombre propio que cambiar.
 *
 * No lo tiene la fila de "sin categoria" --que no es una categoria sino su
 * ausencia-- ni una propia ya borrada, que sigue apareciendo en el reparto
 * solo porque quedan movimientos viejos con su id. Renombrar una de esas la
 * devolveria a todos los selectores sin que nada lo anuncie.
 */
function sePuedeEditar(
  categoriaId: string,
  todas: readonly { id: string }[],
): boolean {
  if (categoriaId === analytics.SIN_CATEGORIA) return false;
  if (categories.categoryById(categoriaId) !== null) return true;
  return todas.some((c) => c.id === categoriaId);
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
    todasApagadas: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      color: theme.silencio,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    nombre: { width: 78, fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    monto: { width: 66, textAlign: 'right', fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
  });
}
