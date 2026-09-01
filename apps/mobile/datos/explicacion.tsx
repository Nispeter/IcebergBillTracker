/**
 * Una sola hoja para todas las explicaciones de la app.
 *
 * Antes cada `?` abria su propia burbuja absoluta, y esa burbuja peleaba el
 * apilado con lo que tuviera al lado: `zIndex` en la raiz, `zIndex` en el
 * contenedor, `zIndex` en el padre del padre. Cada vez que una pantalla crecia
 * aparecia otro caso de "el globo se dibuja atras". No era un bug, era un
 * enfoque que garantizaba bugs: un elemento flotante solo compite dentro de su
 * contexto de apilado, y ese contexto lo decide cualquier ancestro.
 *
 * La hoja no tiene ese problema **por construccion**: vive una sola vez, arriba
 * de todo, y las pantallas solo piden que se muestre. De paso todas las
 * explicaciones de la app se presentan igual, que es lo que el usuario pidio
 * cuando dijo que prefiere como muestra la informacion la `i` del saldo.
 */

import {
  elevation, fonts, pesos, radii, spacing, trozosConEnfasis, type Letra, type Theme,
} from '@iceberg/ui';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aparecer } from '../components/Aparecer';
import { Hoja } from '../components/Hoja';
import { Pinguino } from '../components/Pinguino';
import { useExplicacionDeUna } from './consultas';
import { useLetra } from './letra';

/**
 * Cuanto tarda el pinguino en decir un parrafo, en milisegundos.
 *
 * Proporcional al largo, porque una frase larga tarda mas en decirse y un pico
 * que se mueve el mismo rato para una linea que para cinco delata que el gesto
 * es de adorno. Con tope: pasado un rato el movimiento deja de ser simpatico y
 * molesta para leer, que es lo unico que la hoja vino a permitir.
 *
 * No pretende ser la velocidad real de lectura --nadie espera a que termine
 * para leer, se lee mientras aparece-- sino el ritmo de una conversacion.
 *
 * Los numeros salieron de mirarlo corriendo. Con doce milisegundos por caracter
 * el caso comun --dos o tres parrafos-- quedaba bien, pero la ayuda de
 * Sincronizar son ocho y tardaba mas de diez segundos en terminar de salir.
 * Aca se paga el ritmo del caso comun, que es de dos segundos, y la de ocho se
 * adelanta con un toque, que para eso esta.
 */
function cuantoTarda(parrafo: string): number {
  return Math.min(1400, 300 + parrafo.length * 7);
}

/** El respiro entre un parrafo y el siguiente. */
const PAUSA = 180;

/**
 * El texto partido en lo que seran las burbujas.
 *
 * Por parrafo, que es la particion que los textos ya traen puesta: estan
 * escritos con doble salto de linea entre ideas, asi que cada burbuja cae
 * exactamente donde el autor separo un tema del siguiente. Partir por oracion
 * daria burbujas de tres palabras y partir por largo cortaria a la mitad de una
 * frase.
 */
