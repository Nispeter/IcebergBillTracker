import { describe, expect, it } from 'vitest';
import { categories, dates, money } from '@iceberg/core';
import { RECURRENTES, SALDO_INICIAL, seasonalFactor } from './catalog';
import { gastoPorCategoria, generateSeed, saldoActual, totalOf } from './generate';

const FIN = dates.requirePlainDate('2026-08-18');
const dataset = generateSeed({ endDate: FIN });

/** Los meses (1-12) que cubre el dataset, en orden. */
const mesesDelRango = dates
  .eachDate(dataset.range)
  .map((fecha) => dates.month(fecha))
  .filter((mes, i, todos) => todos[i - 1] !== mes);

describe('determinismo', () => {
  it('la misma semilla produce exactamente el mismo dataset', () => {
    const a = generateSeed({ endDate: FIN, seed: 42 });
    const b = generateSeed({ endDate: FIN, seed: 42 });
    expect(a).toEqual(b);
  });

  it('semillas distintas producen datasets distintos', () => {
    const a = generateSeed({ endDate: FIN, seed: 1 });
    const b = generateSeed({ endDate: FIN, seed: 2 });
    expect(a.transactions).not.toEqual(b.transactions);
  });
});

describe('forma del dataset', () => {
  it('cubre 18 meses completos por defecto', () => {
    expect(dataset.range.start).toBe('2025-03-01');
    expect(dataset.range.end).toBe('2026-08-31');
  });

  it('respeta la cantidad de meses pedida', () => {
    const corto = generateSeed({ endDate: FIN, months: 3 });
    expect(corto.range.start).toBe('2026-06-01');
    expect(corto.range.end).toBe('2026-08-31');
  });

  it('rechaza una cantidad de meses invalida', () => {
    expect(() => generateSeed({ endDate: FIN, months: 0 })).toThrow();
    expect(() => generateSeed({ endDate: FIN, months: 1.5 })).toThrow();
  });

  it('toda transaccion cae dentro del rango declarado', () => {
    for (const tx of dataset.transactions) {
      expect(dates.containsDate(dataset.range, tx.occurredAt)).toBe(true);
    }
  });

  it('viene ordenado por fecha', () => {
    const fechas = dataset.transactions.map((tx) => tx.occurredAt);
    expect([...fechas].sort(dates.compareDates)).toEqual(fechas);
  });

  it('los ids son unicos', () => {
    const ids = dataset.transactions.map((tx) => tx.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('categorias', () => {
  it('cubre las doce categorias del catalogo', () => {
    expect(dataset.categories).toEqual(categories.CATEGORY_IDS);
  });

  it('las declara en el orden canonico, no en el de aparicion', () => {
    const canonico = categories.CATEGORY_IDS.filter((id) => dataset.categories.includes(id));
    expect(dataset.categories).toEqual(canonico);
  });

  it('toda categoria usada existe en el catalogo', () => {
    for (const tx of dataset.transactions) {
      if (tx.category === undefined) continue;
      expect(categories.isCategoryId(tx.category), `${tx.name} -> ${tx.category}`).toBe(true);
    }
  });

  it('todo gasto lleva categoria', () => {
    for (const tx of dataset.transactions) {
      if (tx.type !== 'gasto') continue;
      expect(tx.category, `${tx.id} ${tx.name}`).toBeDefined();
    }
  });

  it('ningun ingreso lleva categoria: el ingreso no se categoriza', () => {
    for (const tx of dataset.transactions) {
      if (tx.type !== 'ingreso') continue;
      expect(tx.category, `${tx.id} ${tx.name}`).toBeUndefined();
    }
  });

  it('el streaming queda en Servicios, junto a la luz y el internet', () => {
    for (const nombre of ['Netflix', 'Spotify', 'Enel', 'VTR Internet']) {
      const tx = dataset.transactions.find((t) => t.name === nombre);
      expect(tx?.category, nombre).toBe('servicios');
    }
  });

  it('el arriendo va a Vivienda, separado de Servicios', () => {
    const arriendo = dataset.transactions.find((tx) => tx.name === 'Arriendo');
    expect(arriendo?.category).toBe('vivienda');
  });

  it('gastoPorCategoria suma el total del gasto y viene de mayor a menor', () => {
    const porCategoria = gastoPorCategoria(dataset.transactions);
    const suma = money.sum(porCategoria.map((fila) => fila.total));
    expect(suma.amountMinor).toBe(totalOf(dataset, 'gasto').amountMinor);

    const montos = porCategoria.map((fila) => fila.total.amountMinor);
    expect([...montos].sort((a, b) => b - a)).toEqual(montos);
  });

  it('vivienda es la categoria mas pesada del hogar', () => {
    expect(gastoPorCategoria(dataset.transactions)[0]?.categoria).toBe('vivienda');
  });
});

describe('montos', () => {
  it('todos son enteros positivos: nunca un float representa dinero', () => {
    for (const tx of dataset.transactions) {
      expect(Number.isInteger(tx.amountMinor), `${tx.id} ${tx.amountMinor}`).toBe(true);
      expect(tx.amountMinor).toBeGreaterThan(0);
    }
  });

  it('todos son CLP', () => {
    for (const tx of dataset.transactions) expect(tx.currency).toBe('CLP');
  });

  it('el ingreso supera al gasto', () => {
    expect(totalOf(dataset, 'ingreso').amountMinor)
      .toBeGreaterThan(totalOf(dataset, 'gasto').amountMinor);
  });

  it('el ahorro real es creible una vez contado el aporte a inversion', () => {
    // El aporte a fondo mutuo sale de la cuenta, asi que el neto lo cuenta como
    // gasto. El ahorro de verdad es lo que sobra mas lo que se invirtio.
    const ingreso = totalOf(dataset, 'ingreso');
    const neto = money.subtract(ingreso, totalOf(dataset, 'gasto'));
    const invertido = money.sum(
      dataset.transactions.filter((tx) => tx.category === 'ahorros').map((tx) => money.money(tx.amountMinor)),
    );
    const tasa = money.ratio(money.add(neto, invertido), ingreso);
    expect(tasa).not.toBeNull();
    expect(tasa!).toBeGreaterThan(0.05);
    expect(tasa!).toBeLessThan(0.30);
  });

  it('el sueldo mensual esta en el orden de magnitud de un sueldo chileno', () => {
    for (const sueldo of dataset.transactions.filter((tx) => tx.name === 'Sueldo')) {
      expect(sueldo.amountMinor).toBeGreaterThan(1_400_000);
      expect(sueldo.amountMinor).toBeLessThan(1_560_000);
    }
  });
});

describe('plata restante', () => {
  it('parte del saldo inicial declarado', () => {
    expect(dataset.saldoInicialMinor).toBe(SALDO_INICIAL);
  });

  it('es saldo inicial mas ingresos menos gastos', () => {
    const esperado = SALDO_INICIAL
      + totalOf(dataset, 'ingreso').amountMinor
      - totalOf(dataset, 'gasto').amountMinor;
    expect(saldoActual(dataset).amountMinor).toBe(esperado);
  });

  it('queda en un rango plausible para una cuenta corriente', () => {
    const saldo = saldoActual(dataset);
    expect(saldo.amountMinor).toBeGreaterThan(0);
    expect(saldo.amountMinor).toBeLessThan(3_000_000);
  });

  it('sin movimientos es exactamente el saldo inicial', () => {
    const vacio = { ...dataset, transactions: [] };
    expect(saldoActual(vacio).amountMinor).toBe(SALDO_INICIAL);
  });
});

describe('recurrentes', () => {
  const mensuales = RECURRENTES.filter((spec) => spec.months === undefined);

  it('cada regla mensual genera una ocurrencia por mes', () => {
    for (const spec of mensuales) {
      const ocurrencias = dataset.transactions.filter((tx) => tx.name === spec.name);
      expect(ocurrencias, spec.name).toHaveLength(18);
      expect(ocurrencias.every((tx) => tx.recurring), spec.name).toBe(true);
    }
  });

  it('las reglas que no son mensuales solo caen en sus meses', () => {
    for (const spec of RECURRENTES) {
      if (spec.months === undefined) continue;
      const ocurrencias = dataset.transactions.filter((tx) => tx.name === spec.name);
      expect(ocurrencias.length, spec.name).toBeGreaterThan(0);
      for (const tx of ocurrencias) {
        expect(spec.months, `${spec.name} en ${tx.occurredAt}`).toContain(dates.month(tx.occurredAt));
      }
      const esperadas = mesesDelRango.filter((mes) => spec.months!.includes(mes)).length;
      expect(ocurrencias, spec.name).toHaveLength(esperadas);
    }
  });

  it('el permiso de circulacion es una vez al ano, no un gasto fijo mensual', () => {
    const permisos = dataset.transactions.filter((tx) => tx.name === 'Permiso de circulacion');
    expect(permisos).toHaveLength(2);
    for (const permiso of permisos) expect(dates.month(permiso.occurredAt)).toBe(3);
  });

  it('caen en el dia de la regla, recortado si el mes es mas corto', () => {
    const sueldos = dataset.transactions.filter((tx) => tx.name === 'Sueldo');
    for (const sueldo of sueldos) {
      const esperado = Math.min(30, dates.daysInMonth(dates.year(sueldo.occurredAt), dates.month(sueldo.occurredAt)));
      expect(dates.day(sueldo.occurredAt), sueldo.occurredAt).toBe(esperado);
    }
    // Febrero solo tiene 28 dias: el sueldo del 30 se corre al 28.
    const febrero = sueldos.find((tx) => dates.month(tx.occurredAt) === 2);
    expect(dates.day(febrero!.occurredAt)).toBe(28);
  });

  it('el arriendo es fijo todos los meses', () => {
    const montos = new Set(
      dataset.transactions.filter((tx) => tx.name === 'Arriendo').map((tx) => tx.amountMinor),
    );
    expect(montos).toEqual(new Set([450_000]));
  });

  it('el gasto variable no queda marcado como recurrente y trae comercio', () => {
    const variables = dataset.transactions.filter((tx) => !tx.recurring);
    expect(variables.length).toBeGreaterThan(0);
    expect(variables.every((tx) => tx.merchant !== undefined)).toBe(true);
  });
});

describe('estacionalidad', () => {
  /**
   * Gasto promedio de una categoria en un mes del calendario, normalizado por
   * la cantidad de veces que ese mes aparece.
   *
   * La normalizacion importa: el rango va de marzo 2025 a agosto 2026, asi que
   * mayo aparece dos veces y diciembre una sola. Comparar los totales crudos
   * diria que mayo gasta el doble, que es un artefacto del rango y no un dato.
   */
  const promedioPorMes = (categoria: string, mes: number, semillas: number) => {
    let total = 0;
    let instancias = 0;
    for (let semilla = 1; semilla <= semillas; semilla++) {
      const ds = semilla === 0 ? dataset : generateSeed({ endDate: FIN, seed: semilla });
      instancias += mesesDelRango.filter((m) => m === mes).length;
      for (const tx of ds.transactions) {
        if (tx.category === categoria && dates.month(tx.occurredAt) === mes) {
          total += tx.amountMinor;
        }
      }
    }
    return instancias === 0 ? 0 : total / instancias;
  };

  it('los servicios de invierno superan claramente a los de verano', () => {
    // Los servicios son recurrentes: una boleta al mes, 18 muestras limpias y un
    // factor de 2,3 en julio contra 1,0 en enero. Basta una semilla.
    const julio = promedioPorMes('servicios', 7, 1);
    const enero = promedioPorMes('servicios', 1, 1);
    expect(julio).toBeGreaterThan(enero * 1.3);
  });

  it('diciembre gasta mas en comida que mayo', () => {
    // Se mide sobre comida y no sobre regalos porque comida trae ~10 movimientos
    // al mes: con ~1 al mes la varianza se come el efecto y el test mediria el
    // sorteo en vez del modelo. Varias semillas para tener senal de verdad.
    const diciembre = promedioPorMes('comida', 12, 8);
    const mayo = promedioPorMes('comida', 5, 8);
    expect(diciembre).toBeGreaterThan(mayo * 1.25);
  });

  it('la estacionalidad se reparte entre frecuencia y monto', () => {
    // El reparto es la raiz del factor en cada mitad, de modo que el producto
    // siga siendo el factor declarado.
    const spec = { seasonal: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.8] } as const;
    expect(seasonalFactor(spec, 12)).toBeCloseTo(1.8, 5);
    expect(Math.sqrt(seasonalFactor(spec, 12)) ** 2).toBeCloseTo(1.8, 5);
    expect(seasonalFactor(spec, 5)).toBe(1);
  });

  it('sin estacionalidad declarada el factor es neutro', () => {
    expect(seasonalFactor({}, 1)).toBe(1);
    expect(seasonalFactor({}, 12)).toBe(1);
  });
});

describe('sesgo de fin de semana', () => {
  it('el delivery cae mas en fin de semana que en dia de semana', () => {
    const delivery = dataset.transactions.filter(
      (tx) => tx.merchant === 'PedidosYa' || tx.merchant === 'Rappi' || tx.merchant === 'Uber Eats',
    );
    const finDeSemana = delivery.filter((tx) => dates.weekday(tx.occurredAt) >= 5).length;
    // Viernes a domingo son 3 de 7 dias: sin sesgo daria ~43%.
    expect(finDeSemana / delivery.length).toBeGreaterThan(0.55);
  });
});
