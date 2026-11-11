/**
 * Importar una cartola.
 *
 * Lo importante es la vista previa: antes de escribir nada dice cuántos
 * movimientos entran, cuántos ya estaban, cuántos quedan sin categoría y si el
 * archivo cuadra con el saldo del banco. Descubrir después de importar que era
 * el archivo equivocado es lo que esta pantalla evita.
 */

import { csv, dates, money } from '@iceberg/core';
import {
  importarLote, listarCuentas, previsualizarImportacion, type Previsualizacion,
} from '@iceberg/db';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../components/Boton';
import { ErrorDelFormulario, Formulario } from '../components/Formulario';
import { MapeoDeColumnas } from '../components/MapeoDeColumnas';
import { Dato, Panel } from '../components/Panel';
import { PantallaModal } from '../components/PantallaModal';
import { elegirCartola } from '../datos/archivo';
import { useAvisar } from '../datos/aviso';
import { useDatos } from '../datos/BaseDeDatos';
import { useEstilos, type Estilo } from '../datos/estilos';
import { volver } from '../datos/navegacion';

interface Leido {
  readonly nombre: string;
  readonly cartola: csv.CartolaLeida;
  readonly previa: Previsualizacion;
}

/** El archivo elegido, guardado para poder releerlo con otro mapeo sin pedirlo de nuevo. */
interface Archivo {
  readonly nombre: string;
  readonly matriz: csv.Matriz;
}

export default function Importar() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const router = useRouter();

  const [leyendo, setLeyendo] = useState(false);
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [leido, setLeido] = useState<Leido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);

  /** Lee la matriz con el mapeo dado, o con el que se detecte. */
  function interpretar(elArchivo: Archivo, mapeo?: csv.MapeoDeColumnas) {
    const resultado = csv.parsearCartola(elArchivo.matriz, mapeo);
    if (!resultado.ok) {
      setError(resultado.motivo);
      setLeido(null);
      // Si no se pudo leer sola, se ofrece el mapeo a mano en vez de un error sin salida.
      setAjustando(true);
      return;
    }

    const cuenta = listarCuentas(db, contexto)[0];
    if (!cuenta) {
      setError('No hay ninguna cuenta creada todavía.');
      return;
    }

    setError(null);
    setAjustando(false);
    setLeido({
      nombre: elArchivo.nombre,
      cartola: resultado.cartola,
      previa: previsualizarImportacion(db, contexto, {
        cuentaId: cuenta.id,
        archivo: elArchivo.nombre,
        movimientos: resultado.cartola.movimientos,
      }),
    });
  }

  async function elegir() {
    setError(null);
    setLeyendo(true);
    try {
      const elegido = await elegirCartola();
      if (elegido === null) return;
      setArchivo(elegido);
      interpretar(elegido);
    } catch (e) {
      setError((e as Error).message);
      setLeido(null);
      setArchivo(null);
    } finally {
      setLeyendo(false);
    }
  }

  function importar() {
    if (leido === null) return;
    try {
      const cuenta = listarCuentas(db, contexto)[0];
      if (!cuenta) return;
      importarLote(db, contexto, {
        cuentaId: cuenta.id,
        archivo: leido.nombre,
        movimientos: leido.cartola.movimientos,
      });
      avisar(`${nuevos(leido)} importados. Se puede deshacer desde Ajustes`);
      volver(router);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <PantallaModal>
      <Formulario titulo="Importar cartola" onCancelar={() => volver(router)}>
        <Text style={styles.ayuda}>
          El archivo .xls que descargas del banco. Nada se guarda hasta que confirmes.
        </Text>

        <Boton
          variante={leido === null ? 'principal' : 'secundario'}
          etiqueta={leido === null ? 'Elegir archivo' : 'Elegir otro'}
          onPress={elegir}
          cargando={leyendo}
        />

        <ErrorDelFormulario error={error} />

        {ajustando && archivo !== null ? (
          <MapeoDeColumnas
            matriz={archivo.matriz}
            inicial={csv.detectarMapeo(archivo.matriz)}
            onAplicar={(mapeo) => interpretar(archivo, mapeo)}
            onCancelar={() => setAjustando(false)}
          />
        ) : null}

        {!ajustando && leido !== null ? <Previa leido={leido} /> : null}

        {!ajustando && archivo !== null ? (
          <Boton
            variante="texto"
            etiqueta="¿Las columnas no calzan? Ajustarlas a mano"
            onPress={() => setAjustando(true)}
          />
        ) : null}

        {!ajustando && leido !== null ? (
          leido.previa.nuevos.length > 0 ? (
            <Boton
              variante="principal"
              etiqueta={`Importar ${nuevos(leido)}`}
              accesible="Confirmar la importación"
              onPress={importar}
            />
          ) : (
            <Text style={styles.ayuda}>
              Todos los movimientos de este archivo ya están importados. No hay nada que hacer.
            </Text>
          )
        ) : null}
      </Formulario>
    </PantallaModal>
  );
}

function nuevos(leido: Leido): string {
  const n = leido.previa.nuevos.length;
  return `${n} ${n === 1 ? 'movimiento' : 'movimientos'}`;
}

function Previa({ leido }: { leido: Leido }) {
  const styles = useEstilos(crearEstilos);
  const { cartola, previa } = leido;
  const sinCategoria = previa.nuevos.length - previa.categorizados;

  return (
    <Panel>
      <Text style={styles.archivo} numberOfLines={1}>{leido.nombre}</Text>
      <Dato etiqueta="Movimientos nuevos" valor={String(previa.nuevos.length)} />
      {previa.duplicados > 0 ? (
        <Dato
          etiqueta="Ya importados"
          valor={String(previa.duplicados)}
          nota="Se saltan: reimportar el mismo archivo no duplica nada."
        />
      ) : null}
      {previa.desde !== null && previa.hasta !== null ? (
        <Dato
          etiqueta="Período"
          valor={`${dates.formatDate(previa.desde)} — ${dates.formatDate(previa.hasta)}`}
        />
      ) : null}
      <Dato
        etiqueta="Con categoría"
        valor={`${previa.categorizados} de ${previa.nuevos.length}`}
        nota={sinCategoria > 0 ? `${sinCategoria} quedan sin categoría. Se pueden asignar después.` : undefined}
      />

      {/* La cuadratura es lo único que avisa de un movimiento perdido al leer. */}
      {cartola.cuadra === true ? (
        <Text style={styles.cuadra}>
          Cuadra con el saldo del banco{cartola.saldoFinal === null ? '' : `: ${money.format(cartola.saldoFinal)}`}
        </Text>
      ) : cartola.cuadra === false ? (
        <Text style={styles.noCuadra}>
          La suma no cuadra con el saldo declarado en la cartola. Puede faltar algún
          movimiento; revisa antes de importar.
        </Text>
      ) : null}
    </Panel>
  );
}

function crearEstilos({ theme, t }: Estilo) {
  const linea = t.cuerpo.fontSize + 5;
  return StyleSheet.create({
    ayuda: { ...t.nota, lineHeight: linea },
    archivo: { ...t.cifra, color: theme.silencioHondo, paddingBottom: 4 },
    cuadra: { ...t.accion, color: theme.ingresoTexto, paddingTop: 4 },
    noCuadra: { ...t.error, lineHeight: linea, paddingTop: 4 },
  });
}
