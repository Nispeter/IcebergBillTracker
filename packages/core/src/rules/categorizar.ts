/**
 * Adivinar la categoria a partir de la descripcion del banco.
 *
 * Importar 280 movimientos sin esto deja 280 filas sin categoria, y
 * categorizarlas a mano es trabajo que nadie hace. Con esto, la mayoria llega
 * clasificada y el usuario solo corrige lo que quedo mal.
 *
 * **Devuelve `null` cuando no sabe.** Es la decision que sostiene el modulo: una
 * categoria inventada es peor que ninguna, porque ensucia todas las metricas de
 * F2 —la torta, la deriva, el comprometido— sin que nadie sospeche. Sin
 * categoria, la fila se ve rara y se arregla.
 *
 * El catalogo es de comercios **chilenos** y esta hecho a mano. Se prefirio eso
 * a algo generico porque las descripciones de cartola vienen truncadas a 34
 * caracteres y llenas de prefijos del banco: no hay nada que inferir, hay que
 * reconocer nombres.
 */

import type { CategoryId } from '../categories/index';

export interface ReglaDeCategoria {
  /** Se busca como subcadena dentro de la descripcion normalizada. */
  readonly patron: string;
  /**
   * `string` y no `CategoryId`.
   *
   * Las reglas que trae la app apuntan siempre al catalogo, pero las que
   * escribe el usuario pueden apuntar a una categoria **propia** del hogar, y
   * esas no estan en la union. Aca el id no se interpreta: entra por un lado y
   * sale por el otro.
   */
  readonly categoriaId: string;
}

/**
 * Prefijos que el banco antepone y que no dicen nada del comercio.
 *
 * Se sacan antes de comparar para que `PAGO:LIDER` y `COMPRA LIDER` lleguen los
 * dos a `lider`.
 */
const PREFIJOS = [
  'pago:', 'pago ', 'compra ', 'cargo ', 'giro ', 'transferencia ',
  'transf ', 'abono ', 'suscripcion ', 'suscripción ',
];

/** Minusculas, sin tildes, sin prefijos del banco y sin espacios de sobra. */
export function normalizar(descripcion: string): string {
  let texto = descripcion
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Puede haber mas de uno encadenado: "PAGO: COMPRA LIDER".
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const prefijo of PREFIJOS) {
      if (texto.startsWith(prefijo)) {
        texto = texto.slice(prefijo.length).trim();
        cambio = true;
      }
    }
  }
  return texto;
}

/**
 * Catalogo de comercios chilenos.
 *
 * El orden en que estan escritos **no importa**: `categorizar` elige el patron
 * mas largo que calce. Asi `uber eats` le gana a `uber` sin depender de que
 * alguien recuerde ponerlo antes al agregar una regla nueva.
 *
 * **Hay variantes abreviadas a proposito.** La cartola trunca la descripcion
 * alrededor de los 22 caracteres, asi que llegan cosas como `C VERDE IRARRAZAV`
 * o `STA ISABEL SARGEN`: un patron `cruz verde` no calzaria nunca. Las
 * abreviaturas salieron de medir el catalogo contra las 280 filas reales.
 */
