/**
 * Alta y edición de una cuenta: la ruta `nueva` crea y cualquier otra edita.
 *
 * El saldo inicial es el campo que nadie espera y el que importa: cuánto había
 * antes del primer movimiento que la app conoce. Sin él, el saldo de la app no
 * cuadra con el del banco.
 */

import { money } from '@iceberg/core';
import {
  TIPOS_DE_CUENTA, borrarCuenta, crearCuenta, editarCuenta, listarCuentas, obtenerCuenta,
  type TipoDeCuenta,
} from '@iceberg/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../../components/Boton';
import {
  Campo, Entrada, EntradaDeMonto, ErrorDelFormulario, Formulario, NoExiste, Opciones, type Opcion,
} from '../../components/Formulario';
import { PantallaModal } from '../../components/PantallaModal';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { NOMBRES_DE_TIPO_DE_CUENTA } from '../../datos/cuenta';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { volver } from '../../datos/navegacion';

const TIPOS: readonly Opcion<TipoDeCuenta>[] = TIPOS_DE_CUENTA.map(
  (tipo) => ({ valor: tipo, etiqueta: NOMBRES_DE_TIPO_DE_CUENTA[tipo] }),
);

const AL_COMPARTIR: readonly Opcion<boolean>[] = [
  { valor: true, etiqueta: 'Se incluye', accesible: 'Incluir esta cuenta al compartir' },
  { valor: false, etiqueta: 'Queda fuera', accesible: 'Dejar esta cuenta fuera al compartir' },
];

export default function EditarCuenta() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
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
  const [comparte, setComparte] = useState(cuenta === null || cuenta.sincroniza === 1);
  const [error, setError] = useState<string | null>(null);

  const saldoParseado = saldo.trim() === '' ? money.money(0) : money.parseMoney(saldo);
  const puedeGuardar = nombre.trim().length > 0 && saldoParseado !== null;
  // Sin ninguna cuenta la app no puede registrar movimientos.
  const esLaUnica = !esNueva && listarCuentas(db, contexto).length <= 1;

  if (!esNueva && cuenta === null) {
    return (
      <PantallaModal>
        <NoExiste mensaje="Esa cuenta ya no existe" />
      </PantallaModal>
    );
  }

  function guardar() {
    if (!puedeGuardar || saldoParseado === null) return;
    try {
      const datos = {
        nombre, tipo, saldoInicialMinor: saldoParseado.amountMinor, sincroniza: comparte,
      };
      if (cuenta === null) crearCuenta(db, contexto, datos);
      else editarCuenta(db, contexto, cuenta.id, datos);
      avisar(cuenta === null ? 'Cuenta creada' : 'Cambios guardados');
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <Formulario titulo={esNueva ? 'Nueva cuenta' : 'Editar cuenta'} onCancelar={() => volver(router)}>
        <Campo etiqueta="Nombre">
          <Entrada
            value={nombre}
            onChangeText={setNombre}
            placeholder="Cuenta corriente, tarjeta, efectivo…"
            accessibilityLabel="Nombre"
          />
        </Campo>

        <Campo etiqueta="Tipo">
          <Opciones opciones={TIPOS} valor={tipo} onElegir={setTipo} />
        </Campo>

        <EntradaDeMonto
          etiqueta="Saldo inicial"
          valor={saldo}
          onCambiar={setSaldo}
          ayuda="Cuánto había antes del primer movimiento que registres. Sin esto, el saldo de la app no coincide con el del banco."
        />

        {/* Compartir es una propiedad de la cuenta: se cambia acá, y la lista
            de Ajustes solo lo muestra. */}
        <Campo
          etiqueta="Al compartir"
          ayuda="Fuera, esta cuenta no viaja a la carpeta compartida: la otra persona no la ve, y lo que ella mande de esta cuenta tampoco entra."
        >
          <Opciones opciones={AL_COMPARTIR} valor={comparte} onElegir={setComparte} />
        </Campo>

        <ErrorDelFormulario error={error} />

        <Boton
          variante="principal"
          etiqueta="Guardar"
          accesible="Guardar cuenta"
          onPress={guardar}
          deshabilitado={!puedeGuardar}
        />

        {esNueva ? null : esLaUnica ? (
          <Text style={styles.nota}>
            Es la única cuenta y no se puede borrar: sin ninguna, la app no puede registrar
            movimientos.
          </Text>
        ) : (
          <Boton
            variante="peligro"
            etiqueta="Borrar. Sus movimientos se quedan."
            confirmar="Tocar de nuevo para borrarla"
            onPress={() => {
              borrarCuenta(db, contexto, cuenta!.id);
              avisar('Cuenta borrada');
              volver(router);
            }}
            estilo={styles.borrar}
          />
        )}
      </Formulario>
    </PantallaModal>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    nota: t.nota,
    borrar: { alignSelf: 'center' },
  });
}
