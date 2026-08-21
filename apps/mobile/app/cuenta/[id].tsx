/**
 * Alta y edición de una cuenta.
 *
 * Una sola pantalla para las dos cosas: la ruta `nueva` crea y cualquier otra
 * edita. Separarlas sería duplicar el mismo formulario y el mismo validador.
 *
 * El **saldo inicial** es el campo que importa y el que nadie espera: es cuánto
 * había en la cuenta antes del primer movimiento que la app conoce. Sin él, el
 * saldo que muestra la app no es el del banco y no hay forma de cuadrarlos.
 */

import { money } from '@iceberg/core';
import {
  TIPOS_DE_CUENTA, borrarCuenta, crearCuenta, editarCuenta, listarCuentas, obtenerCuenta,
  type TipoDeCuenta,
} from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDatos } from '../../datos/BaseDeDatos';
import { volver } from '../../datos/navegacion';
import { useTema } from '../../datos/tema';
import { PantallaModal } from '../../components/PantallaModal';

const NOMBRES: Record<TipoDeCuenta, string> = {
  corriente: 'Corriente',
  vista: 'Vista',
  ahorro: 'Ahorro',
  credito: 'Crédito',
  efectivo: 'Efectivo',
};

export default function EditarCuenta() {
  const { theme } = useTema();
  const styles = crearEstilos(theme);
  const { db, contexto } = useDatos();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const esNueva = id === 'nueva';
  const cuenta = useMemo(
    () => (esNueva ? null : obtenerCuenta(db, contexto, id)),
    [db, contexto, id, esNueva],
  );

  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [tipo, setTipo] = useState<TipoDeCuenta>(cuenta?.tipo ?? 'corriente');
  const [saldo, setSaldo] = useState(
    cuenta === null ? '' : money.formatNumber(money.money(cuenta.saldoInicialMinor)),
  );
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vacio vale cero: es lo que uno quiere decir al dejarlo en blanco.
  const saldoParseado = saldo.trim() === '' ? money.money(0) : money.parseMoney(saldo);
  const puedeGuardar = nombre.trim().length > 0 && saldoParseado !== null;

  // La ultima cuenta no se puede borrar: sin ninguna, la app no deja escribir.
  const esLaUnica = !esNueva && listarCuentas(db, contexto).length <= 1;

  function guardar() {
    if (!puedeGuardar || saldoParseado === null) return;
    try {
      const datos = { nombre, tipo, saldoInicialMinor: saldoParseado.amountMinor };
      if (cuenta === null) crearCuenta(db, contexto, datos);
      else editarCuenta(db, contexto, cuenta.id, datos);
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!esNueva && cuenta === null) {
    return (
      <PantallaModal>
        <Text style={styles.ayuda}>Esa cuenta ya no existe.</Text>
      </PantallaModal>
    );
  }

  return (
    <PantallaModal>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>{esNueva ? 'Nueva cuenta' : 'Editar cuenta'}</Text>
          <Pressable onPress={() => volver(router)} accessibilityRole="button">
            <Text style={styles.cancelar}>Cancelar</Text>
          </Pressable>
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Nombre</Text>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            placeholder="Cuenta corriente, tarjeta, efectivo…"
            placeholderTextColor={theme.silencio}
            style={styles.entrada}
            accessibilityLabel="Nombre"
          />
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Tipo</Text>
          <View style={styles.selector}>
            {TIPOS_DE_CUENTA.map((opcion) => (
              <Pressable
                key={opcion}
                onPress={() => setTipo(opcion)}
                style={[styles.opcion, tipo === opcion && styles.opcionActiva]}
                accessibilityRole="radio"
                accessibilityState={{ selected: tipo === opcion }}
              >
                <Text style={tipo === opcion ? styles.opcionTextoActivo : styles.opcionTexto}>
                  {NOMBRES[opcion]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.campo}>
          <Text style={styles.etiqueta}>Saldo inicial</Text>
          <View style={styles.filaMonto}>
            <Text style={styles.simbolo}>$</Text>
            <TextInput
              value={saldo}
              onChangeText={setSaldo}
              placeholder="0"
              placeholderTextColor={theme.silencio}
              keyboardType="numeric"
              inputMode="numeric"
              style={styles.entradaMonto}
              accessibilityLabel="Saldo inicial"
            />
          </View>
          <Text style={styles.ayuda}>
            Cuánto había antes del primer movimiento que registres. Sin esto, el saldo de
            la app no coincide con el del banco.
          </Text>
          {saldo.trim() !== '' && saldoParseado === null ? (
            <Text style={styles.aviso}>No se entiende ese monto. Sin decimales: el peso no los tiene.</Text>
          ) : null}
        </View>

        {error !== null ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={guardar}
          disabled={!puedeGuardar}
          style={[styles.guardar, !puedeGuardar && styles.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Guardar cuenta"
        >
          <Text style={styles.guardarTexto}>Guardar</Text>
        </Pressable>

        {esNueva ? null : esLaUnica ? (
          <Text style={styles.ayuda}>
            Es la única cuenta. No se puede borrar: sin ninguna, la app no puede registrar
            movimientos.
          </Text>
        ) : (
          <Pressable
            onPress={() => {
              if (!confirmandoBorrado) {
                setConfirmandoBorrado(true);
                return;
              }
              borrarCuenta(db, contexto, cuenta!.id);
              volver(router);
            }}
            style={styles.borrar}
            accessibilityRole="button"
            accessibilityLabel={confirmandoBorrado ? 'Confirmar borrado' : 'Borrar cuenta'}
          >
            <Text style={styles.borrarTexto}>
              {confirmandoBorrado
                ? 'Tocar de nuevo para confirmar'
                : 'Borrar. Sus movimientos se quedan.'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </PantallaModal>
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

    ayuda: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    error: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.sm, color: theme.vencidoTexto },

    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    apagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.md, color: theme.sobreAcento },
    borrar: { paddingVertical: spacing.md, alignItems: 'center' },
    borrarTexto: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.vencidoTexto },
  });
}
