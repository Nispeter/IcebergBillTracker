import { describe, expect, it } from 'vitest';
import { trozosConEnfasis } from './enfasis';

/** Compacta el resultado para poder leer las expectativas de un vistazo. */
const partir = (texto: string) => trozosConEnfasis(texto)
  .map((t) => (t.fuerte ? '[' + t.texto + ']' : t.texto));

describe('el enfasis', () => {
  it('un texto sin asteriscos vuelve entero', () => {
    expect(partir('Sin nada que marcar.')).toEqual(['Sin nada que marcar.']);
  });

  it('parte en normal, fuerte y normal', () => {
    expect(partir('Eliges **una carpeta** y listo.')).toEqual([
      'Eliges ', '[una carpeta]', ' y listo.',
    ]);
  });

  it('aguanta varios enfasis', () => {
    expect(partir('la **misma** carpeta, el **mismo** hogar')).toEqual([
      'la ', '[misma]', ' carpeta, el ', '[mismo]', ' hogar',
    ]);
  });

  it('el enfasis puede abrir el texto', () => {
    expect(partir('**Nadie** avisa.')).toEqual(['[Nadie]', ' avisa.']);
  });

  it('y puede cerrarlo', () => {
    expect(partir('No lo toca **nadie**')).toEqual(['No lo toca ', '[nadie]']);
  });

  it('un texto entero en negrita es un solo trozo', () => {
    expect(partir('**todo**')).toEqual(['[todo]']);
  });

  it('un asterisco sin pareja se muestra tal cual', () => {
    // Adivinar donde cierra dejaria media ayuda en negrita por un dedazo.
    expect(partir('Esto **no cierra nunca')).toEqual(['Esto **no cierra nunca']);
  });

  it('el texto vacio no devuelve ningun trozo', () => {
    // Quien lo pinta no dibuja nada, que es lo que corresponde.
    expect(trozosConEnfasis('')).toEqual([]);
  });

  it('conserva los saltos de linea', () => {
    // Las ayudas son varios parrafos: si se perdieran, quedarian de corrido.
    expect(partir('Uno\n\nDos **tres**')).toEqual(['Uno\n\nDos ', '[tres]']);
  });
});
