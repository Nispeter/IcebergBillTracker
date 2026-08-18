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
 * a mano para obtener `-$45.000`.
 */
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

/** `$45.000`, `-$45.000`, `$0`. */
export function format(value: Money): string {
  const body = currencyFormatter(value.currency).format(Math.abs(value.amountMinor));
  return value.amountMinor < 0 ? `-${body}` : body;
}

/**
 * Igual que `format` pero siempre con signo explicito: `+$45.000` / `-$45.000`.
 * Para deltas contra el periodo anterior, donde el `+` es informacion.
 */
export function formatSigned(value: Money): string {
  if (value.amountMinor === 0) return format(value);
  const body = currencyFormatter(value.currency).format(Math.abs(value.amountMinor));
  return value.amountMinor < 0 ? `-${body}` : `+${body}`;
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
  return value.amountMinor < 0 ? `-${body}` : body;
}

/**
 * Parsea lo que un usuario escribe en es-CL: `$12.345`, `12.345`, `12345`, `-$12.345`.
 *
 * Devuelve `null` en vez de lanzar, porque el caso normal es un campo de texto a
 * medio escribir. Rechaza decimales a proposito: CLP tiene exponente 0, y
 * aceptar `1.234,56` obligaria a redondear en silencio un dato que el usuario
 * cree exacto.
 */
export function parseMoney(input: string, currency: CurrencyCode = 'CLP'): Money | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const signMatch = /^([+-])\s*/.exec(trimmed);
  const sign = signMatch?.[1] === '-' ? -1 : 1;
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
