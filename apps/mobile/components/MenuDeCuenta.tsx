/**
 * Elegir qué cuenta se mira, en una burbuja colgada de las tres rayitas: un
 * toque y la lista.
 *
 * No usa `ConDesplegable`: aquel abre a lo ancho del disparador (las rayitas
 * miden 44 px) y vive por debajo del encabezado. Se monta desde el layout del
 * grupo porque la barra de abajo es hermana del Stack con `zIndex` propio, y
 * colgada de `Pantalla` la burbuja quedaría debajo de ella.
 *
 * El velo es transparente: cierra al tocar fuera sin convertir la burbuja en
 * una pantalla nueva, y tapa la barra para que no se navegue por accidente.
 */

import { capas, elevation, radii, spacing } from '@iceberg/ui';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { Star } from 'phosphor-react-native/src/icons/Star';
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aparecer } from './Aparecer';
import { useCuentas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';
import { useEstilos, type Estilo } from '../datos/estilos';
import { useTema } from '../datos/tema';

/** Lo que la burbuja se separa del botón que la abrió. */
const AIRE = 6;

/** Angosta se lee como menú; ancha, como una pantalla. */
const ANCHO = { minimo: 200, maximo: 280 } as const;

/** Dónde quedó el botón, en coordenadas de ventana. */
export interface Ancla {
  readonly x: number;
  readonly y: number;
  readonly alto: number;
}

const Contexto = createContext<(ancla: Ancla) => void>(() => {});

/** Abre el menú bajo el botón medido. */
export function useAbrirMenuDeCuenta(): (ancla: Ancla) => void {
  return useContext(Contexto);
}

export function ProveedorDeMenuDeCuenta({ children }: { children: ReactNode }) {
  const [ancla, setAncla] = useState<Ancla | null>(null);
  const abrir = useCallback((donde: Ancla) => setAncla(donde), []);
  const cuentas = useCuentas();
  const { width, height } = useWindowDimensions();

  // El ancla se mide una vez, al tocar: si la ventana cambia, el botón se movió
  // y la burbuja quedaría flotando en el lugar viejo.
  useEffect(() => setAncla(null), [width, height]);

  return (
    <Contexto.Provider value={abrir}>
      {children}
      {/* Siempre montada, para que la burbuja tenga de dónde colgar; cerrada no
          tiene hijos y el toque sigue de largo. */}
      <View style={styles.capa} pointerEvents="box-none">
        {ancla === null ? null : (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAncla(null)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          />
        )}
        <Burbuja cuentas={cuentas} ancla={ancla} onCerrar={() => setAncla(null)} />
      </View>
    </Contexto.Provider>
  );
}

function Burbuja(
  { cuentas, ancla, onCerrar }: {
    cuentas: readonly { id: string; nombre: string }[];
    /** `null` mientras está cerrada. */
    ancla: Ancla | null;
    onCerrar: () => void;
  },
) {
  const estilos = useEstilos(crearEstilos);
  const { theme } = useTema();
  const { cuentaId, elegir, porDefecto } = useCuentaActiva();
  const margenes = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Las coordenadas sobreviven al cierre: `Aparecer` la deja montada mientras
  // se desvanece, y sin ancla saltaría a la esquina.
  const [ultima, setUltima] = useState<Ancla | null>(null);
  useEffect(() => { if (ancla !== null) setUltima(ancla); }, [ancla]);

  const donde = ancla ?? ultima;
  if (donde === null || cuentas.length < 2) return null;

  const arranca = donde.y + donde.alto + AIRE;
  const opciones: { valor: string | null; etiqueta: string }[] = [
    { valor: null, etiqueta: 'Todas las cuentas' },
    ...cuentas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
  ];

  return (
    <Aparecer visible={ancla !== null} estilo={[estilos.burbuja, { top: arranca, left: donde.x }]}>
      <ScrollView style={{ maxHeight: Math.max(height - arranca - margenes.bottom - AIRE, 0) }}>
        {opciones.map((opcion) => {
          const elegida = opcion.valor === cuentaId;
          const esLaDeSiempre = opcion.valor === porDefecto;
          return (
            <Pressable
              key={opcion.valor ?? 'todas'}
              onPress={() => { elegir(opcion.valor); onCerrar(); }}
              style={({ pressed }) => [estilos.opcion, pressed && estilos.apretada]}
              accessibilityRole="button"
              accessibilityState={{ selected: elegida }}
              accessibilityLabel={esLaDeSiempre
                ? `Ver ${opcion.etiqueta}. Es con la que abre la app`
                : `Ver ${opcion.etiqueta}`}
            >
              <Text style={elegida ? estilos.elegida : estilos.texto} numberOfLines={1}>
                {opcion.etiqueta}
              </Text>
              {/* La estrella solo informa: se pone en Ajustes. Va antes del
                  visto para no moverse de columna cuando el visto aparece. */}
              {esLaDeSiempre ? <Star size={11} weight="fill" color={theme.acentoTexto} /> : null}
              {elegida ? <Check size={12} weight="bold" color={theme.acentoTexto} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Aparecer>
  );
}

const styles = StyleSheet.create({
  capa: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: capas.lateral },
});

function crearEstilos({ theme, t }: Estilo) {
  return StyleSheet.create({
    // Sin sombra, como todo lo que flota en la app: lo separa el borde.
    burbuja: {
      position: 'absolute',
      minWidth: ANCHO.minimo,
      maxWidth: ANCHO.maximo,
      backgroundColor: theme.superficie,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      overflow: 'hidden',
    },
    opcion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    apretada: { opacity: 0.6 },
    texto: { ...t.cuerpo, flex: 1 },
    elegida: { ...t.cuerpo, flex: 1, fontWeight: t.seccion.fontWeight },
  });
}
