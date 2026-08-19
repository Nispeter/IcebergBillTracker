/**
 * El marco que comparten todas las vistas: marca, acciones y barra de periodo.
 *
 * Existe para que el periodo este **en todas partes**. Si cada pantalla armara
 * su propio encabezado, tarde o temprano alguna se olvidaria de la barra y el
 * usuario perderia la referencia de que fecha esta mirando.
 */

import { elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarraDePeriodo } from './BarraDePeriodo';
import { useTema } from '../datos/tema';

export function Pantalla({ children, sinPeriodo }: { children: ReactNode; sinPeriodo?: boolean }) {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = crearEstilos(theme);

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <View style={styles.marco}>
        <View style={styles.encabezado}>
          <Text style={styles.marca}>ICEBERG</Text>
          <View style={styles.acciones}>
            <Pressable
              onPress={alternar}
              style={styles.botonTema}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
            >
              <Text style={styles.textoTema}>{tema === 'dark' ? 'Deshielo' : 'Noche polar'}</Text>
            </Pressable>
            <Link href="/nuevo" asChild>
              <Pressable
                style={styles.botonAgregar}
                accessibilityRole="button"
                accessibilityLabel="Agregar movimiento"
              >
                <Plus size={16} weight="bold" color={theme.fondo} />
              </Pressable>
            </Link>
          </View>
        </View>
        {sinPeriodo ? null : <BarraDePeriodo theme={theme} />}
      </View>
      {children}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    marco: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      gap: spacing.md,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    marca: { fontFamily: fonts.ui, fontWeight: pesos.bold, fontSize: fontSizes.xs, color: theme.tinta, letterSpacing: 3 },
    acciones: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    // Con borde: sin el, el texto suelto no se lee como algo que se pueda tocar.
    botonTema: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    textoTema: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: 10, color: theme.acentoTexto },
    botonAgregar: {
      width: 28,
      height: 28,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.acento,
    },
  });
}