function enParrafos(texto: string): string[] {
  return texto.split('\n\n').map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * Lo que se puede hacer desde la explicacion, si hay algo que hacer.
 *
 * Casi ninguna lo lleva: una definicion se lee y se cierra. Lo lleva la que
 * avisa que estas parado en otro periodo, porque ahi la explicacion y el arreglo
 * son la misma frase --"no estas en septiembre" / "volver a septiembre"-- y
 * obligar a cerrar la hoja para despues buscar el boton seria pedir dos pasos
 * para una sola decision.
 */
export interface AccionDeExplicacion {
  readonly etiqueta: string;
  alTocar(): void;
}

/** Muestra una explicacion. El titulo es el de la seccion que la pidio. */
type Explicar = (titulo: string, texto: string, accion?: AccionDeExplicacion) => void;

const Contexto = createContext<Explicar>(() => {});

export function useExplicar(): Explicar {
  return useContext(Contexto);
}

export function ProveedorDeExplicacion({ theme, children }: { theme: Theme; children: ReactNode }) {
  const [abierta, setAbierta] = useState<
    { titulo: string; texto: string; accion?: AccionDeExplicacion } | null
  >(null);
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);

  const explicar = useCallback<Explicar>(
    (titulo, texto, accion) => setAbierta({ titulo, texto, accion }),
    [],
  );

  const { deUna } = useExplicacionDeUna();
  const texto = abierta?.texto;
  const parrafos = useMemo(() => enParrafos(texto ?? ''), [texto]);
  /** Cuantas burbujas ya se dijeron. */
  const [dichas, setDichas] = useState(0);
  const [hablando, setHablando] = useState(false);
  const faltan = dichas < parrafos.length;

  /**
   * Al abrirse arranca la conversacion; al cerrarse se corta.
   *
   * `texto` como dependencia y no el objeto entero: abrir otra explicacion tiene
   * que volver a empezar de la primera burbuja, y ese es el unico campo que
   * distingue una explicacion de otra.
   */
  useEffect(() => {
    if (texto === undefined) { setDichas(0); return; }
    setDichas(deUna ? enParrafos(texto).length : 1);
  }, [texto, deUna]);

  /**
   * La linea de tiempo, en un solo lugar.
   *
   * Cada vez que aparece una burbuja el pinguino habla lo que dure ese parrafo,
   * se calla, y recien despues de la pausa aparece la siguiente. Tenerlo en un
   * efecto y no en dos evita el desfase clasico: dos temporizadores con la misma
   * duracion que arrancan en renders distintos y terminan a destiempo, y el pico
   * queda moviendose sobre una burbuja que ya termino.
   */
  useEffect(() => {
    if (dichas === 0) { setHablando(false); return undefined; }

    const tarda = cuantoTarda(parrafos[dichas - 1] ?? '');
    setHablando(true);
    const callar = setTimeout(() => setHablando(false), tarda);
    if (dichas >= parrafos.length) return () => clearTimeout(callar);

    const siguiente = setTimeout(() => setDichas((cuantas) => cuantas + 1), tarda + PAUSA);
    return () => { clearTimeout(callar); clearTimeout(siguiente); };
  }, [dichas, parrafos]);

  return (
    <Contexto.Provider value={explicar}>
      {children}
      {/* Va **despues** de los hijos: es lo ultimo del arbol, asi que se dibuja
          encima de todo sin necesitar un solo `zIndex`. */}
      <Hoja
        abierta={abierta !== null}
        titulo={abierta?.titulo ?? ''}
        theme={theme}
        onCerrar={() => setAbierta(null)}
      >
        {/*
          El pinguino dice la explicacion, y la dice de a un parrafo.

          Es la misma informacion que antes, puesta como una conversacion en vez
          de como un cartel. Cambia poco y cambia todo: un recuadro de texto es
          el sistema informandote y una burbuja es alguien contestandote lo que
          preguntaste, que es literalmente lo que paso --tocaste una `i`--.

          **Tocar adelanta.** Una animacion que no se puede saltar es una
          animacion que molesta a la segunda vez, y aca la segunda vez llega
          rapido: las explicaciones se releen. Toda el area es el boton, no un
          "saltar" chiquito en una esquina, porque el gesto que sale solo cuando
          uno se impacienta es tocar la pantalla en cualquier parte.

          El pinguino va **arriba** y no centrado: las burbujas crecen hacia
          abajo y con una explicacion de cuatro parrafos uno centrado terminaria
          hablando desde el medio de la conversacion.
        */}
        <Pressable
          onPress={() => setDichas(parrafos.length)}
          disabled={!faltan}
          style={styles.dialogo}
          accessibilityRole={faltan ? 'button' : undefined}
          accessibilityLabel={faltan ? 'Ver la explicación completa' : undefined}
        >
          <Pinguino theme={theme} tamano={44} hablando={hablando} />

          <View style={styles.burbujas}>
            {parrafos.slice(0, dichas).map((parrafo, indice) => (
              // El indice como clave es correcto aca: la lista solo crece por el
              // final y se rehace entera cuando cambia el texto.
              // eslint-disable-next-line react/no-array-index-key
              <Aparecer key={indice} visible desplazamiento={-6}>
                <View style={styles.burbuja}>
                  {/* La colita solo en la primera: las que siguen son el mismo
                      que sigue hablando, y en un chat solo la primera del turno
                      apunta a quien habla. */}
                  {indice > 0 ? null : <View style={styles.colita} />}

                  {/*
                    Un solo `Text` con los trozos adentro, no uno por trozo:
                    anidados heredan el estilo y siguen siendo el mismo parrafo,
                    asi que el salto de linea cae donde tiene que caer. Uno por
                    trozo los pondria uno debajo del otro.
                  */}
                  <Text style={styles.texto}>
                    {trozosConEnfasis(parrafo).map((trozo, cual) => (
                      // eslint-disable-next-line react/no-array-index-key
                      <Text key={cual} style={trozo.fuerte ? styles.fuerte : undefined}>
                        {trozo.texto}
                      </Text>
                    ))}
                  </Text>
                </View>
              </Aparecer>
            ))}

            {/* Sin esto, que se puede tocar para adelantar no lo sabe nadie. Se
                va con la ultima burbuja, que es cuando deja de ser cierto. */}
            {!faltan ? null : <Text style={styles.pista}>toca para verlo todo</Text>}
          </View>
        </Pressable>

        {/* Cierra sola: lo que la hoja explicaba deja de ser cierto en cuanto se
            toca el boton, asi que dejarla abierta mostraria una frase vieja. */}
        {abierta?.accion === undefined ? null : (
          <Pressable
            onPress={() => { abierta.accion?.alTocar(); setAbierta(null); }}
            style={styles.accion}
            accessibilityRole="button"
            accessibilityLabel={abierta.accion.etiqueta}
          >
            <Text style={styles.accionTexto}>{abierta.accion.etiqueta}</Text>
          </Pressable>
        )}
      </Hoja>
    </Contexto.Provider>
  );
}

