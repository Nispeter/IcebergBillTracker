/**
 * El Excel de cada cuenta compartida, en el modo planilla: armarlo, leerlo, y
 * la pasada que los mantiene al día. Qué se escribe y cómo se entiende lo
 * editado vive en `db/repositorios/planilla`, donde se prueba sin archivos.
 *
 * El archivo tiene dos hojas:
 *
 * - **Movimientos**, la que se ve y se edita. Las dos últimas columnas (id y
 *   huella) van ocultas: con ellas la app reconoce qué fila es cuál y si alguien
 *   la cambió.
 * - **_iceberg**, oculta: la cuenta y los ids que había al escribirla, para
 *   saber qué filas borró alguien.
 *
 * Excel y no CSV porque Google Sheets edita un Excel en el mismo archivo; un
 * CSV lo convierte en una planilla aparte y el archivo original no cambia.
 */

import {
  COLUMNAS_DE_PLANILLA, aplicarPlanilla, cuentasConPlanilla, filasDePlanilla, planillaAlDia,
  type BaseDeDatos, type Contexto, type Cuenta, type FilaEscrita, type FilaLeida, type PlanillaLeida,
} from '@iceberg/db';
import * as XLSX from 'xlsx';
import { escribirPlanilla, leerPlanilla, listarPlanillas } from './carpeta';

const HOJA = 'Movimientos';
const HOJA_OCULTA = '_iceberg';
const ENCABEZADO = [...COLUMNAS_DE_PLANILLA, 'id', 'huella'];

/** El nombre del archivo. Lleva el final del id: dos cuentas pueden llamarse igual. */
export function nombreDePlanilla(cuenta: Cuenta): string {
  const limpio = cuenta.nombre.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Cuenta';
  return `${limpio} (${cuenta.id.slice(-4)}).xlsx`;
}

// ──────────────────────────── el archivo ────────────────────────────

/** Días desde el 30 de diciembre de 1899: así guardan las fechas Excel y Sheets. */
function serialDeFecha(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return (Date.UTC(anio!, mes! - 1, dia!) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export function armarLibro(cuentaId: string, filas: readonly FilaEscrita[]): string {
  const hoja = XLSX.utils.aoa_to_sheet([
    ENCABEZADO,
    ...filas.map((f) => [f.fecha, f.descripcion, f.tipo, f.monto, f.categoria, f.notas, f.id, f.huella]),
  ]);
  // La fecha como fecha y el monto como número: así Sheets los ordena y suma.
  filas.forEach((fila, i) => {
    hoja[XLSX.utils.encode_cell({ r: i + 1, c: 0 })] = { t: 'n', v: serialDeFecha(fila.fecha), z: 'dd-mm-yyyy' };
    hoja[XLSX.utils.encode_cell({ r: i + 1, c: 3 })] = { t: 'n', v: fila.monto, z: '#,##0' };
  });
  hoja['!cols'] = [
    { wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 24 },
    { hidden: true }, { hidden: true },
  ];

  const oculta = XLSX.utils.aoa_to_sheet([['cuenta', cuentaId], ...filas.map((f) => ['id', f.id])]);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, HOJA);
  XLSX.utils.book_append_sheet(libro, oculta, HOJA_OCULTA);
  libro.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  // Comprimido: sin esto pesa cinco veces más, y FolderSync lo sube entero.
  return XLSX.write(libro, { type: 'base64', bookType: 'xlsx', compression: true }) as string;
}

/** Sin tildes ni mayúsculas: el encabezado se busca por nombre, aunque alguien mueva las columnas. */
function normalizar(texto: unknown): string {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Una celda de fecha llega como número de serie; una escrita como texto, tal cual. */
function fechaDeCelda(celda: unknown): unknown {
  if (typeof celda !== 'number') return celda;
  const fecha = XLSX.SSF.parse_date_code(celda);
  if (!fecha) return celda;
  return `${fecha.y}-${String(fecha.m).padStart(2, '0')}-${String(fecha.d).padStart(2, '0')}`;
}

/**
 * Lee una planilla. `null` si no se entiende: puede estar a medio bajar, y
 * entonces se deja para la pasada siguiente en vez de tomarla por vacía.
 */
export function leerLibro(base64: string, cuentaEsperada: string): PlanillaLeida | null {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(base64, { type: 'base64' });
  } catch {
    return null;
  }

  const nombre = libro.SheetNames.includes(HOJA)
    ? HOJA
    : libro.SheetNames.find((n) => n !== HOJA_OCULTA);
  const hoja = nombre === undefined ? undefined : libro.Sheets[nombre];
  if (hoja === undefined) return null;

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
    header: 1, raw: true, defval: null, blankrows: false,
  });
  const encabezado = (matriz[0] ?? []).map(normalizar);
  const columna = (titulo: string) => encabezado.indexOf(normalizar(titulo));
  const [fecha, descripcion, tipo, monto, categoria, notas, id, huella] = ENCABEZADO.map(columna);
  if (fecha === -1 || descripcion === -1 || monto === -1) return null;

  const celda = (fila: unknown[], indice: number | undefined) => (
    indice === undefined || indice === -1 ? null : fila[indice]
  );
  const filas: FilaLeida[] = matriz.slice(1).map((fila) => ({
    fecha: fechaDeCelda(celda(fila, fecha)),
    descripcion: celda(fila, descripcion),
    tipo: celda(fila, tipo),
    monto: celda(fila, monto),
    categoria: celda(fila, categoria),
    notas: celda(fila, notas),
    id: celda(fila, id),
    huella: celda(fila, huella),
  }));

  // Sin la hoja oculta no se sabe qué había: se toman las correcciones y lo
  // nuevo, pero nada se da por borrado.
  const oculta = libro.Sheets[HOJA_OCULTA];
  if (oculta === undefined) return { cuentaId: cuentaEsperada, idsEscritos: [], filas };
  const datos = XLSX.utils.sheet_to_json<unknown[]>(oculta, { header: 1, raw: true });
  const cuentaId = datos.find((f) => f[0] === 'cuenta')?.[1];
  return {
    cuentaId: typeof cuentaId === 'string' ? cuentaId : null,
    idsEscritos: datos.filter((f) => f[0] === 'id' && typeof f[1] === 'string').map((f) => f[1] as string),
    filas,
  };
}