export const REGLAS_CHILE: readonly ReglaDeCategoria[] = [
  // Supermercados y comida
  { patron: 'lider', categoriaId: 'comida' },
  { patron: 'jumbo', categoriaId: 'comida' },
  { patron: 'santa isabel', categoriaId: 'comida' },
  { patron: 'sta isabel', categoriaId: 'comida' },
  { patron: 'tottus', categoriaId: 'comida' },
  { patron: 'unimarc', categoriaId: 'comida' },
  { patron: 'acuenta', categoriaId: 'comida' },
  { patron: 'ekono', categoriaId: 'comida' },
  { patron: 'uber eats', categoriaId: 'comida' },
  { patron: 'pedidosya', categoriaId: 'comida' },
  { patron: 'rappi', categoriaId: 'comida' },
  { patron: 'justo', categoriaId: 'comida' },
  { patron: 'starbucks', categoriaId: 'comida' },
  { patron: 'doggis', categoriaId: 'comida' },
  { patron: 'juan maestro', categoriaId: 'comida' },
  { patron: 'mc donalds', categoriaId: 'comida' },
  { patron: 'mcdonalds', categoriaId: 'comida' },
  { patron: 'burger king', categoriaId: 'comida' },
  { patron: 'cafe', categoriaId: 'comida' },
  { patron: 'minimercado', categoriaId: 'comida' },
  { patron: 'panaderia', categoriaId: 'comida' },
  { patron: 'gastronomia', categoriaId: 'comida' },

  // Transporte
  { patron: 'uber', categoriaId: 'transporte' },
  { patron: 'didi', categoriaId: 'transporte' },
  { patron: 'cabify', categoriaId: 'transporte' },
  { patron: 'copec', categoriaId: 'transporte' },
  { patron: 'shell', categoriaId: 'transporte' },
  { patron: 'petrobras', categoriaId: 'transporte' },
  { patron: 'aramco', categoriaId: 'transporte' },
  { patron: 'bip', categoriaId: 'transporte' },
  { patron: 'metro', categoriaId: 'transporte' },
  { patron: 'autopista', categoriaId: 'transporte' },
  { patron: 'costanera norte', categoriaId: 'transporte' },
  { patron: 'tag ', categoriaId: 'transporte' },

  // Servicios basicos, telecomunicaciones y streaming
  { patron: 'enel', categoriaId: 'servicios' },
  { patron: 'cge', categoriaId: 'servicios' },
  { patron: 'saesa', categoriaId: 'servicios' },
  { patron: 'aguas andinas', categoriaId: 'servicios' },
  { patron: 'essbio', categoriaId: 'servicios' },
  { patron: 'esval', categoriaId: 'servicios' },
  { patron: 'nuevosur', categoriaId: 'servicios' },
  { patron: 'lipigas', categoriaId: 'servicios' },
  { patron: 'abastible', categoriaId: 'servicios' },
  { patron: 'gasco', categoriaId: 'servicios' },
  { patron: 'metrogas', categoriaId: 'servicios' },
  { patron: 'vtr', categoriaId: 'servicios' },
  { patron: 'movistar', categoriaId: 'servicios' },
  { patron: 'entel', categoriaId: 'servicios' },
  { patron: 'claro', categoriaId: 'servicios' },
  { patron: 'wom', categoriaId: 'servicios' },
  { patron: 'gtd', categoriaId: 'servicios' },
  { patron: 'mundo pacifico', categoriaId: 'servicios' },
  { patron: 'netflix', categoriaId: 'servicios' },
  { patron: 'spotify', categoriaId: 'servicios' },
  { patron: 'disney', categoriaId: 'servicios' },
  { patron: 'hbo', categoriaId: 'servicios' },
  { patron: 'prime video', categoriaId: 'servicios' },
  { patron: 'youtube', categoriaId: 'servicios' },

  // Salud
  { patron: 'farmacia', categoriaId: 'salud' },
  { patron: 'cruz verde', categoriaId: 'salud' },
  { patron: 'c verde', categoriaId: 'salud' },
  { patron: 'salcobrand', categoriaId: 'salud' },
  { patron: 'ahumada', categoriaId: 'salud' },
  { patron: 'megasalud', categoriaId: 'salud' },
  { patron: 'integramedica', categoriaId: 'salud' },
  { patron: 'redsalud', categoriaId: 'salud' },
  { patron: 'isapre', categoriaId: 'salud' },
  { patron: 'fonasa', categoriaId: 'salud' },
  { patron: 'clinica', categoriaId: 'salud' },
  { patron: 'optica', categoriaId: 'salud' },

  // Vivienda
  { patron: 'arriendo', categoriaId: 'vivienda' },
  { patron: 'gastos comunes', categoriaId: 'vivienda' },
  { patron: 'sodimac', categoriaId: 'vivienda' },
  { patron: 'easy', categoriaId: 'vivienda' },
  { patron: 'construmart', categoriaId: 'vivienda' },
  { patron: 'dividendo', categoriaId: 'vivienda' },

  // Deudas y creditos
  { patron: 'cuota credito', categoriaId: 'deudas' },
  { patron: 'avance', categoriaId: 'deudas' },
  { patron: 'credito de consumo', categoriaId: 'deudas' },
  { patron: 'tarjeta de credito', categoriaId: 'deudas' },
  { patron: 'linea de credi', categoriaId: 'deudas' },
  // La comision del banco no es ninguna de las doce categorias con comodidad.
  // Va en servicios porque es el costo de un servicio contratado, no una compra.
  { patron: 'comision', categoriaId: 'servicios' },

  // Impuestos y obligaciones
  { patron: 'tesoreria', categoriaId: 'impuestos' },
  { patron: 'sii ', categoriaId: 'impuestos' },
  { patron: 'contribuciones', categoriaId: 'impuestos' },
  { patron: 'permiso de circulacion', categoriaId: 'impuestos' },
  { patron: 'municipalidad', categoriaId: 'impuestos' },
  { patron: 'dev impuesto', categoriaId: 'impuestos' },

  // Ahorro e inversion
  { patron: 'fondo mutuo', categoriaId: 'ahorros' },
  { patron: 'apv', categoriaId: 'ahorros' },
  { patron: 'deposito a plazo', categoriaId: 'ahorros' },
  { patron: 'racional', categoriaId: 'ahorros' },
  { patron: 'fintual', categoriaId: 'ahorros' },
  { patron: 'banchile corredores', categoriaId: 'ahorros' },
  { patron: 'corredores de bolsa', categoriaId: 'ahorros' },

  // Trabajo
  { patron: 'hosting', categoriaId: 'trabajo' },
  { patron: 'dominio', categoriaId: 'trabajo' },
  { patron: 'aws', categoriaId: 'trabajo' },
  { patron: 'google cloud', categoriaId: 'trabajo' },
  { patron: 'github', categoriaId: 'trabajo' },
  { patron: 'anthropic', categoriaId: 'trabajo' },
  { patron: 'claude.ai', categoriaId: 'trabajo' },
  { patron: 'openai', categoriaId: 'trabajo' },
  { patron: 'vercel', categoriaId: 'trabajo' },
  { patron: 'digitalocean', categoriaId: 'trabajo' },

  // Compras personales
  { patron: 'mercadopago', categoriaId: 'personales' },
  { patron: 'mercado libre', categoriaId: 'personales' },
  { patron: 'falabella', categoriaId: 'personales' },
  { patron: 'paris', categoriaId: 'personales' },
  { patron: 'ripley', categoriaId: 'personales' },
  { patron: 'cinemark', categoriaId: 'personales' },
  { patron: 'cinepolis', categoriaId: 'personales' },
  { patron: 'aliexpress', categoriaId: 'personales' },
  { patron: 'amazon', categoriaId: 'personales' },
  { patron: 'steam', categoriaId: 'personales' },

  // Familia
  { patron: 'colegio', categoriaId: 'familia' },
  { patron: 'veterinaria', categoriaId: 'familia' },
  { patron: 'jardin infantil', categoriaId: 'familia' },
  { patron: 'universidad', categoriaId: 'familia' },
];

/**
 * La categoria que corresponde a una descripcion, o `null` si no se reconoce.
 *
 * Gana **el patron mas largo** que calce, no el primero declarado: `uber eats`
 * es comida y `uber` a secas es transporte, y depender del orden del arreglo
 * seria una trampa esperando a la proxima regla que alguien agregue.
 */
export function categorizar(
  descripcion: string,
  reglas: readonly ReglaDeCategoria[] = REGLAS_CHILE,
): string | null {
  const texto = normalizar(descripcion);
  if (texto === '') return null;

  let mejor: ReglaDeCategoria | null = null;
  for (const regla of reglas) {
    if (!texto.includes(regla.patron)) continue;
    if (mejor === null || regla.patron.length > mejor.patron.length) mejor = regla;
  }
  return mejor?.categoriaId ?? null;
}

/** Cuantas de una lista quedarian categorizadas. Para la vista previa. */
export function cuantasReconoce(
  descripciones: readonly string[],
  reglas: readonly ReglaDeCategoria[] = REGLAS_CHILE,
): number {
  return descripciones.filter((d) => categorizar(d, reglas) !== null).length;
}
