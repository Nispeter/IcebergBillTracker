/**
 * Parser de cartola bancaria.
 *
 * **No lee archivos.** Recibe una matriz de celdas ya extraida y devuelve
 * movimientos. Leer un `.xls` binario BIFF8 necesita SheetJS, que es una
 * dependencia pesada y de plataforma; dejarla afuera mantiene a `core` puro y,
 * sobre todo, hace que todo esto se pueda probar en Node sin abrir un archivo.
 * La app hace `xlsx` → matriz y llama aca.
 *
 * El formato esta documentado en `docs/adr/0001-formato-cartola-banco-de-chile.md`,
 * escrito despues de inspeccionar 7 cartolas reales (280 movimientos). Los tres
 * hallazgos que condicionan el codigo:
 *
 * 1. **La fecha no trae ano.** Viene `DD/MM` y hay que derivarlo de la fecha de
 *    emision, restando uno cuando el mes de la fila es posterior.
 * 2. **El signo no esta en el numero** sino en la columna: `Cargos` es egreso,
 *    `Abonos` ingreso, las dos siempre positivas.
 * 3. **La primera y la ultima fila no son movimientos**: son `SALDO INICIAL` y
 *    `SALDO FINAL`, con fecha y saldo pero sin cargo ni abono.
 */

import { money, type Money } from '../money/index';
import { compareDates, plainDate, type PlainDate } from '../dates/index';

/** Lo que devuelve una hoja de calculo por celda, ya sin formato. */
export type Celda = string | number | null | undefined;
export type Matriz = readonly (readonly Celda[])[];

export interface MapeoDeColumnas {
  /** Indice de la fila del encabezado dentro de la matriz. */
  readonly filaEncabezado: number;
  readonly fecha: number;
  readonly descripcion: number;
  readonly canal: number | null;
  readonly cargos: number;
  readonly abonos: number;
  readonly saldo: number | null;
}

export interface MovimientoImportado {
  readonly ocurridoEn: PlainDate;
  readonly descripcion: string;
  readonly canal: string | null;
  /** Entero positivo. El signo lo da `tipo`. */
  readonly montoMinor: number;
  readonly tipo: 'gasto' | 'ingreso';
  /** Saldo corrido si la fila lo trae. El banco solo lo escribe una vez por dia. */
  readonly saldoMinor: number | null;
  /** Ver `claveDeDedupe`. Estable entre importaciones del mismo archivo. */
  readonly clave: string;
}

export interface CartolaLeida {
  readonly movimientos: readonly MovimientoImportado[];
  readonly emitidaEn: PlainDate;
  readonly saldoInicial: Money | null;
  readonly saldoFinal: Money | null;
  /**
   * Si `saldoInicial + abonos - cargos` da `saldoFinal`.
   *
   * `null` cuando la cartola no trae alguno de los dos saldos. Es la unica
   * comprobacion que dice si se leyo **todo** el archivo: un movimiento perdido
   * la rompe, y sin ella el error pasaria callado.
   */
  readonly cuadra: boolean | null;
}

export type ResultadoDeCartola =
  | { readonly ok: true; readonly cartola: CartolaLeida }
  | { readonly ok: false; readonly motivo: string };

/** Encabezados que delatan a una cartola de Banco de Chile. */
const ETIQUETAS = {
  fecha: ['fecha'],
  descripcion: ['descripcion', 'descripción', 'detalle'],
  canal: ['canal o sucursal', 'canal', 'sucursal'],
  cargos: ['cargos', 'cargo', 'cargos (pesos)'],
  abonos: ['abonos', 'abono', 'abonos (pesos)'],
  saldo: ['saldo', 'saldo (pesos)'],
} as const;

function texto(celda: Celda): string {
  return typeof celda === 'string' ? celda.trim() : celda == null ? '' : String(celda);
}

function normalizar(celda: Celda): string {
  return texto(celda).toLowerCase().replace(/\s+/g, ' ');
}

/** El indice de la primera columna cuyo encabezado empieza con alguna etiqueta. */
function buscarColumna(fila: readonly Celda[], etiquetas: readonly string[]): number | null {
  for (let i = 0; i < fila.length; i += 1) {
    const valor = normalizar(fila[i]);
    if (valor !== '' && etiquetas.some((e) => valor.startsWith(e))) return i;
  }
  return null;
}

/** Cuantas filas se miran buscando el encabezado antes de rendirse. */
const MAX_FILAS_DE_BUSQUEDA = 60;

/**
 * Encuentra el encabezado y de que columna sale cada campo.
 *
 * Se **busca** en vez de fijar la fila 25, que es donde esta en las siete
 * cartolas que se inspeccionaron. Fijarla haria que el importador se rompiera
 * con el primer archivo que traiga una linea de mas en el bloque de metadatos, y
 * buscarla no cuesta nada.
 */
