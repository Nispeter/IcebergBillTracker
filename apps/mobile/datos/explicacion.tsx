/**
 * Una sola hoja para todas las explicaciones de la app.
 *
 * Cada `i` pide que se muestre; la hoja vive una vez, al final del árbol, y se
 * dibuja encima de todo sin pelear el apilado (las burbujas absolutas de antes
 * se dibujaban detrás según el ancestro de turno).
 *
 * El pingüino la cuenta de a un párrafo si así se eligió en Ajustes, y tocar
 * adelanta: una animación que no se puede saltar molesta a la segunda vez, y
 * las explicaciones se releen.
 */

import { elevation, radii, spacing } from '@iceberg/ui';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Boton } from '../components/Boton';
import { DialogoDelPinguino, enParrafos } from '../components/DialogoDelPinguino';
import { Hoja } from '../components/Hoja';
import { useMovimientoReducido } from './animacion';
import { useExplicacionDeAPoco } from './consultas';
import { useEstilos, type Estilo } from './estilos';

/**
 * Cuánto tarda el pingüino en decir un párrafo: proporcional al largo, con
 * tope. Es el ritmo de una conversación, no la velocidad de lectura.
 */
function cuantoTarda(parrafo: string): number {
  return Math.min(1400, 300 + parrafo.length * 7);
}

/** El respiro entre un párrafo y el siguiente. */
const PAUSA = 180;

/**
 * Lo que se puede hacer desde la explicación. Casi ninguna lo lleva; sí la de
 * "no estás en el período actual", donde explicar y arreglar son la misma frase.
 */
interface AccionDeExplicacion {
  readonly etiqueta: string;
  alTocar(): void;
}

/** Muestra una explicación. El título es el de la sección que la pidió. */
type Explicar = (titulo: string, texto: string, accion?: AccionDeExplicacion) => void;

const Contexto = createContext<Explicar>(() => {});

export function useExplicar(): Explicar {
  return useContext(Contexto);
}

/** Lo que tarda un punto en subir y bajar, el desfase entre puntos y el respiro de la ola. */
const SALTO = 200;
const RETRASO = 140;
const RESPIRO = 240;

/**
 * Los tres puntitos de "estoy escribiendo": dicen que viene más, para que nadie
 * cierre la hoja creyendo que el primer párrafo era todo.
 */
function Escribiendo() {
  const styles = useEstilos(crearEstilos);
  const quieto = useMovimientoReducido();
  const primero = useRef(new Animated.Value(0)).current;
  const segundo = useRef(new Animated.Value(0)).current;
  const tercero = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (quieto) return undefined;
    // Todos duran lo mismo aunque arranquen desfasados, o el desfase se pierde
    // en la vuelta siguiente.
    const largo = (RETRASO * 2) + (SALTO * 2) + RESPIRO;
    const salto = (valor: Animated.Value, retraso: number) => Animated.sequence([
      Animated.delay(retraso),
      Animated.timing(valor, { toValue: 1, duration: SALTO, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(valor, { toValue: 0, duration: SALTO, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(largo - retraso - (SALTO * 2)),
    ]);
    const ola = Animated.loop(Animated.parallel([
      salto(primero, 0),
      salto(segundo, RETRASO),
      salto(tercero, RETRASO * 2),
    ]));
    ola.start();
    return () => ola.stop();
  }, [primero, segundo, tercero, quieto]);

  return (
    <View style={styles.escribiendo} accessibilityLabel="El pingüino sigue contando">
      {[primero, segundo, tercero].map((valor, indice) => (
        <Animated.View
          // eslint-disable-next-line react/no-array-index-key
          key={indice}
          style={[styles.punto, {
            opacity: valor.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }]}
        />
      ))}
    </View>
  );
}

export function ProveedorDeExplicacion({ children }: { children: ReactNode }) {
  const styles = useEstilos(crearEstilos);
  const [abierta, setAbierta] = useState<
    { titulo: string; texto: string; accion?: AccionDeExplicacion } | null
  >(null);

  const explicar = useCallback<Explicar>(
    (titulo, texto, accion) => setAbierta({ titulo, texto, accion }),
    [],
  );

  const { deAPoco } = useExplicacionDeAPoco();
  const texto = abierta?.texto;
  const parrafos = useMemo(() => enParrafos(texto ?? ''), [texto]);
  /** Cuántas burbujas ya se dijeron. */
  const [dichas, setDichas] = useState(0);
  const [hablando, setHablando] = useState(false);
  const faltan = dichas < parrafos.length;

  // Abrir otra explicación vuelve a la primera burbuja; el texto es lo que las distingue.
  useEffect(() => {
    if (texto === undefined) { setDichas(0); return; }
    setDichas(deAPoco ? 1 : enParrafos(texto).length);
  }, [texto, deAPoco]);

  // La línea de tiempo en un solo efecto: habla lo que dure el párrafo, calla,
  // y tras la pausa aparece el siguiente. Con dos temporizadores el pico quedaba
  // moviéndose sobre una burbuja ya terminada.
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
      <Hoja abierta={abierta !== null} titulo={abierta?.titulo ?? ''} onCerrar={() => setAbierta(null)}>
        {/* Toda el área adelanta: el gesto de la impaciencia es tocar en cualquier parte. */}
        <Pressable
          onPress={() => setDichas(parrafos.length)}
          disabled={!faltan}
          accessibilityRole={faltan ? 'button' : undefined}
          accessibilityLabel={faltan ? 'Ver la explicación completa' : undefined}
        >
          <DialogoDelPinguino
            parrafos={parrafos.slice(0, dichas)}
            hablando={hablando}
            pie={!faltan ? null : (
              <>
                <Escribiendo />
                <Text style={styles.pista}>toca para verlo todo</Text>
              </>
            )}
          />
        </Pressable>

        {/* Cierra la hoja al tocarla: lo que explicaba deja de ser cierto. */}
        {abierta?.accion === undefined ? null : (
          <Boton
            variante="principal"
            etiqueta={abierta.accion.etiqueta}
            onPress={() => { abierta.accion?.alTocar(); setAbierta(null); }}
            estilo={styles.accion}
          />
        )}
      </Hoja>
    </Contexto.Provider>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    // Angosta: una burbuja vacía del porte de un párrafo parecería un mensaje que no cargó.
    escribiendo: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: theme.superficieHonda,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    punto: { width: 5, height: 5, borderRadius: radii.full, backgroundColor: theme.silencio },
    pista: { ...t.nota, paddingLeft: spacing.xs },
    accion: { marginTop: spacing.lg },
  });
}
