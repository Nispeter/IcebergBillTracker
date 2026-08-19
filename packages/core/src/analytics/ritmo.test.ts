import { describe, expect, it } from 'vitest';
import { monthRange, requirePlainDate } from '../dates/index';
import { money } from '../money/index';
import type { MovimientoAnalizable } from './movimiento';
import { calcularRitmo, grosorDelHielo, seguroGastarHoy } from './ritmo';

const d = requirePlainDate;
const gasto = (fecha: string, monto: number): MovimientoAnalizable =>
  ({ tipo: 'gasto', montoMinor: monto, ocurridoEn: d(fecha) });

const AGOSTO = monthRange(2026, 8);

describe('calcularRitmo', () => {
  const parejo = [
    gasto('2026-08-01', 10_000),
    gasto('2026-08-05', 10_000),
    gasto('2026-08-10', 10_000),
  ];

  it('cuenta los dias transcurridos incluyendo hoy', () => {
    const r = calcularRitmo(parejo, AGOSTO, d('2026-08-10'));
    expect(r.diasTranscurridos).toBe(10);
    expect(r.diasDelRango).toBe(31);
    expect(r.diasRestantes).toBe(21);
  });

  it('solo cuenta el gasto hasta hoy, no el del resto del rango', () => {
    const conFuturo = [...parejo, gasto('2026-08-20', 500_000)];
    const r = calcularRitmo(conFuturo, AGOSTO, d('2026-08-10'));
    expect(r.gastadoHastaAhora.amountMinor).toBe(30_000);
  });

  it('proyecta linealmente al promedio diario', () => {
    // 30.000 en 10 dias = 3.000/dia; por 31 dias = 93.000.
    const r = calcularRitmo(parejo, AGOSTO, d('2026-08-10'));
    expect(r.promedioDiario.amountMinor).toBe(3_000);
    expect(r.proyeccionLineal.amountMinor).toBe(93_000);
  });

  it('con el rango ya terminado, transcurrio entero', () => {
    const r = calcularRitmo(parejo, AGOSTO, d('2026-09-15'));
    expect(r.diasTranscurridos).toBe(31);
    expect(r.diasRestantes).toBe(0);
    expect(r.gastadoHastaAhora.amountMinor).toBe(30_000);
  });

  it('sin historia previa no hay proyeccion por perfil', () => {
    // Es lo honesto: no se puede aprender el perfil de meses que no existen.
    expect(calcularRitmo(parejo, AGOSTO, d('2026-08-10')).proyeccionPorPerfil).toBeNull();
  });

  it('el perfil corrige la proyeccion cuando el gasto se carga al principio', () => {
    // Dos meses de historia en que el 80% del gasto se va antes del dia 10.
    const historia = [
      gasto('2026-06-05', 800_000), gasto('2026-06-25', 200_000),
      gasto('2026-07-05', 800_000), gasto('2026-07-25', 200_000),
    ];
    const actual = [gasto('2026-08-05', 800_000)];
    const r = calcularRitmo([...historia, ...actual], AGOSTO, d('2026-08-10'));

    // Lineal: 800.000 en 10 dias por 31 = 2.480.000, mas del triple de lo real.
    expect(r.proyeccionLineal.amountMinor).toBe(2_480_000);
    // Por perfil: al dia 10 suele haberse ido el 80%, asi que 800.000 / 0,8.
    expect(r.proyeccionPorPerfil?.amountMinor).toBe(1_000_000);
  });

  it('el mes en curso no contamina su propio perfil', () => {
    // Si se incluyera a si mismo, el perfil se acercaria a 1 y la proyeccion
    // por perfil colapsaria a "lo ya gastado".
    const historia = [gasto('2026-07-05', 800_000), gasto('2026-07-25', 200_000)];
    const r = calcularRitmo([...historia, gasto('2026-08-05', 800_000)], AGOSTO, d('2026-08-10'));
    expect(r.proyeccionPorPerfil?.amountMinor).toBe(1_000_000);
  });

  it('no proyecta por perfil cuando se conoce muy poco del mes', () => {
    // El dia 1 se conoce ~2% del mes; dividir por 0,02 multiplica el ruido
    // por 50 y el numero deja de significar algo.
    const historia = [
      gasto('2026-06-20', 500_000), gasto('2026-06-28', 500_000),
      gasto('2026-07-20', 500_000), gasto('2026-07-28', 500_000),
    ];
    const r = calcularRitmo([...historia, gasto('2026-08-01', 1_000)], AGOSTO, d('2026-08-01'));
    expect(r.proyeccionPorPerfil).toBeNull();
  });

  it('sin gasto todo queda en cero y no revienta', () => {
    const r = calcularRitmo([], AGOSTO, d('2026-08-10'));
    expect(r.gastadoHastaAhora.amountMinor).toBe(0);
    expect(r.promedioDiario.amountMinor).toBe(0);
    expect(r.proyeccionLineal.amountMinor).toBe(0);
  });
});

describe('grosorDelHielo', () => {
  it('divide el saldo por la quema diaria', () => {
    expect(grosorDelHielo(money(300_000), money(10_000))).toBe(30);
  });

  it('redondea hacia abajo: son los dias que aguanta de verdad', () => {
    expect(grosorDelHielo(money(35_000), money(10_000))).toBe(3);
  });

  it('sin quema devuelve null, no infinito', () => {
    // "Aguanta infinitos dias" no es un dato util; que no se este gastando, si.
    expect(grosorDelHielo(money(300_000), money(0))).toBeNull();
  });

  it('sin saldo aguanta cero dias', () => {
    expect(grosorDelHielo(money(0), money(10_000))).toBe(0);
    expect(grosorDelHielo(money(-5_000), money(10_000))).toBe(0);
  });
});

describe('seguroGastarHoy', () => {
  it('reparte lo que sobra entre los dias que quedan', () => {
    // 500.000 − 200.000 comprometido − 100.000 de meta = 200.000 en 10 dias.
    expect(seguroGastarHoy(money(500_000), money(200_000), money(100_000), 10).amountMinor)
      .toBe(20_000);
  });

  it('si no sobra nada, no se puede gastar nada', () => {
    expect(seguroGastarHoy(money(200_000), money(200_000), money(50_000), 10).amountMinor).toBe(0);
  });

  it('sin dias restantes devuelve cero en vez de dividir por cero', () => {
    expect(seguroGastarHoy(money(500_000), money(0), money(0), 0).amountMinor).toBe(0);
  });
});