/** Lado del cuadrado que hace de colita. Girado, asoma su diagonal. */
const COLITA = 12;

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    // Arriba y no al medio: ver el comentario del dialogo.
    dialogo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    // La columna de la derecha: las burbujas, una debajo de otra.
    burbujas: { flex: 1, gap: spacing.sm },
    /**
     * La burbuja.
     *
     * Se hunde en vez de levantarse --`superficieHonda`-- porque la hoja ya es
     * una superficie elevada: una tarjeta clara encima de otra clara no se
     * despega de nada. Hundida se lee como un hueco dentro de la hoja, que es
     * como se ven las burbujas de chat de todo el mundo.
     */
    burbuja: {
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    /**
     * La colita, apuntando al pico.
     *
     * Un cuadrado girado 45 grados: dos de sus lados quedan afuera y forman el
     * triangulo, y los otros dos quedan tapados por la burbuja, que se dibuja
     * despues. Por eso se corre media diagonal hacia adentro --si asomara
     * entero, se le verian las cuatro lineas del borde--.
     *
     * A la altura del pico y no del centro: sale de donde esta la boca.
     */
    colita: {
      position: 'absolute',
      left: -(COLITA / 2) - 1,
      top: 16,
      width: COLITA,
      height: COLITA,
      transform: [{ rotate: '45deg' }],
      backgroundColor: theme.superficieHonda,
      borderLeftWidth: elevation.hairlineWidth,
      borderBottomWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    pista: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.px(10),
      color: theme.silencio,
      paddingLeft: spacing.xs,
    },
    texto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.sm,
      lineHeight: letra.px(22),
      color: theme.tinta,
    },
    // Solo el peso: cambiar ademas el color haria que el enfasis pareciera un
    // enlace, y en una hoja de ayuda no hay a donde ir.
    fuerte: { fontWeight: pesos.semibold },
    accion: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
    },
    accionTexto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.semibold,
      fontSize: letra.sm,
      color: theme.sobreAcento,
    },
  });
}
