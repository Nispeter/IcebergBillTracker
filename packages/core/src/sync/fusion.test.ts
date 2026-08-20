import { describe, expect, it } from 'vitest';
import {
  contarBorradas, fusionarTabla, ganadora, resumirFusion, type FilaSincronizable,
} from './fusion';

interface Fila extends FilaSincronizable {
  readonly nombre: string;
}

/** `updatedAt` con el ancho fijo del HLC: milis-contador-nodo. */
const hlc = (millis: number, contador = 0, nodo = 'a') =>
  `${String(millis).padStart(15, '0')}-${String(contador).padStart(5, '0')}-${nodo}`;

const fila = (id: string, millis: number, extra: Partial<Fila> = {}): Fila => ({
  id,
  updatedAt: hlc(millis),
  deletedAt: null,
  nombre: `fila ${id}`,
  ...extra,
});

describe('ganadora', () => {
  it('gana el que escribio despues', () => {
    expect(ganadora(fila('a', 1), fila('a', 2)).updatedAt).toBe(hlc(2));
    expect(ganadora(fila('a', 2), fila('a', 1)).updatedAt).toBe(hlc(2));
  });

  it('empata por reloj y desempata por id, igual en los dos lados', () => {
    // Sin desempate determinista dos replicas podrian elegir distinto y no
    // converger nunca.
    const x = { ...fila('x', 5), nombre: 'de un lado' };
    const y = { ...fila('y', 5), nombre: 'del otro' };
    expect(ganadora(x, y)).toBe(x);
    expect(ganadora(y, x)).toBe(x);
  });
});

