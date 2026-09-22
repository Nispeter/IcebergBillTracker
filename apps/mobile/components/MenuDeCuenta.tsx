/**
 * Elegir que cuenta se esta mirando, en una burbuja bajo las tres rayitas.
 *
 * ## Un toque, no tres
 *
 * Antes eran tres: las rayitas abrian una bandeja desde abajo, la bandeja tenia
 * adentro una tarjeta, y la tarjeta habia que tocarla otra vez para que se
 * desplegara la lista. Tres toques y dos superficies nuevas para elegir entre
 * dos nombres. Ahora la burbuja **es** la lista, colgada del boton que la abrio.
 *
 * La bandeja tenia sentido cuando adentro vivian tambien los seis destinos; esos
 * se mudaron a la barra de abajo hace rato y lo que quedo no daba para una hoja
 * a pantalla completa.
 *
 * ## No usa `ConDesplegable`
 *
 * Que es el desplegable de toda la app, pero sus tres supuestos no calzan aca:
 * abre el panel **a lo ancho del disparador**, y las rayitas miden 44 px; su
 * raiz vive en `capas.desplegable`, por debajo del encabezado y sin forma de
 * ganarle a la barra de abajo; y toda su logica de darse vuelta hacia arriba
 * sobra en un boton pegado al techo de la pantalla. Darle un ancho propio y una
 * capa propia seria agregarle dos ramas a un componente que usan siete lugares
 * para un caso que no comparte nada con ellos. Lo que si se le copia es la idea
 * buena: medir con `measureInWindow`, que devuelve coordenadas de **ventana** y
 * no del padre.
 *
 * ## Por que se monta desde el layout
 *
 * Por lo mismo que se montaba la bandeja: la barra de abajo es hermana del
 * contenedor del Stack y lleva `zIndex` explicito, y un hermano con `zIndex` le
 * gana a otro sin el por mas alto que sea el numero adentro de su propia rama.
 * Cualquier cosa colgada de `Pantalla` queda pintada debajo de la barra.
 *
 * Montada aca hay un segundo beneficio: el padre de la burbuja es una vista a
 * pantalla completa, asi que nunca se dibuja fuera de los limites de su padre.
 * En Android eso es la diferencia entre que los toques lleguen o no.
 *
 * ## El velo es transparente
 *
 * Cierra al tocar fuera, que es lo unico que hacia falta del velo de la bandeja.
 * Oscurecer la pantalla detras es justo lo que volvia popup a la bandeja: la
 * burbuja tiene que leerse como algo colgado del boton, no como una pantalla
 * nueva. De paso el velo tapa la barra de abajo, asi que con el menu abierto no
 * se navega por accidente y la medicion del boton nunca queda vieja.
 */

import {
  capas, elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { Check } from 'phosphor-react-native/src/icons/Check';
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer } from './Aparecer';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';
import { useLetra } from '../datos/letra';

/** Lo que se muestra cuando el alcance son todas juntas. */
const TODAS = 'Todas las cuentas';

/** Lo que la burbuja se separa del boton que la abrio. */
const AIRE = 6;

/** Angosta se lee como un menu contextual; ancha, como una pantalla. */
const ANCHO_MINIMO = 200;
const ANCHO_MAXIMO = 280;

/** Donde quedo el boton, en coordenadas de ventana. */
export interface Ancla {
  readonly x: number;
  readonly y: number;
  readonly alto: number;
}

const Contexto = createContext<(ancla: Ancla) => void>(() => {});

/** Abre el menu bajo el boton medido. Lo llaman las rayitas del encabezado. */
export function useAbrirMenuDeCuenta(): (ancla: Ancla) => void {
  return useContext(Contexto);
}

