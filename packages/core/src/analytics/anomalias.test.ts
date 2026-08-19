import { describe, expect, it } from 'vitest';
import { anomaliasAltasPorGrupo, detectarAnomalias, dispersionRobusta, zRobusto } from './anomalias';

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

describe('anomaliasAltasPorGrupo', () => {
  /**
   * Treinta cafes de ~$3.000 y ocho arriendos de ~$450.000.
   *
   * La proporcion importa: con diez y diez la mediana del monton cae justo entre
   * los dos grupos y la MAD se dispara, asi que **nada** sale anomalo ni siquiera
   * sin agrupar. Es el mismo efecto que hace inservible agrupar por categoria,
   * visto desde el otro lado.
   */
  const items = [
    ...Array.from({ length: 30 }, (_, i) => ({ tipo: 'cafe', monto: 2800 + i * 20 })),
    ...Array.from({ length: 8 }, (_, i) => ({ tipo: 'arriendo', monto: 448000 + i * 500 })),
  ];
  const clave = (x: { tipo: string }) => x.tipo;
  const valor = (x: { monto: number }) => x.monto;

  it('no marca al grande solo por ser grande: se compara con sus pares', () => {
    expect(anomaliasAltasPorGrupo(items, clave, valor)).toHaveLength(0);
    // Y sin agrupar, cada arriendo se sale de lo normal del monton entero.
    expect(detectarAnomalias(items, valor).length).toBeGreaterThan(0);
  });

  it('marca al que se sale dentro de su propio grupo', () => {
    const conRaro = [...items, { tipo: 'cafe', monto: 40000 }];
    const salida = anomaliasAltasPorGrupo(conRaro, clave, valor);
    expect(salida).toHaveLength(1);
    expect(salida[0]!.item.monto).toBe(40000);
  });

  it('ignora las bajas: un gasto sospechosamente chico no es noticia', () => {
    const conBarato = [...items, { tipo: 'arriendo', monto: 1000 }];
    expect(anomaliasAltasPorGrupo(conBarato, clave, valor)).toHaveLength(0);
  });

  it('un grupo cuyos montos son todos iguales no marca nada: la MAD es cero', () => {
    const fijos = Array.from({ length: 12 }, () => ({ tipo: 'arriendo', monto: 450000 }));
    expect(anomaliasAltasPorGrupo(fijos, clave, valor)).toHaveLength(0);
  });

  it('un grupo con menos de cinco datos no marca nada', () => {
    const pocos = [
      { tipo: 'x', monto: 100 }, { tipo: 'x', monto: 100 },
      { tipo: 'x', monto: 100 }, { tipo: 'x', monto: 9999 },
    ];
    expect(anomaliasAltasPorGrupo(pocos, clave, valor)).toHaveLength(0);
  });

  it('viene ordenado de la mas rara a la menos rara', () => {
    const conDos = [
      ...items,
      { tipo: 'cafe', monto: 40000 },
      { tipo: 'arriendo', monto: 900000 },
    ];
    const salida = anomaliasAltasPorGrupo(conDos, clave, valor);
    expect(salida).toHaveLength(2);
    expect(salida[0]!.z).toBeGreaterThanOrEqual(salida[1]!.z);
  });
});
