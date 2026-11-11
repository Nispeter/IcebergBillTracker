/**
 * El formulario de un movimiento, compartido por el alta y la edición.
 *
 * No toca la base: arma los valores y los entrega. Quien lo usa decide si eso
 * es un `crearMovimiento` o un `editarMovimiento`.
 */

import { dates, money } from '@iceberg/core';
import { listarCuentas, type TipoDeMovimiento } from '@iceberg/db';
import { spacing } from '@iceberg/ui';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Boton } from './Boton';
import {
  Campo, Entrada, EntradaDeFecha, EntradaDeMonto, ErrorDelFormulario, Formulario, Opciones,
  type Opcion,
} from './Formulario';
import { iconoDeCategoria } from './iconos';
import { Interruptor } from './Interruptor';
import { Desplegable, useOpcionesDeCategoria } from './SelectorDesplegable';
import { useDatos } from '../datos/BaseDeDatos';
import { useCategorias } from '../datos/catalogo';
import { esComprometido, useComprometidas } from '../datos/consultas';
import { useCuentaActiva } from '../datos/cuenta';
import { useEstilos, type Estilo } from '../datos/estilos';

export interface ValoresDelFormulario {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  /** `string` y no `CategoryId`: las categorías propias no están en el catálogo de la app. */
  readonly categoriaId: string | null;
  /** Si es un compromiso fijo. `null` deja que la app lo deduzca de la categoría. */
  readonly comprometido: boolean | null;
  /** Solo es nulo si no hay ninguna cuenta. */
  readonly cuentaId: string | null;
}

