/**
 * La barra de navegación, siempre puesta, con el más en el medio.
 *
 * Seis destinos sin etiqueta (a 48 px por casilla, "Movimientos" no entra ni
 * recortado): lo activo se marca con el icono relleno y en color, y el nombre
 * viaja en la etiqueta de accesibilidad.
 *
 * El más asoma por encima del borde para no leerse como un destino más: es la
 * acción, no un lugar. Va en ámbar, el color del pico del pingüino y lo único
 * cálido de la pantalla.
 */

import { ALTO_DE_LA_BARRA, capas, elevation, radii, spacing } from '@iceberg/ui';
import { Link, usePathname, useRouter } from 'expo-router';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { ChartPieSlice } from 'phosphor-react-native/src/icons/ChartPieSlice';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { ListBullets } from 'phosphor-react-native/src/icons/ListBullets';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Snowflake } from 'phosphor-react-native/src/icons/Snowflake';
import { Waves } from 'phosphor-react-native/src/icons/Waves';
import type { IconProps } from 'phosphor-react-native';
import { useMemo, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEstilo, type Estilo } from '../datos/estilos';
import { useAncla, type Ancla } from '../datos/tutorial';

interface Destino {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: ComponentType<IconProps>;
}

/** De lo más general a lo más detallado, que es como uno mira sus cuentas. */
const IZQUIERDA: readonly Destino[] = [
  { ruta: '/', etiqueta: 'Resumen', icono: Waves },
  { ruta: '/categorias', etiqueta: 'Categorías', icono: ChartPieSlice },
  { ruta: '/calendario', etiqueta: 'Día a día', icono: CalendarBlank },
];

const DERECHA: readonly Destino[] = [
  { ruta: '/tempanos', etiqueta: 'Témpanos', icono: Snowflake },
  { ruta: '/movimientos', etiqueta: 'Movimientos', icono: ListBullets },
  { ruta: '/ajustes', etiqueta: 'Ajustes', icono: Gear },
];

const MAS = 52;
/** Cuánto asoma el más por encima del borde de la barra. */
const SOBRESALE = 16;

export function BarraInferior() {
  const estilo = useEstilo();
  const { theme } = estilo;
  const margenes = useSafeAreaInsets();
  const styles = useMemo(() => crearEstilos(estilo, margenes.bottom), [estilo, margenes.bottom]);
  const router = useRouter();
  const ruta = usePathname();
  // Dentro de `Link asChild` el estilo tiene que ser un objeto plano: el
  // estado de presión se lleva a mano.
  const [masApretado, setMasApretado] = useState(false);
  // La ruta hace de nombre de ancla para el tutorial.
  const ancla = useAncla();

  const casilla = (destino: Destino) => {
    const Icono = destino.icono;
    const activo = ruta === destino.ruta;
    return (
      <Pressable
        key={destino.ruta}
        ref={ancla(destino.ruta as Ancla)}
        // Sin esto Android colapsa la vista y no se puede medir.
        collapsable={false}
        onPress={() => { if (!activo) router.replace(destino.ruta as never); }}
        style={({ pressed }) => [styles.casilla, pressed && styles.casillaApretada]}
        accessibilityRole="button"
        accessibilityState={{ selected: activo }}
        accessibilityLabel={destino.etiqueta}
      >
        <Icono
          size={22}
          weight={activo ? 'fill' : 'regular'}
          color={activo ? theme.acentoTexto : theme.silencio}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.raiz} pointerEvents="box-none">
      <View style={styles.barra}>
        {IZQUIERDA.map(casilla)}
        {/* El hueco del más, para que los seis destinos se repartan parejo. */}
        <View style={styles.hueco} />
        {DERECHA.map(casilla)}
      </View>

      {/* Fuera de la barra y centrado por una franja a lo ancho: un elemento
          absoluto no se centra con `alignSelf`. */}
      <View style={styles.franjaDelMas} pointerEvents="box-none">
        <Link href="/nuevo" asChild>
          <Pressable
            ref={ancla('mas')}
            collapsable={false}
            style={StyleSheet.flatten([styles.mas, masApretado && styles.masApretado])}
            onPressIn={() => setMasApretado(true)}
            onPressOut={() => setMasApretado(false)}
            accessibilityRole="button"
            accessibilityLabel="Agregar movimiento"
          >
            <Plus size={24} weight="bold" color={theme.sobreAcento} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function crearEstilos({ theme }: Estilo, aireDelSistema: number) {
  return StyleSheet.create({
    raiz: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: capas.flotante },
    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ALTO_DE_LA_BARRA + aireDelSistema,
      // Como relleno y no como alto: los iconos quedan en la franja útil y no
      // encima de la barra de gestos.
      paddingBottom: aireDelSistema,
      backgroundColor: theme.superficie,
      borderTopWidth: elevation.hairlineWidth,
      borderTopColor: theme.hairline,
    },
    casilla: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
    casillaApretada: { opacity: 0.5 },
    hueco: { flex: 1 },
    franjaDelMas: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      bottom: aireDelSistema + ALTO_DE_LA_BARRA - (MAS - SOBRESALE),
    },
    mas: {
      width: MAS,
      height: MAS,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.pinguinoPico,
      // El anillo del color de la barra lo despega del borde que cruza por detrás.
      borderWidth: 3,
      borderColor: theme.superficie,
    },
    masApretado: { opacity: 0.85, transform: [{ scale: 0.92 }] },
  });
}