describe('fusionarTabla', () => {
  it('trae lo que solo tiene el otro lado', () => {
    const { filas } = fusionarTabla([fila('a', 1)], [fila('b', 1)]);
    expect(filas.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('de dos versiones de la misma fila deja la mas nueva', () => {
    const vieja = { ...fila('a', 1), nombre: 'vieja' };
    const nueva = { ...fila('a', 9), nombre: 'nueva' };
    expect(fusionarTabla([vieja], [nueva]).filas[0]!.nombre).toBe('nueva');
    expect(fusionarTabla([nueva], [vieja]).filas[0]!.nombre).toBe('nueva');
  });

  it('avisa del conflicto y de que version se descarto', () => {
    const vieja = { ...fila('a', 1), nombre: 'vieja' };
    const nueva = { ...fila('a', 9), nombre: 'nueva' };
    const { conflictos } = fusionarTabla([vieja], [nueva]);
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0]!.ganadora.nombre).toBe('nueva');
    expect(conflictos[0]!.descartada.nombre).toBe('vieja');
  });

  it('la misma escritura en los dos lados no es conflicto', () => {
    const misma = fila('a', 5);
    expect(fusionarTabla([misma], [{ ...misma }]).conflictos).toHaveLength(0);
  });

  it('el orden de las filas no depende del orden de entrada', () => {
    const uno = fusionarTabla([fila('c', 1), fila('a', 1)], [fila('b', 1)]);
    const otro = fusionarTabla([fila('b', 1)], [fila('a', 1), fila('c', 1)]);
    expect(uno.filas.map((f) => f.id)).toEqual(otro.filas.map((f) => f.id));
  });
});

describe('el borrado es una escritura mas', () => {
  const borrada = (millis: number) =>
    ({ ...fila('a', millis), deletedAt: hlc(millis) });

  it('un borrado posterior gana a una edicion anterior', () => {
    const { filas } = fusionarTabla([fila('a', 1)], [borrada(9)]);
    expect(filas[0]!.deletedAt).not.toBeNull();
  });

  it('una edicion posterior revive lo borrado antes', () => {
    // Es lo que permite deshacer un borrado y que el deshacer viaje. Con una
    // regla de "gana el borrado", un movimiento borrado por accidente no se
    // podria recuperar nunca desde el otro aparato.
    const { filas } = fusionarTabla([borrada(1)], [fila('a', 9)]);
    expect(filas[0]!.deletedAt).toBeNull();
  });

  it('cuenta las que quedaron con lapida', () => {
    const { filas } = fusionarTabla([fila('a', 1), borrada(2)], [fila('c', 1)]);
    expect(contarBorradas(filas)).toBe(1);
  });
});

describe('las tres propiedades que hacen que converja', () => {
  const A = [fila('a', 1), { ...fila('b', 3), nombre: 'de A' }];
  const B = [{ ...fila('b', 7), nombre: 'de B' }, fila('c', 2)];
  const C = [fila('c', 9), fila('d', 1)];
  const claves = (filas: readonly Fila[]) =>
    filas.map((f) => `${f.id}:${f.updatedAt}:${f.nombre}`);

  it('conmutativa: A con B da lo mismo que B con A', () => {
    expect(claves(fusionarTabla(A, B).filas)).toEqual(claves(fusionarTabla(B, A).filas));
  });

  it('asociativa: da igual como se agrupen las fusiones', () => {
    const izquierda = fusionarTabla(fusionarTabla(A, B).filas, C).filas;
    const derecha = fusionarTabla(A, fusionarTabla(B, C).filas).filas;
    expect(claves(izquierda)).toEqual(claves(derecha));
  });

  it('idempotente: fusionar algo consigo mismo no lo cambia', () => {
    const una = fusionarTabla(A, B).filas;
    expect(claves(fusionarTabla(una, una).filas)).toEqual(claves(una));
  });
});

describe('convergencia con operaciones desordenadas', () => {
  /** Generador determinista: el mismo numero de partida da la misma corrida. */
  function azar(semilla: number): () => number {
    let estado = semilla >>> 0;
    return () => {
      estado = (estado * 1664525 + 1013904223) >>> 0;
      return estado / 0x100000000;
    };
  }

  /** Una escritura cualquiera sobre una de diez filas. */
  interface Operacion {
    readonly id: string;
    readonly millis: number;
    readonly nodo: string;
    readonly borra: boolean;
  }

  function operaciones(semilla: number, cuantas: number): Operacion[] {
    const random = azar(semilla);
    return Array.from({ length: cuantas }, (_, i) => ({
      id: `f${Math.floor(random() * 10)}`,
      // El milis crece con el indice para que haya un orden causal real, y el
      // nodo desempata como lo haria el HLC.
      millis: 1000 + i,
      nodo: random() < 0.5 ? 'a' : 'b',
      borra: random() < 0.25,
    }));
  }

  const aplicar = (ops: readonly Operacion[]): Fila[] => {
    const porId = new Map<string, Fila>();
    for (const op of ops) {
      const sello = `${String(op.millis).padStart(15, '0')}-00000-${op.nodo}`;
      porId.set(op.id, {
        id: op.id,
        updatedAt: sello,
        deletedAt: op.borra ? sello : null,
        nombre: `${op.id}@${op.millis}`,
      });
    }
    return [...porId.values()];
  };

  const barajar = (ops: readonly Operacion[], semilla: number): Operacion[] => {
    const random = azar(semilla);
    const copia = [...ops];
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    }
    return copia;
  };

  it('dos replicas que ven las mismas operaciones en distinto orden convergen', () => {
    // Es el criterio de verificacion de F5: convergencia con operaciones
    // desordenadas. Se corre con veinte semillas para que no pase por suerte.
    for (let semilla = 1; semilla <= 20; semilla += 1) {
      const ops = operaciones(semilla, 40);

      // Cada replica ve un pedazo, en su propio orden.
      const replicaA = aplicar(barajar(ops.slice(0, 30), semilla * 7));
      const replicaB = aplicar(barajar(ops.slice(10), semilla * 13));

      const haciaA = fusionarTabla(replicaA, replicaB).filas;
      const haciaB = fusionarTabla(replicaB, replicaA).filas;

      expect(haciaA.map((f) => `${f.id}:${f.updatedAt}:${f.deletedAt ?? ''}`))
        .toEqual(haciaB.map((f) => `${f.id}:${f.updatedAt}:${f.deletedAt ?? ''}`));
    }
  });

  it('fusionar de a poco da lo mismo que fusionar todo junto', () => {
    for (let semilla = 1; semilla <= 10; semilla += 1) {
      const ops = operaciones(semilla, 30);
      const completa = aplicar(ops);

      // Se fusiona operacion por operacion, en orden barajado.
      let parcial: Fila[] = [];
      for (const op of barajar(ops, semilla * 3)) parcial = fusionarTabla(parcial, aplicar([op])).filas;

      const clave = (f: Fila) => `${f.id}:${f.updatedAt}:${f.deletedAt ?? ''}`;
      expect(parcial.map(clave).sort()).toEqual(completa.map(clave).sort());
    }
  });
});

describe('resumirFusion', () => {
  it('separa lo nuevo, lo actualizado y lo que no cambio', () => {
    const locales = [fila('a', 1), fila('b', 5)];
    const remotas = [{ ...fila('a', 9), nombre: 'nueva' }, fila('b', 5), fila('c', 2)];
    const resultado = fusionarTabla(locales, remotas);

    expect(resumirFusion(locales, resultado)).toEqual({
      nuevas: 1, actualizadas: 1, sinCambios: 1, conflictos: 1,
    });
  });

  it('fusionar consigo mismo no reporta nada cambiado', () => {
    const locales = [fila('a', 1), fila('b', 5)];
    const resultado = fusionarTabla(locales, locales);
    expect(resumirFusion(locales, resultado)).toEqual({
      nuevas: 0, actualizadas: 0, sinCambios: 2, conflictos: 0,
    });
  });
});
