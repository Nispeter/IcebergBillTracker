/**
 * Ajustes: apariencia, y de donde salen los datos que se estan viendo.
 *
 * La identidad del dispositivo se muestra porque en modo hogar (F5) va a
 * importar saber cual es este aparato, y porque tenerla a la vista ayuda a
 * depurar cuando algo no cuadra entre dos telefonos.
 */

import { money } from '@iceberg/core';
import { CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO, leerAjuste } from '@iceberg/db';
import { elevation, fontSizes, fonts, pesos, radii, spacing, type Theme } from '@iceberg/ui';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pantalla } from '../../components/Pantalla';
import { useDatos } from '../../datos/BaseDeDatos';
import { useCuentas, useMovimientos, useSaldo, useSaldoInicial } from '../../datos/consultas';
import { TIPOS, usePeriodo } from '../../datos/periodo';
import { useTema } from '../../datos/tema';

export default function Ajustes() {
  const { nombre: tema, theme, alternar } = useTema();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { db } = useDatos();
  const periodo = usePeriodo();

  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const saldo = useSaldo(useSaldoInicial());

  const identidad = useMemo(() => ({
    dispositivo: leerAjuste(db, CLAVE_DISPOSITIVO),
    hogar: leerAjuste(db, CLAVE_HOGAR),
    miembro: leerAjuste(db, CLAVE_MIEMBRO),
  }), [db]);

  return (
    <Pantalla sinPeriodo>
      <ScrollView contentContainerStyle={styles.contenido}>
        <Seccion styles={styles} titulo="Apariencia" />
        <View style={styles.fila}>
          <Text style={styles.etiqueta}>Tema</Text>
          <Pressable
            onPress={alternar}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.botonTexto}>{tema === 'dark' ? 'Noche polar' : 'Deshielo'}</Text>
          </Pressable>
        </View>

        <Seccion styles={styles} titulo="Período" />
        <Dato
          styles={styles}
          etiqueta="Tipo"
          valor={TIPOS.find((t) => t.valor === periodo.tipo)?.etiqueta ?? periodo.tipo}
        />
        <Dato styles={styles} etiqueta="Desde" valor={periodo.rango.start} />
        <Dato styles={styles} etiqueta="Hasta" valor={periodo.rango.end} />

        <Seccion styles={styles} titulo="Datos" />
        <Dato styles={styles} etiqueta="Movimientos" valor={String(movimientos.length)} />
        <Dato styles={styles} etiqueta="Cuentas" valor={String(cuentas.length)} />
        <Dato styles={styles} etiqueta="Saldo" valor={money.format(saldo)} />
        <Text style={styles.nota}>
          La base arranca con datos de prueba: 18 meses de gasto chileno generados con una
          semilla fija. Los movimientos que agregues quedan junto a ellos.
        </Text>

        <Seccion styles={styles} titulo="Este dispositivo" />
        <Dato styles={styles} etiqueta="Dispositivo" valor={identidad.dispositivo ?? '—'} mono />
        <Dato styles={styles} etiqueta="Hogar" valor={identidad.hogar ?? '—'} mono />
        <Dato styles={styles} etiqueta="Miembro" valor={identidad.miembro ?? '—'} mono />
        <Text style={styles.nota}>
          Se crean una sola vez y no cambian: cada movimiento guarda desde qué dispositivo
          se escribió, que es lo que hará posible el modo hogar.
        </Text>
      </ScrollView>
    </Pantalla>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Seccion({ styles, titulo }: { styles: Estilos; titulo: string }) {
  return (
    <View style={styles.regla}>
      <Text style={styles.reglaTitulo}>{titulo}</Text>
      <View style={styles.reglaLinea} />
    </View>
  );
}

function Dato(
  { styles, etiqueta, valor, mono }:
  { styles: Estilos; etiqueta: string; valor: string; mono?: boolean },
) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={mono ? styles.valorMono : styles.valor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    regla: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
      marginBottom: spacing.xs,
    },
    reglaTitulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    reglaLinea: { flex: 1, height: elevation.hairlineWidth, backgroundColor: theme.hairline },

    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    etiqueta: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    valor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.tinta },
    valorMono: {
      flex: 1,
      textAlign: 'right',
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.tinta,
    },

    boton: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    botonTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    nota: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.sm },
  });
}
