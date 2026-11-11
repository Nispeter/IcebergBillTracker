/**
 * Cómo se arman los estilos de toda la app.
 *
 * Cada componente declara una fábrica `crearEstilos({ theme, letra, t })` y la
 * pide con `useEstilos(crearEstilos)`. El tema y el tamaño de letra salen del
 * contexto, así que nadie los recibe por props, y la hoja se arma una vez por
 * combinación de tema y letra: cien filas de una lista comparten la misma.
 *
 * `t` son los papeles del texto. Una pantalla pide un papel ("etiqueta",
 * "cifra"), no un tamaño suelto, y así un mismo papel se ve igual en todas.
 */

import { fonts, fontsNativas, pesos, type Letra, type Theme } from '@iceberg/ui';
import { Platform } from 'react-native';
import { useLetra } from './letra';
import { useTema } from './tema';

/** Android no entiende pilas CSS: ver `fontsNativas`. */
const familias = Platform.OS === 'web' ? fonts : fontsNativas;

type Peso = keyof typeof pesos;

function texto(fontSize: number, peso: Peso, color: string) {
  return { fontFamily: familias.texto, fontWeight: pesos[peso], fontSize, color };
}

function cifra(fontSize: number, peso: Peso, color: string) {
  return { fontFamily: familias.mono, fontWeight: pesos[peso], fontSize, color };
}

function crearTipos(theme: Theme, letra: Letra) {
  return {
    /** El nombre de una vista o de un formulario. */
    titulo: texto(letra.lg, 'semibold', theme.tinta),
    /** El encabezado de una hoja o de un bloque dentro de un formulario. */
    subtitulo: texto(letra.md, 'semibold', theme.tinta),
    /** El encabezado de una sección. */
    seccion: texto(letra.sm, 'semibold', theme.tinta),
    /** El renglón principal de una fila: el nombre de un movimiento o de una cuenta. */
    nombre: texto(letra.md, 'medium', theme.tinta),
    /** Texto corrido y opciones de una lista. */
    cuerpo: texto(letra.sm, 'regular', theme.tinta),
    /** Lo que nombra un dato o un campo. */
    etiqueta: texto(letra.xs, 'regular', theme.silencio),
    /** Aclaraciones bajo una fila o un campo. El piso de legibilidad de la app. */
    nota: texto(letra.px(11), 'regular', theme.silencio),
    /** Botones de texto y enlaces. */
    accion: texto(letra.xs, 'medium', theme.acentoTexto),
    /** Lo que va escrito sobre un botón relleno. */
    boton: texto(letra.sm, 'semibold', theme.sobreAcento),
    /** Lo que salió mal, junto a donde salió mal. */
    error: texto(letra.xs, 'medium', theme.vencidoTexto),
    /** Montos y fechas en filas y tablas: monoespaciada para que las columnas cuadren. */
    cifra: cifra(letra.xs, 'regular', theme.tinta),
    /** La cifra que encabeza una fila o un campo. */
    cifraGrande: cifra(letra.md, 'regular', theme.tinta),
    /** Las cifras dentro de un gráfico: ejes, celdas, porcentajes. */
    cifraDeGrafico: cifra(letra.px(10), 'regular', theme.silencio),
  } as const;
}

export type Tipos = ReturnType<typeof crearTipos>;

export interface Estilo {
  readonly theme: Theme;
  readonly letra: Letra;
  readonly t: Tipos;
}

const estilos = new WeakMap<Theme, WeakMap<Letra, Estilo>>();

function estiloPara(theme: Theme, letra: Letra): Estilo {
  let porLetra = estilos.get(theme);
  if (porLetra === undefined) {
    porLetra = new WeakMap();
    estilos.set(theme, porLetra);
  }
  let estilo = porLetra.get(letra);
  if (estilo === undefined) {
    estilo = { theme, letra, t: crearTipos(theme, letra) };
    porLetra.set(letra, estilo);
  }
  return estilo;
}

/** El tema, la letra y los papeles del texto vigentes. Misma identidad mientras no cambien. */
export function useEstilo(): Estilo {
  return estiloPara(useTema().theme, useLetra());
}

const hojas = new WeakMap<object, WeakMap<Estilo, unknown>>();

/** La hoja de estilos de un componente, armada una sola vez por tema y letra. */
export function useEstilos<T>(crear: (estilo: Estilo) => T): T {
  const estilo = useEstilo();
  let porEstilo = hojas.get(crear);
  if (porEstilo === undefined) {
    porEstilo = new WeakMap();
    hojas.set(crear, porEstilo);
  }
  let hoja = porEstilo.get(estilo) as T | undefined;
  if (hoja === undefined) {
    hoja = crear(estilo);
    porEstilo.set(estilo, hoja);
  }
  return hoja;
}
