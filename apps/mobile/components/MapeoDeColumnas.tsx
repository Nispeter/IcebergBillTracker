/**
 * Decir a mano qué columna es cuál, para bancos que la app no reconoce sola.
 *
 * Lo que la hace usable es mostrar la hoja: con la grilla a la vista se toca un
 * campo, se toca su columna, y no hay que abrir el archivo en otro programa a
 * contar columnas.
 */

import type { csv } from '@iceberg/core';
import { elevation, radii, spacing } from '@iceberg/ui';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton } from './Boton';
import { useEstilos, type Estilo } from '../datos/estilos';

/** Con esto alcanza para ver dónde empieza la tabla. */
const FILAS_VISIBLES = 18;

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
  return valor === null || valor === undefined ? '' : String(valor);
}

/**
 * El índice como letra de columna, como en una planilla. Es el índice dentro
 * de la matriz, no la letra real del archivo, pero para señalar alcanza.
 */
function letraDeColumna(indice: number): string {
  let n = indice;
  let salida = '';
  do {
    salida = String.fromCharCode(65 + (n % 26)) + salida;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return salida;
}

export function MapeoDeColumnas(
  { matriz, inicial, onAplicar, onCancelar }: {
    matriz: csv.Matriz;
    /** El mapeo detectado, si lo hubo: el punto de partida. */
    inicial: csv.MapeoDeColumnas | null;
    onAplicar: (mapeo: csv.MapeoDeColumnas) => void;
    onCancelar: () => void;
  },
) {
  const styles = useEstilos(crearEstilos);

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
  const completo = CAMPOS.filter((c) => c.obligatorio).every((c) => columnas[c.clave] !== null);
  const campoDe = (indice: number): Campo | null =>
    CAMPOS.find((c) => columnas[c.clave] === indice)?.clave ?? null;

  return (
    <View style={styles.raiz}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo} accessibilityRole="header">Ajustar columnas</Text>
        <Boton variante="texto" etiqueta="Volver" onPress={onCancelar} />
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
                {asignada === null ? ' —' : ` ${letraDeColumna(asignada)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.grilla}>
        <View>
          <View style={styles.filaGrilla}>
            <View style={styles.numeroFila} />
            {Array.from({ length: anchoMaximo }, (_, c) => (
              <Pressable
                key={c}
                onPress={() => {
                  if (asignando === null) return;
                  setColumnas((previo) => ({ ...previo, [asignando]: c }));
                  setAsignando(null);
                }}
                style={[styles.celdaEncabezado, campoDe(c) !== null && styles.celdaAsignada]}
                accessibilityRole="button"
                accessibilityLabel={`Columna ${letraDeColumna(c)}`}
              >
                <Text style={styles.letra}>{letraDeColumna(c)}</Text>
              </Pressable>
            ))}
          </View>

          {matriz.slice(0, FILAS_VISIBLES).map((fila, f) => (
            <View key={f} style={styles.filaGrilla}>
              <Pressable
                onPress={() => setFilaEncabezado(f)}
                style={[styles.numeroFila, f === filaEncabezado && styles.filaElegida]}
                accessibilityRole="button"
                accessibilityLabel={`Usar la fila ${f + 1} como encabezado`}
              >
                <Text style={f === filaEncabezado ? styles.numeroElegido : styles.numero}>{f + 1}</Text>
              </Pressable>
              {Array.from({ length: anchoMaximo }, (_, c) => (
                <View key={c} style={[styles.celda, campoDe(c) !== null && styles.celdaAsignada]}>
                  <Text style={styles.celdaTexto} numberOfLines={1}>{celda(fila[c])}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Boton
        variante="principal"
        etiqueta={completo ? 'Usar estas columnas' : 'Falta asignar fecha, descripción, cargos y abonos'}
        accesible="Aplicar el mapeo"
        deshabilitado={!completo}
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
      />
    </View>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const chica = { ...t.cifraDeGrafico };
  return StyleSheet.create({
    raiz: { gap: spacing.md },
    encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    titulo: t.subtitulo,
    ayuda: { ...t.nota, lineHeight: t.cuerpo.fontSize + 4 },

    campos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    campo: {
      paddingVertical: 5,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    campoActivo: { backgroundColor: theme.tinta, borderColor: theme.tinta },
    campoTexto: { ...t.etiqueta, color: theme.tinta },
    campoTextoActivo: { ...t.etiqueta, fontWeight: t.seccion.fontWeight, color: theme.fondo },

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
    filaElegida: { backgroundColor: theme.tinta },
    numero: chica,
    numeroElegido: { ...chica, fontWeight: t.titulo.fontWeight, color: theme.fondo },
    celdaEncabezado: {
      width: 110,
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      alignItems: 'center',
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    letra: { ...chica, fontWeight: t.titulo.fontWeight },
    celda: { width: 110, paddingVertical: 4, paddingHorizontal: spacing.xs },
    celdaAsignada: { backgroundColor: theme.fondo },
    celdaTexto: { ...chica, color: theme.tinta },
  });
}