export function detectarMapeo(matriz: Matriz): MapeoDeColumnas | null {
  const hasta = Math.min(matriz.length, MAX_FILAS_DE_BUSQUEDA);
  for (let f = 0; f < hasta; f += 1) {
    const fila = matriz[f];
    if (fila === undefined) continue;

    const fecha = buscarColumna(fila, ETIQUETAS.fecha);
    const descripcion = buscarColumna(fila, ETIQUETAS.descripcion);
    const cargos = buscarColumna(fila, ETIQUETAS.cargos);
    const abonos = buscarColumna(fila, ETIQUETAS.abonos);
    // Sin las cuatro no hay tabla de movimientos que valga: una fila con
    // "Fecha" suelta en los metadatos no alcanza.
    if (fecha === null || descripcion === null || cargos === null || abonos === null) continue;

    return {
      filaEncabezado: f,
      fecha,
      descripcion,
      cargos,
      abonos,
      canal: buscarColumna(fila, ETIQUETAS.canal),
      saldo: buscarColumna(fila, ETIQUETAS.saldo),
    };
  }
  return null;
}

const FECHA_LARGA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const FECHA_CORTA = /^(\d{1,2})\/(\d{1,2})$/;

/** `" 30/01/2026"` → PlainDate. El banco la manda con un espacio adelante. */
export function parsearFechaDeEmision(celda: Celda): PlainDate | null {
  const partes = FECHA_LARGA.exec(texto(celda));
  if (partes === null) return null;
  try {
    return plainDate(Number(partes[3]), Number(partes[2]), Number(partes[1]));
  } catch {
    return null;
  }
}

/** Busca `Fecha de Emision` en cualquier parte del bloque de metadatos. */
export function buscarFechaDeEmision(matriz: Matriz, hasta: number): PlainDate | null {
  for (let f = 0; f < Math.min(matriz.length, hasta); f += 1) {
    const fila = matriz[f];
    if (fila === undefined) continue;
    for (let c = 0; c < fila.length; c += 1) {
      if (!normalizar(fila[c]).startsWith('fecha de emision')
        && !normalizar(fila[c]).startsWith('fecha de emisión')) continue;
      // El valor puede estar en la celda siguiente o mas alla, con vacias en medio.
      for (let d = c + 1; d < fila.length; d += 1) {
        const fecha = parsearFechaDeEmision(fila[d]);
        if (fecha !== null) return fecha;
      }
    }
  }
  return null;
}

/**
 * El ano de una fila `DD/MM`, derivado de la emision.
 *
 * Una cartola emitida el 30/01/2026 puede traer filas de diciembre: si el mes de
 * la fila es **posterior** al de emision, es del ano anterior. Es el caso real de
 * `cartola_30012026.xls`, cuya primera fila es `30/12`.
 */
export function anoDeFila(mesDeLaFila: number, emision: PlainDate): number {
  const anoEmision = Number(emision.slice(0, 4));
  const mesEmision = Number(emision.slice(5, 7));
  return mesDeLaFila > mesEmision ? anoEmision - 1 : anoEmision;
}

function parsearFechaDeFila(celda: Celda, emision: PlainDate): PlainDate | null {
  const crudo = texto(celda);
  const largas = FECHA_LARGA.exec(crudo);
  if (largas !== null) {
    try {
      return plainDate(Number(largas[3]), Number(largas[2]), Number(largas[1]));
    } catch {
      return null;
    }
  }

  const cortas = FECHA_CORTA.exec(crudo);
  if (cortas === null) return null;
  const mes = Number(cortas[2]);
  try {
    return plainDate(anoDeFila(mes, emision), mes, Number(cortas[1]));
  } catch {
    return null;
  }
}

function numero(celda: Celda): number | null {
  if (typeof celda === 'number') return Number.isFinite(celda) ? celda : null;
  const crudo = texto(celda).replace(/[$\s ]/g, '').replace(/\./g, '');
  if (crudo === '' || !/^-?\d+$/.test(crudo)) return null;
  return Number(crudo);
}

/**
 * La clave con la que se reconoce un movimiento ya importado.
 *
 * Lleva un **ordinal de ocurrencia** y esa es la parte que importa. El plan
 * original deduplicaba por `fecha + monto + descripcion`, y hay un contraejemplo
 * real: `cartola_30042026.xls` trae dos veces
 * `13/04 | PAGO:MERCADOPAGO*CONCE | 3600`, que son dos compras distintas. Con la
 * clave vieja la segunda se descartaba en silencio y la base quedaba descuadrada
 * contra el banco.
 *
 * Sigue siendo idempotente: el mismo archivo produce los mismos ordinales,
 * porque el orden de las filas es estable.
 */
