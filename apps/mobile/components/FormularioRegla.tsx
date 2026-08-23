/**
 * Formulario de una cuenta periodica, compartido por el alta y la edicion.
 *
 * No toca la base: arma los datos y los entrega, igual que
 * `FormularioMovimiento`. Quien lo usa decide si eso es un `crearRegla` o un
 * `editarRegla`.
 *
 * La parte que importa es la de abajo: **la regla se muestra escrita y con sus
 * proximas fechas**. Un formulario de recurrencia con tres campos sueltos
 * —frecuencia, cada, desde— no deja ver que va a pasar, y "el 31 de cada mes"
 * hace algo distinto en febrero de lo que uno supone. Ver las fechas antes de
 * guardar es lo que evita la sorpresa.
 */

import { dates, money, recurrence } from '@iceberg/core';
import type { TipoDeMovimiento } from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ConDesplegable } from './ConDesplegable';
import { ChipDisparador, ListaDeOpciones } from './SelectorDesplegable';
import { iconoDeCategoria } from './iconos';
import { useCategorias } from '../datos/catalogo';

export interface ValoresDeRegla {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly nombre: string;
  /** `string` y no `CategoryId`: ver `FormularioMovimiento`. */
  readonly categoriaId: string | null;
  readonly frecuencia: recurrence.Frecuencia;
  readonly cada: number;
  readonly desde: dates.PlainDate;
  readonly hasta: dates.PlainDate | null;
}

const FRECUENCIAS: readonly { valor: recurrence.Frecuencia; etiqueta: string }[] = [
  { valor: 'mensual', etiqueta: 'Mensual' },
  { valor: 'semanal', etiqueta: 'Semanal' },
  { valor: 'anual', etiqueta: 'Anual' },
  { valor: 'diaria', etiqueta: 'Diaria' },
];

/** Cuantas fechas se muestran de anticipo. Con tres ya se ve el patron. */
const ANTICIPO = 3;