export const TIPOS: readonly Opcion<TipoDeMovimiento>[] = [
  { valor: 'gasto', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];

export function FormularioMovimiento({
  titulo, inicial, onGuardar, onCancelar, onBorrar, error,
}: {
  titulo: string;
  inicial?: Partial<ValoresDelFormulario>;
  onGuardar: (valores: ValoresDelFormulario) => void;
  onCancelar: () => void;
  /** Si viene, se muestra el botón de borrar. */
  onBorrar?: () => void;
  error?: string | null;
}) {
  const styles = useEstilos(crearEstilos);
  const categorias = useCategorias();
  const opcionesDeCategoria = useOpcionesDeCategoria('Sin categoría');

  const [tipo, setTipo] = useState<TipoDeMovimiento>(inicial?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(
    inicial?.montoMinor === undefined ? '' : money.formatNumber(money.money(inicial.montoMinor)),
  );
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [fecha, setFecha] = useState<string>(inicial?.ocurridoEn ?? dates.today());
  const [categoriaId, setCategoriaId] = useState<string | null>(inicial?.categoriaId ?? null);
  // `null` es que nadie lo tocó: el interruptor muestra lo que la app deduce y
  // se guarda nulo, así que la deducción sigue mandando si cambia la categoría.
  const [comprometido, setComprometido] = useState<boolean | null>(inicial?.comprometido ?? null);
  const comprometidas = useComprometidas();
  const esCompromisoAhora = comprometido ?? esComprometido(categoriaId, comprometidas);
  // Uno solo para los dos desplegables: abiertos a la vez se superponen, y es
  // el abierto el que se eleva por encima del otro campo.
  const [desplegable, setDesplegable] = useState<'categoria' | 'cuenta' | null>(null);
  const alternar = (cual: 'categoria' | 'cuenta') =>
    setDesplegable((previo) => (previo === cual ? null : cual));

  const { db, contexto } = useDatos();
  // De una vez y no con `useLiveQuery`, que devuelve `[]` en el primer render:
  // el campo de cuenta aparecía un fotograma tarde y Guardar nacía apagado.
  const cuentas = useMemo(() => listarCuentas(db, contexto), [db, contexto]);
  const { cuentaId: alcance, porDefecto } = useCuentaActiva();
  // `null` es que nadie lo tocó. Al editar trae la cuenta del movimiento, que
  // se respeta aunque se haya borrado: reasignarla sola sería decidir por el usuario.
  const [cuentaElegida, setCuentaElegida] = useState<string | null>(inicial?.cuentaId ?? null);
  // Si nadie la eligió: la que se está mirando, o la de la estrella. Las dos
  // adivinanzas se comprueban contra la lista, porque el alcance puede apuntar
  // a una cuenta borrada.
  const adivinada = alcance ?? porDefecto;
  const cuentaId = cuentaElegida
    ?? (cuentas.some((c) => c.id === adivinada) ? adivinada : cuentas[0]?.id ?? null);

  const montoParseado = money.parseMoney(monto);
  const fechaParseada = dates.parsePlainDate(fecha);
  // Un sueldo no es un tipo de gasto: el ingreso no lleva categoría.
  const pideCategoria = tipo === 'gasto';
  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && fechaParseada !== null
    && cuentaId !== null;

  const opcionesDeCuenta = useMemo(
    () => cuentas.map((cuenta) => ({ valor: cuenta.id as string | null, etiqueta: cuenta.nombre })),
    [cuentas],
  );
  const nombreDeLaCuenta = cuentas.find((c) => c.id === cuentaId)?.nombre ?? 'Elegir cuenta';

  function guardar() {
    if (!puedeGuardar || montoParseado === null || fechaParseada === null) return;
    onGuardar({
      tipo,
      montoMinor: montoParseado.amountMinor,
      ocurridoEn: fechaParseada,
      nombre,
      categoriaId: pideCategoria ? categoriaId : null,
      comprometido: pideCategoria ? comprometido : null,
      cuentaId,
    });
  }

  return (
    <Formulario titulo={titulo} onCancelar={onCancelar}>
      <Opciones opciones={TIPOS} valor={tipo} onElegir={setTipo} />

      <EntradaDeMonto etiqueta="Monto" valor={monto} onCambiar={setMonto} />

      <Campo etiqueta="Descripción">
        <Entrada
          value={nombre}
          onChangeText={setNombre}
          placeholder="Jumbo, arriendo, sueldo…"
          accessibilityLabel="Descripción"
        />
      </Campo>

      <EntradaDeFecha etiqueta="Fecha" valor={fecha} onCambiar={setFecha} />

      {pideCategoria ? (
        <Campo etiqueta="Categoría" elevado={desplegable === 'categoria'}>
          <Desplegable
            abierto={desplegable === 'categoria'}
            onAlternar={() => alternar('categoria')}
            etiqueta={categorias.nombreCorto(categoriaId)}
            icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
            activo={categoriaId !== null}
            accesible={categoriaId === null
              ? 'Elegir categoría'
              : `Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`}
            opciones={opcionesDeCategoria}
            valor={categoriaId}
            onElegir={(valor) => { setCategoriaId(valor); setDesplegable(null); }}
            // La categoría dice de qué rubro es y el interruptor qué clase de
            // gasto: la misma pregunta mirada de dos maneras, en la misma fila.
            junto={(
              <View style={styles.claseDeGasto}>
                <Text style={styles.clase}>{esCompromisoAhora ? 'Comprometido' : 'Variable'}</Text>
                <Interruptor
                  encendido={esCompromisoAhora}
                  onCambiar={setComprometido}
                  accesible={esCompromisoAhora
                    ? 'Comprometido. Tocar para marcarlo como variable'
                    : 'Variable. Tocar para marcarlo como comprometido'}
                />
              </View>
            )}
          />
        </Campo>
      ) : null}

      {/* La cuenta va última: es el único campo que ya viene contestado. Con
          una sola cuenta no se dibuja, pero el valor viaja igual. */}
      {cuentas.length > 1 ? (
        <Campo etiqueta="Cuenta" elevado={desplegable === 'cuenta'}>
          <Desplegable
            abierto={desplegable === 'cuenta'}
            onAlternar={() => alternar('cuenta')}
            etiqueta={nombreDeLaCuenta}
            activo={cuentaId !== null}
            accesible={`Cuenta ${nombreDeLaCuenta}. Tocar para cambiar`}
            opciones={opcionesDeCuenta}
            valor={cuentaId}
            onElegir={(valor) => { setCuentaElegida(valor); setDesplegable(null); }}
          />
        </Campo>
      ) : null}

      <ErrorDelFormulario error={error} />

      <Boton
        variante="principal"
        etiqueta={puedeGuardar && montoParseado !== null
          ? `Guardar ${tipo === 'ingreso' ? '+' : '−'}${money.format(montoParseado)}`
          : 'Guardar'}
        accesible="Guardar movimiento"
        onPress={guardar}
        deshabilitado={!puedeGuardar}
      />

      {onBorrar ? (
        <Boton
          variante="peligro"
          etiqueta="Borrar movimiento"
          confirmar="Tocar de nuevo para borrarlo"
          onPress={onBorrar}
          estilo={styles.borrar}
        />
      ) : null}
    </Formulario>
  );
}

function crearEstilos({ t }: Estilo) {
  return StyleSheet.create({
    claseDeGasto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    clase: t.etiqueta,
    borrar: { alignSelf: 'center' },
  });
}
