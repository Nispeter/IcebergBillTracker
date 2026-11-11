/**
 * El pingüino, en SVG: la marca de la app y su estado de ánimo.
 *
 * La panza y la cara son una sola mancha blanca grande, que es lo que sobrevive
 * al achique; el contorno con aletas da la silueta. Sus colores no se invierten
 * con el tema: con los ojos claros sobre fondo oscuro la cara deja de leerse.
 *
 * Los estados cambian solo los ojos, que es lo único que se distingue a 20 px.
 */

import { useEffect, useState } from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useMovimientoReducido } from '../datos/animacion';
import { useTema } from '../datos/tema';

/**
 * - `normal`: lo de siempre.
 * - `dormido`: no hay nada que mirar.
 * - `alerta`: hay algo que resolver hoy.
 * - `contento`: no queda nada pendiente.
 */
export type EstadoDelPinguino = 'normal' | 'dormido' | 'alerta' | 'contento';

const ANCHO = 64;
const ALTO = 72;
/** Las aletas se salen un poco a los lados: el viewBox las deja entrar. */
const VIEWBOX = '-2 0 68 72';

const CUERPO = 'M32,2 C45,2 53,13 53,27 C53,33 55,40 55,47 C55,60 45,69 32,69'
  + ' C19,69 9,60 9,47 C9,40 11,33 11,27 C11,13 19,2 32,2 Z';
const ALETA_IZQUIERDA = 'M13,27 C3,33 -1,49 3,60 C5,65 11,64 12,57 C13,48 13,36 13,27 Z';
const ALETA_DERECHA = 'M51,27 C61,33 65,49 61,60 C59,65 53,64 52,57 C51,48 51,36 51,27 Z';
const PANZA = 'M32,16 C40,16 45,23 46,31 C48,37 49,42 49,48 C49,58 42,65 32,65'
  + ' C22,65 15,58 15,48 C15,42 16,37 18,31 C19,23 24,16 32,16 Z';

/** Dormido: dos arcos hacia abajo. Contento: los mismos, hacia arriba. */
const OJO_DORMIDO_IZQUIERDO = 'M21,27 C23,30 27,30 29,27';
const OJO_DORMIDO_DERECHO = 'M35,27 C37,30 41,30 43,27';
const OJO_CONTENTO_IZQUIERDO = 'M21,29 C23,25 27,25 29,29';
const OJO_CONTENTO_DERECHO = 'M35,29 C37,25 41,25 43,29';

/** Cejas inclinadas hacia adentro: se leen como preocupación. */
const CEJA_IZQUIERDA = 'M20,20 L30,23';
const CEJA_DERECHA = 'M44,20 L34,23';

/** Grosor de los trazos, en unidades del viewBox. */
const TRAZO = 2.5;

const PICO = 'M32,32 C36,32 40,35 40,38 C40,42 36,45 32,45 C28,45 24,42 24,38 C24,35 28,32 32,32 Z';

/**
 * El pico abierto es el mismo pico estirado hacia abajo desde donde nace, así
 * que se abre como una boca. Va en SVG y no con `Animated` porque el driver
 * nativo no mueve props de SVG: dos fotogramas alternados alcanzan.
 */
const PICO_ABIERTO = 'translate(32,32) scale(0.9,1.7) translate(-32,-32)';

/** Cada sílaba dura al azar dentro del rango: a ritmo fijo el pico late como una máquina. */
const SILABA_MINIMA = 90;
const SILABA_MAXIMA = 210;

/**
 * Pestañea poco más de un décimo de segundo, cada rato al azar y largo. Cada
 * pingüino lleva su propio reloj: varios pestañeando a la vez darían miedo.
 */
const PESTANEO = 130;
const ENTRE_PESTANEOS_MINIMO = 2600;
const ENTRE_PESTANEOS_MAXIMO = 7000;