export function FormularioRegla({
  theme, titulo, inicial, onGuardar, onCancelar, onBorrar, error,
}: {
  theme: Theme;
  titulo: string;
  inicial?: Partial<ValoresDeRegla>;
  onGuardar: (valores: ValoresDeRegla) => void;
  onCancelar: () => void;
  onBorrar?: () => void;
  error?: string | null;
}) {
  const styles = crearEstilos(theme);
  const categorias = useCategorias();

  const [tipo, setTipo] = useState<TipoDeMovimiento>(inicial?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(
    inicial?.montoMinor === undefined ? '' : money.formatNumber(money.money(inicial.montoMinor)),
  );
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [categoriaId, setCategoriaId] = useState<string | null>(
    inicial?.categoriaId ?? null,
  );
  const [frecuencia, setFrecuencia] = useState<recurrence.Frecuencia>(inicial?.frecuencia ?? 'mensual');
  const [cada, setCada] = useState(String(inicial?.cada ?? 1));
  const [desde, setDesde] = useState<string>(inicial?.desde ?? dates.today());
  const [hasta, setHasta] = useState<string>(inicial?.hasta ?? '');
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const montoParseado = money.parseMoney(monto);
  const desdeParseado = dates.parsePlainDate(desde);
  // Vacio significa "no termina", que es distinto de una fecha mal escrita.
  const hastaParseado = hasta.trim() === '' ? null : dates.parsePlainDate(hasta);
  const hastaMalEscrito = hasta.trim() !== '' && hastaParseado === null;
  const cadaParseado = /^\d+$/.test(cada.trim()) ? Number(cada.trim()) : null;
  const pideCategoria = tipo === 'gasto';

  const regla = desdeParseado !== null && cadaParseado !== null
    ? { frecuencia, cada: cadaParseado, desde: desdeParseado, hasta: hastaParseado }
    : null;
  const problemaDeRegla = regla === null ? null : recurrence.validarRegla(regla);

  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && regla !== null
    && problemaDeRegla === null
    && !hastaMalEscrito;

  // Las proximas fechas, para ver la regla antes de guardarla.
  const proximas = useMemo(() => {
    if (regla === null || problemaDeRegla !== null) return [];
    const fechas: dates.PlainDate[] = [];
    let cursor = regla.desde;
    for (let i = 0; i < ANTICIPO; i += 1) {
      const proxima = recurrence.proximaOcurrencia(regla, cursor);
      if (proxima === null) break;
      fechas.push(proxima);
      cursor = dates.addDays(proxima, 1);
    }
    return fechas;
  }, [regla?.frecuencia, regla?.cada, regla?.desde, regla?.hasta, problemaDeRegla]);

  const opcionesDeCategoria = useMemo(() => [
    { valor: null, etiqueta: 'Sin categoría' },
    ...categorias.todas.map((categoria) => ({
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
          placeholder="Arriendo, luz, internet…"
          placeholderTextColor={theme.silencio}
          style={styles.entrada}
          accessibilityLabel="Descripción"
        />
      </Campo>

      {pideCategoria ? (
        <Campo styles={styles} etiqueta="Categoría">
          <ConDesplegable
            abierto={eligiendoCategoria}
            disparador={(
              <View style={styles.filaChip}>
                <ChipDisparador
                  theme={theme}
                  etiqueta={categorias.nombreCorto(categoriaId)}
                  icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
                  abierto={eligiendoCategoria}
                  activo={categoriaId !== null}
                  onPress={() => setEligiendoCategoria(!eligiendoCategoria)}
                  accesible={
                    categoriaId === null
                      ? 'Elegir categoría'
                      : `Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`
                  }
                />
              </View>
            )}
            panel={(
              <ListaDeOpciones
                theme={theme}
                opciones={opcionesDeCategoria}
                seleccionado={categoriaId}
                onElegir={(valor: string | null) => {
                  setCategoriaId(valor);
                  setEligiendoCategoria(false);
                }}
              />
            )}
          />
        </Campo>
      ) : null}

      <Campo styles={styles} etiqueta="Cada cuánto">
        <View style={styles.selector}>
          {FRECUENCIAS.map((opcion) => (
            <Pressable
              key={opcion.valor}
              onPress={() => setFrecuencia(opcion.valor)}
              style={[styles.opcion, frecuencia === opcion.valor && styles.opcionActiva]}
              accessibilityRole="radio"
              accessibilityState={{ selected: frecuencia === opcion.valor }}
            >
              <Text style={frecuencia === opcion.valor ? styles.opcionTextoActivo : styles.opcionTexto}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          ))}
        </View>
      </Campo>

      <Campo styles={styles} etiqueta="Repetir cada">
        <View style={styles.filaRepetir}>
          <TextInput
            value={cada}
            onChangeText={setCada}
            keyboardType="numeric"
            inputMode="numeric"
            style={styles.entradaCorta}
            accessibilityLabel="Repetir cada"
          />
          <Text style={styles.unidad}>{UNIDADES[frecuencia]}</Text>
        </View>
      </Campo>

      <Campo styles={styles} etiqueta="Primera vez">
        <TextInput
          value={desde}
          onChangeText={setDesde}
          placeholder="AAAA-MM-DD"
          placeholderTextColor={theme.silencio}
          style={styles.entrada}
          autoCapitalize="none"
          accessibilityLabel="Primera vez"
        />
        {desdeParseado === null ? (
          <Text style={styles.aviso}>Fecha inválida. El formato es AAAA-MM-DD.</Text>
        ) : null}
      </Campo>

      <Campo styles={styles} etiqueta="Hasta">
        <TextInput
          value={hasta}
          onChangeText={setHasta}
          placeholder="Sin término"
          placeholderTextColor={theme.silencio}
          style={styles.entrada}
          autoCapitalize="none"
          accessibilityLabel="Hasta"
        />
        {hastaMalEscrito ? (
          <Text style={styles.aviso}>Fecha inválida. Déjalo vacío si no termina.</Text>
        ) : null}
      </Campo>

      {/* El resumen es la parte util del formulario: dice que se va a guardar. */}
      <View style={styles.resumen}>
        {problemaDeRegla !== null ? (
          <Text style={styles.aviso}>{problemaDeRegla}</Text>
        ) : regla !== null ? (
          <>
            <Text style={styles.resumenTexto}>{recurrence.describirRegla(regla)}</Text>
            {proximas.length > 0 ? (
              <Text style={styles.resumenFechas}>
                Próximas: {proximas.map((f) => dates.formatDate(f)).join(' · ')}
              </Text>
            ) : (
              <Text style={styles.aviso}>Con esas fechas no ocurre nunca.</Text>
            )}
          </>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => {
          if (!puedeGuardar || montoParseado === null || regla === null) return;
          onGuardar({
            tipo,
            montoMinor: montoParseado.amountMinor,
            nombre,
            categoriaId: pideCategoria ? categoriaId : null,
            frecuencia: regla.frecuencia,
            cada: regla.cada,
            desde: regla.desde,
            hasta: regla.hasta,
          });
        }}
        disabled={!puedeGuardar}
        style={[styles.guardar, !puedeGuardar && styles.guardarApagado]}
        accessibilityRole="button"
        accessibilityLabel="Guardar cuenta periódica"
      >
        <Text style={styles.guardarTexto}>Guardar</Text>
      </Pressable>

      {onBorrar ? (
        <Pressable
          onPress={() => (confirmandoBorrado ? onBorrar() : setConfirmandoBorrado(true))}
          style={styles.borrar}
          accessibilityRole="button"
          accessibilityLabel={confirmandoBorrado ? 'Confirmar borrado' : 'Borrar cuenta periódica'}
        >
          <Text style={styles.borrarTexto}>
            {confirmandoBorrado
              ? 'Tocar de nuevo para confirmar'
              : 'Borrar. Lo ya pagado se queda.'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const UNIDADES: Record<recurrence.Frecuencia, string> = {
  diaria: 'días',
  semanal: 'semanas',
  mensual: 'meses',
  anual: 'años',
};

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
      gap: spacing.lg,
    },
    encabezado: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.xxl,
    },
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.bold, fontSize: fontSizes.xl, color: theme.tinta },
    cancelar: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },

    selector: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    opcion: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    opcionActiva: { backgroundColor: theme.acento, borderColor: theme.acento },
    opcionTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    opcionTextoActivo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.sobreAcento },

    campo: { gap: spacing.xs },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    entrada: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    entradaCorta: {
      width: 64,
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
      textAlign: 'center',
    },
    filaRepetir: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    unidad: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.sm, color: theme.silencio },
    filaMonto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    simbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.lg, color: theme.silencio },
    entradaMonto: {
      flex: 1,
      fontFamily: fonts.mono,
      fontWeight: pesos.medium,
      fontSize: fontSizes.xl,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    filaChip: { flexDirection: 'row' },

    resumen: {
      gap: 2,
      padding: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    resumenTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.tinta },
    resumenFechas: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencio },

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
    borrarTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
  });
}
