/**
 * Si el boton de agregar tiene que apartarse.
 *
 * El mas flota sobre el contenido, y flote donde flote tapa algo: a la derecha
 * la columna de montos, a la izquierda los nombres de categoria. Reservarle
 * aire abajo resuelve el final de la lista, no el medio: en Categorias el
 * circulo caia justo encima de "Familia" y "Trabajo".
 *
 * La salida es que se quite mientras uno **baja** —que es cuando esta leyendo—
 * y vuelva apenas frena o sube, que es cuando podria querer agregar algo.
 *
 * Vive aca arriba y no dentro de `Pantalla` por un motivo concreto: las
 * pantallas *renderizan* `Pantalla`, asi que son sus padres. Un proveedor puesto
 * ahi adentro no lo ve ninguna de ellas, y `useContext` devuelve siempre el
 * valor por defecto. Tiene que estar por encima de las dos partes: del scroll
 * que avisa y del boton que reacciona.
 */

import { AIRE_PARA_EL_FLOTANTE } from '@iceberg/ui';
import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Lo que hay que pasarle al scroll de una pantalla para que el mas reaccione. */
export interface PropsDeScroll {
  onScroll: (evento: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
}

interface Valor {
  readonly oculto: boolean;
  readonly props: PropsDeScroll;
  /** Vuelve a mostrarlo. Lo llama `Pantalla` al montarse: cada vista empieza arriba. */
  readonly reiniciar: () => void;
}

const APAGADO: Valor = {
  oculto: false,
  props: { onScroll: () => {}, scrollEventThrottle: 16 },
  reiniciar: () => {},
};

const Contexto = createContext<Valor>(APAGADO);

/** Cuanto hay que mover el dedo para que cuente. Menos que esto es rebote. */
const UMBRAL = 6;
/** Antes de este punto el mas nunca se esconde: arriba de todo no tapa nada. */
const ZONA_ALTA = 48;

export function ProveedorDeDesplazamiento({ children }: { children: ReactNode }) {
  const [oculto, setOculto] = useState(false);
  const ultimoY = useRef(0);

  const onScroll = useCallback((evento: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = evento.nativeEvent.contentOffset.y;
    const avance = y - ultimoY.current;
    if (Math.abs(avance) < UMBRAL) return;
    ultimoY.current = y;
    setOculto(avance > 0 && y > ZONA_ALTA);
  }, []);

  const reiniciar = useCallback(() => {
    ultimoY.current = 0;
    setOculto(false);
  }, []);

  const valor = useMemo(
    () => ({ oculto, props: { onScroll, scrollEventThrottle: 16 }, reiniciar }),
    [oculto, onScroll, reiniciar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Los props que conectan el scroll de una pantalla con el boton flotante.
 *
 * Va como `{...useDesplazamiento()}` sobre el `ScrollView` o `FlatList`. Una
 * pantalla que no lo use funciona igual, solo que el mas no se aparta.
 */
export function useDesplazamiento(): PropsDeScroll {
  return useContext(Contexto).props;
}

/**
 * Cuanto aire dejarle al final de una lista.
 *
 * `AIRE_PARA_EL_FLOTANTE` sola no alcanza: es una constante pensada para que el
 * boton no tape la ultima fila, y **no sabe nada de la barra de gestos**. En un
 * telefono que la tenga, el ultimo elemento queda debajo del sistema --se vio
 * con "Importar cartola" cortado por la barra-- porque la app dibuja a pantalla
 * completa.
 *
 * Va aca y no en cada pantalla para que sumar el margen del sistema no dependa
 * de acordarse seis veces.
 */
export function useAireInferior(): number {
  return AIRE_PARA_EL_FLOTANTE + useSafeAreaInsets().bottom;
}

/** Para `Pantalla`: si el mas esta escondido y como volver a mostrarlo. */
export function useEstadoDelFlotante(): { oculto: boolean; reiniciar: () => void } {
  const { oculto, reiniciar } = useContext(Contexto);
  return { oculto, reiniciar };
}