export function claveDeDedupe(
  ocurridoEn: PlainDate,
  descripcion: string,
  montoMinor: number,
  canal: string | null,
  ordinal: number,
): string {
  return [ocurridoEn, descripcion, String(montoMinor), canal ?? '', String(ordinal)].join('|');
}

/** Filas centinela: traen saldo pero no son movimientos. */
function esCentinela(descripcion: string): boolean {
  const limpia = descripcion.toLowerCase();
  return limpia.startsWith('saldo inicial') || limpia.startsWith('saldo final');
}

export function parsearCartola(matriz: Matriz, mapeoDado?: MapeoDeColumnas): ResultadoDeCartola {
  const mapeo = mapeoDado ?? detectarMapeo(matriz);
  if (mapeo === null) {
    return { ok: false, motivo: 'No se encontró la tabla de movimientos. ¿Es una cartola?' };
  }

  const emision = buscarFechaDeEmision(matriz, mapeo.filaEncabezado);
  if (emision === null) {
    return {
      ok: false,
      // Sin emision no hay como fechar `DD/MM`, y adivinar el ano seria peor que
      // fallar: dejaria movimientos con un ano corrido sin que nadie lo note.
      motivo: 'La cartola no trae fecha de emisión, y sin ella no se puede saber de qué año es cada fila.',
    };
  }

  const movimientos: MovimientoImportado[] = [];
  const vistos = new Map<string, number>();
  let saldoInicial: Money | null = null;
  let saldoFinal: Money | null = null;

  for (let f = mapeo.filaEncabezado + 1; f < matriz.length; f += 1) {
    const fila = matriz[f];
    if (fila === undefined) continue;

    const descripcion = texto(fila[mapeo.descripcion]);
    const fecha = parsearFechaDeFila(fila[mapeo.fecha], emision);
    const saldo = mapeo.saldo === null ? null : numero(fila[mapeo.saldo]);

    if (esCentinela(descripcion)) {
      if (saldo !== null) {
        if (saldoInicial === null) saldoInicial = money(saldo, 'CLP');
        else saldoFinal = money(saldo, 'CLP');
      }
      continue;
    }

    // Sin fecha o sin descripcion no es una fila de la tabla: son las vacias del
    // final y el pie legal que el banco deja en la primera columna.
    if (fecha === null || descripcion === '') continue;

    const cargo = numero(fila[mapeo.cargos]);
    const abono = numero(fila[mapeo.abonos]);
    const tipo = cargo !== null && cargo > 0 ? 'gasto' : 'ingreso';
    const monto = tipo === 'gasto' ? cargo : abono;
    if (monto === null || monto <= 0) continue;

    const canal = mapeo.canal === null ? null : texto(fila[mapeo.canal]) || null;
    const base = [fecha, descripcion, String(monto), canal ?? ''].join('|');
    const ordinal = vistos.get(base) ?? 0;
    vistos.set(base, ordinal + 1);

    movimientos.push({
      ocurridoEn: fecha,
      descripcion,
      canal,
      montoMinor: monto,
      tipo,
      saldoMinor: saldo,
      clave: claveDeDedupe(fecha, descripcion, monto, canal, ordinal),
    });
  }

  if (movimientos.length === 0) {
    return { ok: false, motivo: 'La cartola no tiene movimientos.' };
  }

  return {
    ok: true,
    cartola: {
      movimientos,
      emitidaEn: emision,
      saldoInicial,
      saldoFinal,
      cuadra: comprobarCuadratura(movimientos, saldoInicial, saldoFinal),
    },
  };
}

/**
 * Si el saldo declarado cuadra con la suma de lo leido.
 *
 * Es lo unico que avisa de un movimiento perdido. Sin esto, un parser que se
 * saltara una fila devolveria un resultado que se ve bien.
 */
export function comprobarCuadratura(
  movimientos: readonly MovimientoImportado[],
  saldoInicial: Money | null,
  saldoFinal: Money | null,
): boolean | null {
  if (saldoInicial === null || saldoFinal === null) return null;
  const neto = movimientos.reduce(
    (suma, m) => suma + (m.tipo === 'ingreso' ? m.montoMinor : -m.montoMinor),
    saldoInicial.amountMinor,
  );
  return neto === saldoFinal.amountMinor;
}

/** El rango que cubre la cartola, para mostrarlo en la vista previa. */
export function rangoDe(movimientos: readonly MovimientoImportado[]): {
  desde: PlainDate;
  hasta: PlainDate;
} | null {
  if (movimientos.length === 0) return null;
  const fechas = movimientos.map((m) => m.ocurridoEn).sort(compareDates);
  return { desde: fechas[0]!, hasta: fechas[fechas.length - 1]! };
}
