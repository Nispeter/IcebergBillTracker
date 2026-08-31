/**
 * Formato y parseo de montos en es-CL.
 *
 * Todo el formateo de dinero de la app pasa por aca: si una pantalla arma el
 * string a mano, tarde o temprano una cifra queda con separador distinto o con
 * el signo en el lugar equivocado.
 */

import { money, type CurrencyCode, type Money } from './money';

/**
 * Intl con es-CL pone el signo despues del simbolo (`$-45.000`), que se lee mal
 * en una columna de cifras. Se formatea el valor absoluto y el signo se antepone
 * a mano para obtener `−$45.000`.
 */

/**
 * El menos de verdad (U+2212), no el guion del teclado.
 *
 * En monoespaciada la diferencia se ve: el guion es mas corto y va mas alto, y
 * en una columna de montos se nota que unos numeros estan pegados a un signo
 * distinto que otros. Estas funciones son de **presentacion** —ya ponen el `$`
 * y los separadores de miles— asi que el signo tambien es cosa suya.
 *
 * Si alguna vez hay que escribir montos a un archivo (el CSV de F4), eso **no**
 * pasa por aca: va el entero crudo, que es lo que otro programa sabe leer.
 */
const MENOS = '\u2212';
const currencyFormatters = new Map<CurrencyCode, Intl.NumberFormat>();
const plainFormatters = new Map<CurrencyCode, Intl.NumberFormat>();

function currencyFormatter(currency: CurrencyCode): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CL', { style: 'currency', currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
}

function plainFormatter(currency: CurrencyCode): Intl.NumberFormat {
  let formatter = plainFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
    });
    plainFormatters.set(currency, formatter);
  }
  return formatter;
}

/** `$45.000`, `−$45.000`, `$0`. */
export function format(value: Money): string {
  const body = currencyFormatter(value.currency).format(Math.abs(value.amountMinor));
  return value.amountMinor < 0 ? `${MENOS}${body}` : body;
}

/**
 * Igual que `format` pero siempre con signo explicito: `+$45.000` / `−$45.000`.
 * Para deltas contra el periodo anterior, donde el `+` es informacion.
 */
export function formatSigned(value: Money): string {
  if (value.amountMinor === 0) return format(value);
  const body = currencyFormatter(value.currency).format(Math.abs(value.amountMinor));
  return value.amountMinor < 0 ? `${MENOS}${body}` : `+${body}`;
}

/**
 * Solo la cifra agrupada, sin simbolo: `45.000`.
 * Para cuando la UI muestra el `$` como elemento aparte.
 */
export function formatNumber(value: Money): string {
  const parts = plainFormatter(value.currency).formatToParts(Math.abs(value.amountMinor));
  const body = parts
    .filter((part) => part.type === 'integer' || part.type === 'group' || part.type === 'decimal' || part.type === 'fraction')
    .map((part) => part.value)
    .join('');
  return value.amountMinor < 0 ? `${MENOS}${body}` : body;
}

/**
 * Parsea lo que un usuario escribe en es-CL: `$12.345`, `12.345`, `12345`, `-$12.345`.
 *
 * Devuelve `null` en vez de lanzar, porque el caso normal es un campo de texto a
 * medio escribir. Rechaza decimales a proposito: CLP tiene exponente 0, y
 * aceptar `1.234,56` obligaria a redondear en silencio un dato que el usuario
 * cree exacto.
 *
 * Acepta los **dos** signos de resta: el guion del teclado, que es lo que
 * cualquiera escribe, y el menos tipografico que devuelve `format`. Si solo
 * aceptara uno, copiar una cifra de la pantalla y pegarla en un campo daria
 * `null`.
 */
export function parseMoney(input: string, currency: CurrencyCode = 'CLP'): Money | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const signMatch = /^([+\-\u2212])\s*/.exec(trimmed);
  const sign = signMatch?.[1] === '+' || signMatch === null ? 1 : -1;
  const rest = signMatch ? trimmed.slice(signMatch[0].length) : trimmed;

  // \s no cubre el espacio duro que Intl y varios teclados insertan.
  const digits = rest.replace(/[$\s  ]/g, '');
  if (digits === '') return null;

  // Grupos de miles separados por punto: el primero de 1 a 3 digitos, el resto
  // exactamente 3. Asi `1.234` vale y `1.5` no, en vez de leerse como 15.
  if (!/^\d{1,3}(\.\d{3})*$/.test(digits) && !/^\d+$/.test(digits)) return null;

  const amount = Number.parseInt(digits.replace(/\./g, ''), 10);
  if (!Number.isSafeInteger(amount)) return null;

  return money(sign * amount, currency);
}

/**
 * Agrupa en miles lo que se esta escribiendo, **sin cambiar lo que vale**.
 *
 * Es solo presentacion: el campo del monto muestra `1.250.000` mientras la
 * persona teclea, en vez de `1250000`, que a partir del quinto digito hay que
 * contar con el dedo para saber si son cien mil o un millon. Lo que se guarda
 * sigue saliendo de `parseMoney`, que ya sabe leer los puntos.
 *
 * Descarta todo lo que no sea digito --puntos incluidos-- y vuelve a agrupar
 * desde cero. Eso es lo que hace que funcione al **borrar**: quitar un digito de
 * `1.250` deja `1.25`, que reagrupado es `125` y no un numero con el separador
 * en un lugar imposible.
 *
 * Los ceros a la izquierda se van (`007` -> `7`), pero un `0` solo se queda:
 * mientras se escribe, borrarle el cero al campo seria escribir por la persona.
 * Y la cadena vacia devuelve vacia, para que el campo se pueda dejar en blanco.
 *
 * El signo de adelante se conserva. No lo necesita el monto de un movimiento
 * --que es siempre positivo y el gasto o ingreso lo dice el selector-- pero si
 * el saldo inicial de una tarjeta de credito, que arranca debiendo.
 */
export function agruparMientrasSeEscribe(entrada: string): string {
  const signo = /^\s*([+\-−])/.exec(entrada)?.[1] ?? '';
  const digitos = entrada.replace(/\D/g, '');
  if (digitos === '') return signo === '' ? '' : signo;

  const sinCeros = digitos.replace(/^0+(?=\d)/, '');
  // De atras hacia adelante: el ultimo grupo es el que puede quedar incompleto.
  return signo + sinCeros.replace(/\B(?=(\d{3})+$)/g, '.');
}
