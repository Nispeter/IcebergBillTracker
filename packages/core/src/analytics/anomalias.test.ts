import { describe, expect, it } from 'vitest';
import { detectarAnomalias, dispersionRobusta, zRobusto } from './anomalias';

describe('dispersionRobusta', () => {
  it('devuelve la mediana y la MAD escalada', () => {
    const d = dispersionRobusta([10, 20, 30, 40, 50]);
    expect(d.mediana).toBe(30);
    // Desviaciones: 20,10,0,10,20 → mediana 10 → 10 × 1,4826.
    expect(d.mad).toBeCloseTo(14.826, 3);
  });

  it('no la mueve un valor extremo', () => {
    // Es toda la razon de usar mediana y MAD: el promedio de esto es 200.030 y
    // la desviacion estandar unos 447.000, asi que el valor raro terminaria
    // pareciendo normal contra su propia influencia.
    const conRaro = dispersionRobusta([10, 20, 30, 40, 1_000_000]);
    expect(conRaro.mediana).toBe(30);
    expect(conRaro.mad).toBeCloseTo(14.826, 3);
  });

  it('todos iguales da MAD cero', () => {
    expect(dispersionRobusta([5, 5, 5, 5, 5]).mad).toBe(0);
  });
});

describe('zRobusto', () => {
  it('cuenta sigmas robustas desde la mediana', () => {
    const d = dispersionRobusta([10, 20, 30, 40, 50]);
    expect(zRobusto(30, d)).toBe(0);
    expect(zRobusto(44.826, d)).toBeCloseTo(1, 3);
  });

  it('con MAD cero devuelve null en vez de infinito', () => {
    // Mas de la mitad de los datos identicos: no hay dispersion contra la cual
    // medir, y cualquier numero seria mentira.
    expect(zRobusto(100, { mediana: 5, mad: 0 })).toBeNull();
  });
});

describe('detectarAnomalias', () => {
  const semana = (nombre: string, monto: number) => ({ nombre, monto });
  const monto = (s: { monto: number }) => s.monto;

  it('encuentra el gasto que se sale de lo normal', () => {
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000), semana('s6', 250_000),
    ];
    const anomalias = detectarAnomalias(semanas, monto);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]?.item.nombre).toBe('s6');
    expect(anomalias[0]?.esAlta).toBe(true);
    expect(anomalias[0]!.z).toBeGreaterThan(3);
  });

  it('tambien detecta una caida', () => {
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000), semana('s6', 1_000),
    ];
    const anomalias = detectarAnomalias(semanas, monto);
    expect(anomalias[0]?.item.nombre).toBe('s6');
    expect(anomalias[0]?.esAlta).toBe(false);
  });

  it('no marca nada cuando el gasto es parejo', () => {
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000), semana('s6', 53_000),
    ];
    expect(detectarAnomalias(semanas, monto)).toEqual([]);
  });

  it('con menos de cinco datos no afirma nada', () => {
    // Con tres semanas "lo normal" no esta definido y cualquier cosa pareceria
    // anomala. Devolver vacio es lo honesto.
    const pocas = [semana('s1', 10), semana('s2', 20), semana('s3', 5_000_000)];
    expect(detectarAnomalias(pocas, monto)).toEqual([]);
  });

  it('con todos los valores identicos no marca nada', () => {
    const iguales = Array.from({ length: 6 }, (_, i) => semana(`s${i}`, 50_000));
    expect(detectarAnomalias(iguales, monto)).toEqual([]);
  });

  it('ordena de mas anomalo a menos', () => {
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000),
      semana('grande', 300_000), semana('mediana', 150_000),
    ];
    const anomalias = detectarAnomalias(semanas, monto);
    expect(anomalias.map((a) => a.item.nombre)).toEqual(['grande', 'mediana']);
  });

  it('un umbral mas bajo marca mas cosas', () => {
    // Mediana 50.500 y MAD escalada ~2.224, asi que 55.000 esta a ~2 sigmas:
    // pasa el filtro de 3 y no el de 1,5.
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000), semana('s6', 55_000),
    ];
    expect(detectarAnomalias(semanas, monto, 3)).toHaveLength(0);
    expect(detectarAnomalias(semanas, monto, 1.5).length).toBeGreaterThan(0);
  });

  it('la MAD es chica cuando los datos estan agrupados, y eso es correcto', () => {
    // Contra un gasto semanal muy parejo, $70.000 ya son casi 9 sigmas. No es
    // un umbral mal calibrado: es que salirse de 48-52 mil de verdad destaca.
    const semanas = [
      semana('s1', 50_000), semana('s2', 52_000), semana('s3', 48_000),
      semana('s4', 51_000), semana('s5', 49_000), semana('s6', 70_000),
    ];
    const anomalias = detectarAnomalias(semanas, monto);
    expect(anomalias).toHaveLength(1);
    expect(anomalias[0]!.z).toBeGreaterThan(8);
  });
});