// ───────────────────────────── la pasada ─────────────────────────────

export interface PasadaPorPlanillas {
  /** Filas agregadas, corregidas o borradas en las planillas que llegaron a la base. */
  readonly aplicados: number;
  /** Filas que no se entendieron. Mientras haya, esa planilla no se reescribe. */
  readonly ilegibles: number;
}

interface Recuerdo {
  /** El archivo como quedó la última vez que se escribió o se leyó. */
  readonly base64: string;
  /** El contenido de la base en ese momento. */
  readonly contenido: string;
  /** Las filas que se escribieron, para no reescribir lo mismo. */
  readonly filas: string;
  /** Tiene filas que no se entienden: no se pisa hasta que alguien la arregle. */
  readonly trabada: boolean;
}

/** En memoria: al abrir la app, la primera pasada lee todas las planillas. */
const recuerdos = new Map<string, Recuerdo>();

function ceder(): Promise<void> {
  return new Promise((listo) => setTimeout(listo, 0));
}

/**
 * Lee lo que cambió en las planillas, lo lleva a la base y las deja al día.
 *
 * `contenido` es el de la base ahora (`contenidoPropio`): si ni él ni el
 * archivo cambiaron desde la última vez, esa planilla no se toca. Es el caso de
 * casi todas las pasadas, que corren cada minuto.
 *
 * `alTrabajar` avisa antes de hacer algo que cueste, para mostrar que se está
 * sincronizando.
 */
export async function pasarPorPlanillas(
  db: BaseDeDatos,
  contexto: Contexto,
  carpeta: string,
  contenido: string,
  alTrabajar: () => void,
): Promise<PasadaPorPlanillas> {
  const cuentas = cuentasConPlanilla(db, contexto);
  if (cuentas.length === 0) return { aplicados: 0, ilegibles: 0 };

  const existentes = await listarPlanillas(carpeta);
  let aplicados = 0;
  let ilegibles = 0;

  for (const cuenta of cuentas) {
    await ceder();
    const nombre = nombreDePlanilla(cuenta);
    const clave = carpeta + '\n' + nombre;
    const donde = existentes.get(nombre) ?? null;
    const base64 = donde === null ? null : await leerPlanilla(carpeta, donde);
    const recuerdo = recuerdos.get(clave);
    const archivoIgual = base64 !== null && recuerdo?.base64 === base64;
    if (archivoIgual && (recuerdo.trabada || recuerdo.contenido === contenido)) continue;

    alTrabajar();
    let leida: PlanillaLeida | null = null;
    if (base64 !== null && !archivoIgual) {
      leida = leerLibro(base64, cuenta.id);
      if (leida === null) continue;
      const cambios = aplicarPlanilla(db, contexto, cuenta.id, leida);
      aplicados += cambios.nuevas + cambios.editadas + cambios.borradas;
      if (cambios.ilegibles > 0) {
        // Reescribirla borraría lo que alguien está escribiendo a medias.
        ilegibles += cambios.ilegibles;
        recuerdos.set(clave, { base64, contenido, filas: '', trabada: true });
        continue;
      }
    }

    const filas = filasDePlanilla(db, contexto, cuenta.id);
    const filasEnTexto = JSON.stringify(filas);
    const alDia = leida !== null
      ? planillaAlDia(filas, leida)
      : archivoIgual && recuerdo.filas === filasEnTexto;
    if (alDia && base64 !== null) {
      recuerdos.set(clave, { base64, contenido, filas: filasEnTexto, trabada: false });
      continue;
    }

    const nuevo = armarLibro(cuenta.id, filas);
    await escribirPlanilla(carpeta, nombre, nuevo, donde);
    recuerdos.set(clave, { base64: nuevo, contenido, filas: filasEnTexto, trabada: false });
  }

  return { aplicados, ilegibles };
}