export function Pinguino(
  { tamano = 20, estado = 'normal', hablando = false }:
  {
    tamano?: number;
    estado?: EstadoDelPinguino;
    /** Mueve el pico mientras sea verdadero. */
    hablando?: boolean;
  },
) {
  const { theme } = useTema();
  const quieto = useMovimientoReducido();
  const alto = (tamano / ANCHO) * ALTO;
  const [picoAbierto, setPicoAbierto] = useState(false);
  const [pestaneando, setPestaneando] = useState(false);

  // Solo pestañea con los ojos abiertos: dormido ya los tiene cerrados y
  // contento son dos arcos sin nada que cerrar.
  const puedePestanear = !quieto && (estado === 'normal' || estado === 'alerta');

  useEffect(() => {
    if (!puedePestanear) { setPestaneando(false); return undefined; }

    let siguiente: ReturnType<typeof setTimeout>;
    let abrir: ReturnType<typeof setTimeout>;
    let vivo = true;
    const esperar = () => {
      const rato = ENTRE_PESTANEOS_MINIMO
        + Math.random() * (ENTRE_PESTANEOS_MAXIMO - ENTRE_PESTANEOS_MINIMO);
      siguiente = setTimeout(() => {
        if (!vivo) return;
        setPestaneando(true);
        abrir = setTimeout(() => {
          if (!vivo) return;
          setPestaneando(false);
          esperar();
        }, PESTANEO);
      }, rato);
    };
    esperar();

    return () => { vivo = false; clearTimeout(siguiente); clearTimeout(abrir); setPestaneando(false); };
  }, [puedePestanear]);

  useEffect(() => {
    if (!hablando || quieto) { setPicoAbierto(false); return undefined; }

    let siguiente: ReturnType<typeof setTimeout>;
    let vivo = true;
    const silaba = () => {
      if (!vivo) return;
      setPicoAbierto((abierto) => !abierto);
      siguiente = setTimeout(
        silaba,
        SILABA_MINIMA + Math.random() * (SILABA_MAXIMA - SILABA_MINIMA),
      );
    };
    silaba();

    // Cerrarlo al terminar: si no, el último fotograma queda con la boca abierta.
    return () => { vivo = false; clearTimeout(siguiente); setPicoAbierto(false); };
  }, [hablando, quieto]);

  const linea = {
    stroke: theme.pinguinoCuerpo,
    strokeWidth: TRAZO,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={tamano} height={alto} viewBox={VIEWBOX}>
      <Path d={ALETA_IZQUIERDA} fill={theme.pinguinoCuerpo} />
      <Path d={ALETA_DERECHA} fill={theme.pinguinoCuerpo} />
      <Path d={CUERPO} fill={theme.pinguinoCuerpo} />
      <Path d={PANZA} fill={theme.pinguinoPanza} />

      {estado === 'dormido' || pestaneando ? (
        <>
          <Path d={OJO_DORMIDO_IZQUIERDO} {...linea} />
          <Path d={OJO_DORMIDO_DERECHO} {...linea} />
        </>
      ) : estado === 'contento' ? (
        <>
          <Path d={OJO_CONTENTO_IZQUIERDO} {...linea} />
          <Path d={OJO_CONTENTO_DERECHO} {...linea} />
        </>
      ) : (
        <>
          <Circle cx={25} cy={27} r={3} fill={theme.pinguinoCuerpo} />
          <Circle cx={39} cy={27} r={3} fill={theme.pinguinoCuerpo} />
        </>
      )}

      {estado === 'alerta' ? (
        <>
          <Path d={CEJA_IZQUIERDA} {...linea} />
          <Path d={CEJA_DERECHA} {...linea} />
        </>
      ) : null}

      {picoAbierto ? (
        <G transform={PICO_ABIERTO}>
          <Path d={PICO} fill={theme.pinguinoPico} />
        </G>
      ) : (
        <Path d={PICO} fill={theme.pinguinoPico} />
      )}
    </Svg>
  );
}
