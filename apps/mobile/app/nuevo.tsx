/**
 * Alta manual de un movimiento.
 *
 * El formulario **no guarda estado propio del dominio**: arma los datos, se los
 * pasa al repositorio y vuelve. Todo lo que se ve despues sale de la base, que
 * es la unica fuente de verdad.
 */

import { categories, dates, money } from '@iceberg/core';
import { crearMovimiento, listarCuentas, type TipoDeMovimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, radii, spacing, themes, type Theme, type ThemeName,
} from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View,
} from 'react-native';
import { useDatos } from '../datos/BaseDeDatos';
import { iconoDeCategoria } from '../components/iconos';

export default function NuevoMovimiento() {
  const sistema = useColorScheme();
  const [tema] = useState<ThemeName>(sistema === 'dark' ? 'dark' : 'light');
  const theme = themes[tema];
  const styles = useMemo(() => crearEstilos(theme), [theme]);

  const { db, contexto } = useDatos();
  const router = useRouter();

  const [tipo, setTipo] = useState<TipoDeMovimiento>('gasto');
  const [monto, setMonto] = useState('');
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState<string>(dates.today());
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const montoParseado = money.parseMoney(monto);
  const fechaParseada = dates.parsePlainDate(fecha);
  // El ingreso no lleva categoria: un sueldo no es un tipo de gasto.
  const pideCategoria = tipo === 'gasto';
  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && fechaParseada !== null;

  function guardar() {
    if (!puedeGuardar || montoParseado === null || fechaParseada === null) return;
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) {
        setError('No hay ninguna cuenta creada todavia');
        return;
      }
      crearMovimiento(db, contexto, {
        cuentaId: cuenta.id,
        tipo,
        montoMinor: montoParseado.amountMinor,
        ocurridoEn: fechaParseada,
        nombre,
        categoriaId: pideCategoria ? categoriaId : null,
      });
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={styles.raiz}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">

        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Nuevo movimiento</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>

        <View style={styles.selector}>
          {(['gasto', 'ingreso'] as const).map((opcion) => (
            <Pressable
              key={opcion}
              onPress={() => setTipo(opcion)}
              style={[styles.opcion, tipo === opcion && styles.opcionActiva]}
              accessibilityRole="radio"
              accessibilityState={{ selected: tipo === opcion }}
            >
              <Text style={tipo === opcion ? styles.opcionTextoActivo : styles.opcionTexto}>
                {opcion === 'gasto' ? 'Gasto' : 'Ingreso'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Campo styles={styles} etiqueta="Monto">
          <View style={styles.filaMonto}>
            <Text style={styles.simbolo}>$</Text>
            <TextInput
              value={monto}
              onChangeText={setMonto}
              placeholder="0"
              placeholderTextColor={theme.silencio}
              keyboardType="numeric"
              inputMode="numeric"
              style={styles.entradaMonto}
              accessibilityLabel="Monto"
            />
          </View>
          {monto.length > 0 && montoParseado === null ? (
            <Text style={styles.aviso}>No se entiende ese monto. Sin decimales: el peso no los tiene.</Text>
          ) : null}
        </Campo>

        <Campo styles={styles} etiqueta="Descripción">
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder="Jumbo, arriendo, sueldo…"
            placeholderTextColor={theme.silencio}
            style={styles.entrada}
            accessibilityLabel="Descripción"
          />
        </Campo>

        <Campo styles={styles} etiqueta="Fecha">
          <TextInput
            value={fecha}
            onChangeText={setFecha}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.silencio}
            style={styles.entradaMono}
            autoCapitalize="none"
            accessibilityLabel="Fecha"
          />
          {fechaParseada === null ? (
            <Text style={styles.aviso}>Fecha inválida. El formato es AAAA-MM-DD.</Text>
          ) : (
            <Text style={styles.ayuda}>{dates.formatDateLong(fechaParseada)}</Text>
          )}
        </Campo>

        {pideCategoria ? (
          <Campo styles={styles} etiqueta="Categoría">
            <View style={styles.categorias}>
              {categories.CATEGORIES.map((categoria) => {
                const Icono = iconoDeCategoria(categoria.id);
                const activa = categoriaId === categoria.id;
                return (
                  <Pressable
                    key={categoria.id}
                    onPress={() => setCategoriaId(activa ? null : categoria.id)}
                    style={[styles.chip, activa && styles.chipActivo]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activa }}
                  >
                    {Icono ? (
                      <Icono size={14} weight="regular" color={activa ? theme.fondo : theme.silencio} />
                    ) : null}
                    <Text style={activa ? styles.chipTextoActivo : styles.chipTexto}>
                      {categoria.nombreCorto}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.ayuda}>Opcional. Se puede dejar sin categoría.</Text>
          </Campo>
        ) : null}

        {error !== null ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={guardar}
          disabled={!puedeGuardar}
          style={[styles.guardar, !puedeGuardar && styles.guardarApagado]}
          accessibilityRole="button"
          accessibilityLabel="Guardar movimiento"
        >
          <Text style={styles.guardarTexto}>
            {montoParseado !== null && puedeGuardar
              ? `Guardar ${tipo === 'ingreso' ? '+' : '−'}${money.format(montoParseado)}`
              : 'Guardar'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Campo(
  { styles, etiqueta, children }:
  { styles: Estilos; etiqueta: string; children: React.ReactNode },
) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { flex: 1, backgroundColor: theme.fondo },
    contenido: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.xl,
    },

    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    titulo: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.lg, color: theme.tinta },
    cancelar: { fontFamily: fonts.ui.medium, fontSize: fontSizes.sm, color: theme.silencio },

    selector: {
      flexDirection: 'row',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    opcion: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    opcionActiva: { backgroundColor: theme.tinta },
    opcionTexto: { fontFamily: fonts.ui.medium, fontSize: fontSizes.sm, color: theme.silencio },
    opcionTextoActivo: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.sm, color: theme.fondo },

    campo: { gap: spacing.sm },
    etiqueta: {
      fontFamily: fonts.ui.medium,
      fontSize: fontSizes.xs,
      color: theme.silencio,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },

    filaMonto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingBottom: spacing.sm,
    },
    simbolo: { fontFamily: fonts.mono.regular, fontSize: fontSizes.lg, color: theme.silencio },
    entradaMonto: {
      flex: 1,
      fontFamily: fonts.mono.medium,
      fontSize: 34,
      color: theme.tinta,
      padding: 0,
    },

    entrada: {
      fontFamily: fonts.ui.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    entradaMono: {
      fontFamily: fonts.mono.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    ayuda: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.silencio },
    aviso: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    error: { fontFamily: fonts.ui.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },

    categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    chipActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    chipTexto: { fontFamily: fonts.ui.regular, fontSize: fontSizes.xs, color: theme.tinta },
    chipTextoActivo: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.xs, color: theme.fondo },

    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    guardarApagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.md, color: theme.tinta },
  });
}
