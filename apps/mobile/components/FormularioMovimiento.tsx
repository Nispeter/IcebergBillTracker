/**
 * Formulario de un movimiento, compartido por el alta y la edicion.
 *
 * No toca la base: arma los datos y los entrega. Quien lo usa decide si eso es
 * un `crearMovimiento` o un `editarMovimiento`. Asi las dos pantallas validan
 * igual y no hay dos formularios que mantener sincronizados.
 */

import { categories, dates, money } from '@iceberg/core';
import type { TipoDeMovimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { iconoDeCategoria } from './iconos';

export interface ValoresDelFormulario {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  readonly categoriaId: categories.CategoryId | null;
}

export interface FormularioMovimientoProps {
  readonly theme: Theme;
  readonly titulo: string;
  readonly inicial?: Partial<ValoresDelFormulario>;
  readonly onGuardar: (valores: ValoresDelFormulario) => void;
  readonly onCancelar: () => void;
  /** Si viene, se muestra el boton de borrar. */
  readonly onBorrar?: () => void;
  readonly error?: string | null;
}

export function FormularioMovimiento({
  theme, titulo, inicial, onGuardar, onCancelar, onBorrar, error,
}: FormularioMovimientoProps) {
  const styles = crearEstilos(theme);

  const [tipo, setTipo] = useState<TipoDeMovimiento>(inicial?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(
    inicial?.montoMinor === undefined ? '' : money.formatNumber(money.money(inicial.montoMinor)),
  );
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [fecha, setFecha] = useState<string>(inicial?.ocurridoEn ?? dates.today());
  const [categoriaId, setCategoriaId] = useState<categories.CategoryId | null>(
    inicial?.categoriaId ?? null,
  );
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false);

  const montoParseado = money.parseMoney(monto);
  const fechaParseada = dates.parsePlainDate(fecha);
  // El ingreso no lleva categoria: un sueldo no es un tipo de gasto.
  const pideCategoria = tipo === 'gasto';
  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && fechaParseada !== null;

  const IconoElegido = categoriaId === null ? null : iconoDeCategoria(categoriaId);

  return (
    <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Pressable onPress={onCancelar} accessibilityRole="button">
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
          style={styles.entrada}
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
          {/* Doce chips siempre visibles ocupaban media pantalla para un campo
              que la mayoria de las veces no se toca. Se muestra la elegida y la
              lista aparece solo al pedirla. */}
          <Pressable
            onPress={() => setEligiendoCategoria(!eligiendoCategoria)}
            style={styles.selectorCategoria}
            accessibilityRole="button"
            accessibilityLabel={
              categoriaId === null
                ? 'Elegir categoría'
                : `Categoría ${categories.categoryName(categoriaId)}. Tocar para cambiar`
            }
            accessibilityState={{ expanded: eligiendoCategoria }}
          >
            {IconoElegido ? (
              <IconoElegido size={18} weight="regular" color={theme.tinta} />
            ) : null}
            <Text style={categoriaId === null ? styles.categoriaVacia : styles.categoriaElegida}>
              {categoriaId === null ? 'Sin categoría' : categories.categoryName(categoriaId)}
            </Text>
            <CaretDown
              size={14}
              weight="bold"
              color={theme.silencio}
              style={{ transform: [{ rotate: eligiendoCategoria ? '180deg' : '0deg' }] }}
            />
          </Pressable>

          {eligiendoCategoria ? (
            <View style={styles.categorias}>
              {categoriaId !== null ? (
                <Pressable
                  onPress={() => { setCategoriaId(null); setEligiendoCategoria(false); }}
                  style={styles.chip}
                  accessibilityRole="button"
                >
                  <Text style={styles.chipTexto}>Sin categoría</Text>
                </Pressable>
              ) : null}
              {categories.CATEGORIES.map((categoria) => {
                const Icono = iconoDeCategoria(categoria.id);
                const activa = categoriaId === categoria.id;
                return (
                  <Pressable
                    key={categoria.id}
                    onPress={() => { setCategoriaId(categoria.id); setEligiendoCategoria(false); }}
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
          ) : null}
        </Campo>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => {
          if (!puedeGuardar || montoParseado === null || fechaParseada === null) return;
          onGuardar({
            tipo,
            montoMinor: montoParseado.amountMinor,
            ocurridoEn: fechaParseada,
            nombre,
            categoriaId: pideCategoria ? categoriaId : null,
          });
        }}
        disabled={!puedeGuardar}
        style={[styles.guardar, !puedeGuardar && styles.guardarApagado]}
        accessibilityRole="button"
        accessibilityLabel="Guardar movimiento"
      >
        <Text style={styles.guardarTexto}>
          {puedeGuardar && montoParseado !== null
            ? `Guardar ${tipo === 'ingreso' ? '+' : '−'}${money.format(montoParseado)}`
            : 'Guardar'}
        </Text>
      </Pressable>

      {onBorrar ? (
        // Dos toques a proposito: borrar no tiene deshacer en la UI todavia.
        <Pressable
          onPress={() => (confirmandoBorrado ? onBorrar() : setConfirmandoBorrado(true))}
          style={styles.borrar}
          accessibilityRole="button"
          accessibilityLabel={confirmandoBorrado ? 'Confirmar borrado' : 'Borrar movimiento'}
        >
          <Text style={styles.borrarTexto}>
            {confirmandoBorrado ? 'Tocar de nuevo para confirmar' : 'Borrar movimiento'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

type Estilos = ReturnType<typeof crearEstilos>;

function Campo({ styles, etiqueta, children }: { styles: Estilos; etiqueta: string; children: ReactNode }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {children}
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
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
    titulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.lg, color: theme.tinta },
    cancelar: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },

    selector: {
      flexDirection: 'row',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    opcion: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    opcionActiva: { backgroundColor: theme.tinta },
    opcionTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    opcionTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.fondo },

    campo: { gap: spacing.sm },
    etiqueta: {
      fontFamily: fonts.ui,
      fontWeight: pesos.medium,
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
    simbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.lg, color: theme.silencio },
    entradaMonto: {
      flex: 1,
      fontFamily: fonts.mono,
      fontWeight: pesos.medium,
      fontSize: 34,
      color: theme.tinta,
      padding: 0,
    },

    entrada: {
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    ayuda: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    aviso: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    error: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },

    selectorCategoria: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.md,
    },
    categoriaElegida: {
      flex: 1,
      fontFamily: fonts.ui,
      fontWeight: pesos.medium,
      fontSize: fontSizes.md,
      color: theme.tinta,
    },
    categoriaVacia: {
      flex: 1,
      fontFamily: fonts.ui,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.silencio,
    },
    categorias: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
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
    chipTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    chipTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.fondo },

    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    guardarApagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta },

    borrar: { paddingVertical: spacing.md, alignItems: 'center' },
    borrarTexto: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },
  });
}
