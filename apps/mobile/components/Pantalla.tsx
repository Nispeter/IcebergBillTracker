/**
 * El marco que comparten todas las vistas: menu, marca, acciones y periodo.
 *
 * Existe para que el periodo este **en todas partes**. Si cada pantalla armara
 * su propio encabezado, tarde o temprano alguna se olvidaria de la barra y el
 * usuario perderia la referencia de que fecha esta mirando.
 */

import { elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { List } from 'phosphor-react-native/src/icons/List';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarraDePeriodo } from './BarraDePeriodo';
import { Sidebar } from './Sidebar';
import { useTema } from '../datos/tema';

export function Pantalla(
  { children, sinPeriodo, permitirFuturo }: {
    children: ReactNode;
    sinPeriodo?: boolean;
    /** Ver `BarraDePeriodo`: solo Tempanos necesita mirar hacia adelante. */
    permitirFuturo?: boolean;
  },
) {
  const { nombre: tema, theme } = useTema();
  const styles = crearEstilos(theme);
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <View style={styles.marco}>
        <View style={styles.encabezado}>
          <Pressable
            onPress={() => setMenuAbierto(true)}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú"
            hitSlop={8}
          >
            <List size={15} weight="bold" color={theme.tinta} />
          </Pressable>

          {sinPeriodo ? <Text style={styles.marca}>ICEBERG</Text> : (
            <View style={styles.periodo}><BarraDePeriodo theme={theme} permitirFuturo={permitirFuturo} /></View>
          )}

          <Link href="/nuevo" asChild>
            <Pressable
              style={styles.botonAgregar}
              accessibilityRole="button"
              accessibilityLabel="Agregar movimiento"
            >
              <Plus size={14} weight="bold" color={theme.sobreAcento} />
              <Text style={styles.agregarTexto}>Agregar</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {children}

      <Sidebar theme={theme} abierta={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    marco: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    // El periodo va en la misma linea que el menu y el mas: es marco, no
    // contenido, y no merece una franja propia.
    encabezado: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    periodo: { flex: 1, paddingTop: 1 },
    marca: { flex: 1, fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    boton: {
      width: 26,
      height: 26,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    // La accion principal de la app no puede ser un circulo de 26px igual al
    // del menu: lleva su nombre escrito y el color de acento para que se lea
    // como el boton, no como un icono mas de la fila.
    botonAgregar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      height: 26,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: theme.acento,
    },
    agregarTexto: {
      fontFamily: fonts.ui,
      fontWeight: pesos.bold,
      fontSize: fontSizes.xs,
      color: theme.sobreAcento,
    },
  });
}
