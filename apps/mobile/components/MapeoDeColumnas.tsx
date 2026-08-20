/**
 * Decir a mano qué columna es cuál, para bancos que la app no reconoce.
 *
 * La detección automática busca los encabezados de Banco de Chile. Cualquier
 * otro banco los escribe distinto y la detección falla, así que sin esta
 * pantalla el importador serviría para un solo banco.
 *
 * Lo que la hace usable es **mostrar la hoja**. Preguntar "¿en qué columna está
 * la fecha?" sin enseñar el archivo obliga a abrirlo en otro programa, contar
 * columnas y volver. Con la grilla a la vista se toca y se ve.
 */

import type { csv } from '@iceberg/core';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

/** Cuántas filas se muestran. Con esto alcanza para ver dónde empieza la tabla. */
const FILAS_VISIBLES = 18;

/** Los campos que hay que asignar. `null` en `obligatorio` significa opcional. */
const CAMPOS = [
  { clave: 'fecha', etiqueta: 'Fecha', obligatorio: true },
  { clave: 'descripcion', etiqueta: 'Descripción', obligatorio: true },
  { clave: 'cargos', etiqueta: 'Cargos', obligatorio: true },
  { clave: 'abonos', etiqueta: 'Abonos', obligatorio: true },
  { clave: 'canal', etiqueta: 'Canal', obligatorio: false },
  { clave: 'saldo', etiqueta: 'Saldo', obligatorio: false },
] as const;

type Campo = (typeof CAMPOS)[number]['clave'];

