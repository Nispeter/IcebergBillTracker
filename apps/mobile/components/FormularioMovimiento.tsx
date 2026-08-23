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
  capas,
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { ConDesplegable } from './ConDesplegable';
import { Interruptor } from './Interruptor';
import { esComprometido, useComprometidas } from '../datos/consultas';
import { ChipDisparador, ListaDeOpciones } from './SelectorDesplegable';
import { iconoDeCategoria } from './iconos';

export interface ValoresDelFormulario {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  readonly categoriaId: categories.CategoryId | null;
  /**
   * Si es un compromiso fijo. `null` deja que la app lo deduzca.
   *
   * Ver la columna en el esquema: la categoria es mal indicio por si sola.
   */
  readonly comprometido: boolean | null;
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
  /**
   * `null` significa **que nadie lo toco**, no "variable".
   *
   * Mientras siga nulo, el interruptor muestra lo que la app deduce y al guardar
   * se manda nulo, asi que la deduccion sigue mandando y el movimiento se
   * reclasifica solo si cambia de categoria. En cuanto alguien lo mueve, la
   * decision queda fija.
   */
  const [comprometido, setComprometido] = useState<boolean | null>(
    inicial?.comprometido ?? null,
  );
  const comprometidas = useComprometidas();
  const esCompromisoAhora = comprometido ?? esComprometido(categoriaId, comprometidas);
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

  const opcionesDeCategoria = useMemo(() => [
    { valor: null, etiqueta: 'Sin categoría' },
    ...categories.CATEGORIES.map((categoria) => ({
      valor: categoria.id,
      etiqueta: categoria.nombre,
      icono: iconoDeCategoria(categoria.id),
    })),
  ], []);

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
        <Campo styles={styles} etiqueta="Categoría" estilo={styles.campoDeCategoria}>
          <ConDesplegable
            abierto={eligiendoCategoria}
            disparador={(
              <View style={styles.filaChip}>
                <ChipDisparador
                  theme={theme}
                  etiqueta={categoriaId === null ? 'Sin categoría' : categories.categoryShortName(categoriaId)}
                  icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
                  abierto={eligiendoCategoria}
                  activo={categoriaId !== null}
                  onPress={() => setEligiendoCategoria(!eligiendoCategoria)}
                  accesible={
                    categoriaId === null
                      ? 'Elegir categoría'
                      : `Categoría ${categories.categoryName(categoriaId)}. Tocar para cambiar`
                  }
                />
                {/*
                  Al otro extremo de la misma fila: la categoria dice de que
                  rubro es y el interruptor que clase de gasto es. Son la misma
                  pregunta mirada de dos maneras, y separarlas en dos secciones
                  hacia parecer que una dependia de la otra.
                */}
                <View style={styles.claseDeGasto}>
                  <Text style={styles.claseTexto}>
                    {esCompromisoAhora ? 'Comprometido' : 'Variable'}
                  </Text>
                  <Interruptor
                    theme={theme}
                    encendido={esCompromisoAhora}
                    onCambiar={setComprometido}
                    accesible={esCompromisoAhora
                      ? 'Comprometido. Tocar para marcarlo como variable'
                      : 'Variable. Tocar para marcarlo como comprometido'}
                  />
                </View>
              </View>
            )}
            panel={(
              <ListaDeOpciones
                theme={theme}
                opciones={opcionesDeCategoria}
                seleccionado={categoriaId}
                onElegir={(valor: categories.CategoryId | null) => {
                  setCategoriaId(valor);
                  setEligiendoCategoria(false);
                }}
              />
            )}
          />
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
            comprometido: pideCategoria ? comprometido : null,
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

function Campo(
  { styles, etiqueta, children, estilo }:
  { styles: Estilos; etiqueta: string; children: ReactNode; estilo?: StyleProp<ViewStyle> },
) {
  return (
    <View style={[styles.campo, estilo]}>
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
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.lg, color: theme.tinta },
    cancelar: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },

    selector: {
      flexDirection: 'row',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    opcion: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    opcionActiva: { backgroundColor: theme.tinta },
    opcionTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    opcionTextoActivo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.fondo },

    campo: { gap: spacing.sm },
    /**
     * Elevado para que la lista de categorias se abra **encima** de lo que
     * sigue. `ConDesplegable` ya se eleva, pero solo compite dentro de su propio
     * contexto de apilado: sin esto, el interruptor y el boton de guardar
     * --que vienen despues en el orden del documento-- se dibujaban sobre la
     * lista abierta.
     */
    campoDeCategoria: { zIndex: capas.desplegable },
    filaChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    claseDeGasto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    claseTexto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.xs,
      color: theme.silencio,
    },
    etiqueta: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: fontSizes.xs,
      color: theme.silencio,
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
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    ayuda: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    error: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },


    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    guardarApagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.sobreAcento },

    borrar: { paddingVertical: spacing.md, alignItems: 'center' },
    borrarTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },
  });
}