export function ProveedorDeMenuDeCuenta(
  { theme, children }: { theme: Theme; children: ReactNode },
) {
  const [ancla, setAncla] = useState<Ancla | null>(null);
  const abrir = useCallback((donde: Ancla) => setAncla(donde), []);
  // Una sola suscripcion a las cuentas para el proveedor y para la burbuja: si
  // cada uno llamara a `useCuentas`, cualquier escritura sobre la tabla
  // dispararia la consulta dos veces.
  const cuentas = useCuentas();
  const { width, height } = useWindowDimensions();

  /**
   * Cerrar cuando cambia el tamaño de la ventana.
   *
   * El ancla se mide una vez, al tocar. En web el marco esta centrado con un
   * ancho maximo, asi que agrandar el navegador mueve las rayitas mientras la
   * burbuja se queda en las coordenadas viejas: queda flotando despegada del
   * boton. Cerrarla es mas honesto que dibujarla en el lugar equivocado.
   */
  useEffect(() => setAncla(null), [width, height]);

  return (
    <Contexto.Provider value={abrir}>
      {children}
      {/* `box-none` y no `none`: la capa esta siempre montada para que la
          burbuja tenga de donde colgar, pero con el menu cerrado no hay ningun
          hijo que tocar y el toque sigue de largo hasta la app. */}
      <View style={styles.capa} pointerEvents="box-none">
        {ancla === null ? null : (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAncla(null)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        )}
        <Burbuja
          theme={theme}
          cuentas={cuentas}
          ancla={ancla}
          onCerrar={() => setAncla(null)}
        />
      </View>
    </Contexto.Provider>
  );
}

function Burbuja(
  { theme, cuentas, ancla, onCerrar }: {
    theme: Theme;
    cuentas: readonly { id: string; nombre: string }[];
    /** `null` mientras esta cerrada. */
    ancla: Ancla | null;
    onCerrar: () => void;
  },
) {
  const { cuentaId, elegir } = useCuentaActiva();
  const letra = useLetra();
  const margenes = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const estilos = crearEstilos(theme, letra);

  /**
   * Las coordenadas sobreviven al cierre.
   *
   * `Aparecer` deja la burbuja montada mientras se desvanece, y sin esto el
   * ancla ya seria `null` a esa altura: la burbuja saltaria a la esquina de
   * arriba a la izquierda durante los 160 ms de la salida.
   */
  const [ultima, setUltima] = useState<Ancla | null>(null);
  useEffect(() => { if (ancla !== null) setUltima(ancla); }, [ancla]);

  const donde = ancla ?? ultima;
  if (donde === null || cuentas.length < 2) return null;

  const arranca = donde.y + donde.alto + AIRE;
  const opciones: { valor: string | null; etiqueta: string }[] = [
    { valor: null, etiqueta: TODAS },
    ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <Aparecer
      visible={ancla !== null}
      estilo={[estilos.burbuja, { top: arranca, left: donde.x }]}
    >
      {/* El techo sale de lo que hay y no de un numero fijo: con muchas cuentas
          la lista tiene que desplazarse en vez de pasarse por el pie. */}
      <ScrollView style={{ maxHeight: Math.max(height - arranca - margenes.bottom - AIRE, 0) }}>
        {opciones.map((opcion) => {
          const elegida = opcion.valor === cuentaId;
          return (
            <Pressable
              key={opcion.valor ?? 'todas'}
              onPress={() => { elegir(opcion.valor); onCerrar(); }}
              style={({ pressed }) => [estilos.opcion, pressed && estilos.opcionApretada]}
              accessibilityRole="button"
              accessibilityState={{ selected: elegida }}
              accessibilityLabel={`Ver ${opcion.etiqueta}`}
            >
              <Text
                style={elegida ? estilos.opcionActiva : estilos.opcionTexto}
                numberOfLines={1}
              >
                {opcion.etiqueta}
              </Text>
              {elegida ? <Check size={12} weight="bold" color={theme.acentoTexto} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Aparecer>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: capas.lateral },
});

function crearEstilos(theme: Theme, letra: Letra) {
  return StyleSheet.create({
    /**
     * En `superficie` y con borde, igual que el resto de los paneles flotantes.
     *
     * Sin sombra: no hay una sola en toda la app, y sobre la noche polar una
     * sombra negra no se ve. Lo que separa es el borde. El radio es el de los
     * demas paneles --`sm`, no `md`-- porque una burbuja mas redonda que todo lo
     * que flota al lado se lee como de otra app.
     *
     * `overflow: 'hidden'` para que el gris de la fila apretada no se pinte por
     * encima de las esquinas redondeadas.
     */
    burbuja: {
      position: 'absolute',
      minWidth: ANCHO_MINIMO,
      maxWidth: ANCHO_MAXIMO,
      backgroundColor: theme.superficie,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      overflow: 'hidden',
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    opcionApretada: { opacity: 0.6 },
    opcionTexto: {
      flex: 1,
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      color: theme.silencioHondo,
    },
    opcionActiva: {
      flex: 1,
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.xs,
      color: theme.tinta,
    },
  });
}