function celda(valor: csv.Celda): string {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

export function MapeoDeColumnas(
  { matriz, inicial, theme, onAplicar, onCancelar }: {
    matriz: csv.Matriz;
    /** El mapeo detectado, si lo hubo. Sirve de punto de partida. */
    inicial: csv.MapeoDeColumnas | null;
    theme: Theme;
    onAplicar: (mapeo: csv.MapeoDeColumnas) => void;
    onCancelar: () => void;
  },
) {
  const styles = crearEstilos(theme);

  const [filaEncabezado, setFilaEncabezado] = useState(inicial?.filaEncabezado ?? 0);
  const [columnas, setColumnas] = useState<Record<Campo, number | null>>({
    fecha: inicial?.fecha ?? null,
    descripcion: inicial?.descripcion ?? null,
    cargos: inicial?.cargos ?? null,
    abonos: inicial?.abonos ?? null,
    canal: inicial?.canal ?? null,
    saldo: inicial?.saldo ?? null,
  });
  const [asignando, setAsignando] = useState<Campo | null>(null);

  const anchoMaximo = matriz.reduce((mayor, fila) => Math.max(mayor, fila.length), 0);
  const completo = CAMPOS
    .filter((c) => c.obligatorio)
    .every((c) => columnas[c.clave] !== null);

  /** Qué campo tiene asignada esa columna, para pintarla en la grilla. */
  const campoDe = (indice: number): Campo | null => {
    const encontrado = CAMPOS.find((c) => columnas[c.clave] === indice);
    return encontrado?.clave ?? null;
  };

  return (
    <View style={styles.raiz}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Ajustar columnas</Text>
        <Pressable onPress={onCancelar} accessibilityRole="button">
          <Text style={styles.cancelar}>Volver</Text>
        </Pressable>
      </View>

      <Text style={styles.ayuda}>
        {asignando === null
          ? 'Toca un campo y después la columna que le corresponde. La fila del encabezado se elige tocando su número.'
          : `Toca la columna que tiene ${CAMPOS.find((c) => c.clave === asignando)?.etiqueta.toLowerCase()}.`}
      </Text>

      <View style={styles.campos}>
        {CAMPOS.map((campo) => {
          const asignada = columnas[campo.clave];
          const activo = asignando === campo.clave;
          return (
            <Pressable
              key={campo.clave}
              onPress={() => setAsignando(activo ? null : campo.clave)}
              style={[styles.campo, activo && styles.campoActivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={`Asignar la columna de ${campo.etiqueta}`}
            >
              <Text style={activo ? styles.campoTextoActivo : styles.campoTexto}>
                {campo.etiqueta}
                {campo.obligatorio ? '' : ' ·'}
                {asignada === null ? ' —' : ` ${letra(asignada)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.grilla}>
        <View>
          <View style={styles.filaGrilla}>
            <View style={styles.numeroFila} />
            {Array.from({ length: anchoMaximo }, (_, c) => {
              const campo = campoDe(c);
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    if (asignando === null) return;
                    setColumnas((previo) => ({ ...previo, [asignando]: c }));
                    setAsignando(null);
                  }}
                  style={[styles.celdaEncabezado, campo !== null && styles.celdaAsignada]}
                  accessibilityRole="button"
                  accessibilityLabel={`Columna ${letra(c)}`}
                >
                  <Text style={styles.letra}>{letra(c)}</Text>
                </Pressable>
              );
            })}
          </View>

          {matriz.slice(0, FILAS_VISIBLES).map((fila, f) => (
            <View key={f} style={styles.filaGrilla}>
              <Pressable
                onPress={() => setFilaEncabezado(f)}
                style={[styles.numeroFila, f === filaEncabezado && styles.filaElegida]}
                accessibilityRole="button"
                accessibilityLabel={`Usar la fila ${f + 1} como encabezado`}
              >
                <Text style={f === filaEncabezado ? styles.numeroTextoElegido : styles.numeroTexto}>
                  {f + 1}
                </Text>
              </Pressable>
              {Array.from({ length: anchoMaximo }, (_, c) => (
                <View
                  key={c}
                  style={[styles.celda, campoDe(c) !== null && styles.celdaAsignada]}
                >
                  <Text style={styles.celdaTexto} numberOfLines={1}>{celda(fila[c])}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          if (!completo) return;
          onAplicar({
            filaEncabezado,
            fecha: columnas.fecha!,
            descripcion: columnas.descripcion!,
            cargos: columnas.cargos!,
            abonos: columnas.abonos!,
            canal: columnas.canal,
            saldo: columnas.saldo,
          });
        }}
        disabled={!completo}
        style={[styles.aplicar, !completo && styles.apagado]}
        accessibilityRole="button"
        accessibilityLabel="Aplicar el mapeo"
      >
        <Text style={styles.aplicarTexto}>
          {completo ? 'Usar estas columnas' : 'Falta asignar fecha, descripción, cargos y abonos'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * El indice como letra de columna, que es como las nombra una planilla.
 *
 * Ojo: es el indice **dentro de la matriz**, no la letra real del archivo. Las
 * cartolas de Banco de Chile empiezan en la columna B, asi que su indice 0 es la
 * B del Excel. Igual sirve para senalar, que es para lo que esta.
 */
function letra(indice: number): string {
  let n = indice;
  let salida = '';
  do {
    salida = String.fromCharCode(65 + (n % 26)) + salida;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return salida;
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    raiz: { gap: spacing.md },
    encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titulo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.tinta },
    cancelar: { fontFamily: fonts.ui, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.silencio },
    ayuda: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio },

    campos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    campo: {
      paddingVertical: 5,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    campoActivo: { backgroundColor: theme.acento, borderColor: theme.acento },
    campoTexto: { fontFamily: fonts.ui, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    campoTextoActivo: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.sobreAcento },

    grilla: {
      maxHeight: 260,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      backgroundColor: theme.superficie,
    },
    filaGrilla: { flexDirection: 'row' },
    numeroFila: {
      width: 28,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
      borderRightWidth: elevation.hairlineWidth,
      borderRightColor: theme.hairline,
    },
    filaElegida: { backgroundColor: theme.acento },
    numeroTexto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 9, color: theme.silencio },
    numeroTextoElegido: { fontFamily: fonts.mono, fontWeight: pesos.bold, fontSize: 9, color: theme.sobreAcento },

    celdaEncabezado: {
      width: 110,
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    letra: { fontFamily: fonts.mono, fontWeight: pesos.bold, fontSize: 9, color: theme.silencio },
    celda: { width: 110, paddingVertical: 4, paddingHorizontal: spacing.xs },
    celdaAsignada: { backgroundColor: theme.fondo },
    celdaTexto: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 9, color: theme.tinta },

    aplicar: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
    },
    apagado: { opacity: 0.4 },
    aplicarTexto: { fontFamily: fonts.ui, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.sobreAcento },
  });
}
