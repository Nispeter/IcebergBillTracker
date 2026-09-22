/**
 * Formulario de un movimiento, compartido por el alta y la edicion.
 *
 * No toca la base: arma los datos y los entrega. Quien lo usa decide si eso es
 * un `crearMovimiento` o un `editarMovimiento`. Asi las dos pantallas validan
 * igual y no hay dos formularios que mantener sincronizados.
 */

import { dates, money } from '@iceberg/core';
import { listarCuentas, type TipoDeMovimiento } from '@iceberg/db';
import {
  capas,
  elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
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
import { useDatos } from '../datos/BaseDeDatos';
import { useCategorias } from '../datos/catalogo';
import { useCuentaActiva } from '../datos/cuenta';
import { useLetra } from '../datos/letra';

export interface ValoresDelFormulario {
  readonly tipo: TipoDeMovimiento;
  readonly montoMinor: number;
  readonly ocurridoEn: dates.PlainDate;
  readonly nombre: string;
  /**
   * El id de la categoria, o `null`.
   *
   * `string` y no `CategoryId`: desde que se pueden agregar categorias propias,
   * el catalogo de la app dejo de ser la lista completa de ids validos.
   */
  readonly categoriaId: string | null;
  /**
   * Si es un compromiso fijo. `null` deja que la app lo deduzca.
   *
   * Ver la columna en el esquema: la categoria es mal indicio por si sola.
   */
  readonly comprometido: boolean | null;
  /**
   * A que cuenta va.
   *
   * Nunca sale nulo del formulario: siempre hay al menos una cuenta --la app
   * crea una al abrir y no deja borrar la ultima-- y el campo resuelve cual
   * aunque no se dibuje.
   */
  readonly cuentaId: string | null;
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
  const letra = useLetra();
  const styles = crearEstilos(theme, letra);
  const categorias = useCategorias();

  const [tipo, setTipo] = useState<TipoDeMovimiento>(inicial?.tipo ?? 'gasto');
  const [monto, setMonto] = useState(
    inicial?.montoMinor === undefined ? '' : money.formatNumber(money.money(inicial.montoMinor)),
  );
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [fecha, setFecha] = useState<string>(inicial?.ocurridoEn ?? dates.today());
  const [categoriaId, setCategoriaId] = useState<string | null>(
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
  /**
   * Cual de los dos desplegables esta abierto, o ninguno.
   *
   * Uno solo y no un booleano por campo: con dos, los dos pueden estar abiertos
   * a la vez y sus paneles se superponen. Ademas es el estado el que decide a
   * cual de los dos campos se le sube el `zIndex`, que es lo que hace que el
   * panel abierto se dibuje encima del otro campo.
   */
  const [desplegable, setDesplegable] = useState<'categoria' | 'cuenta' | null>(null);
  const alternar = (cual: 'categoria' | 'cuenta') =>
    setDesplegable((previo) => (previo === cual ? null : cual));

  const { db, contexto } = useDatos();
  /**
   * Las cuentas se leen **de una vez**, no con `useLiveQuery`.
   *
   * El formulario es un borrador local, no una vista de la base --lo mismo que
   * ya hace la pantalla de edicion con el movimiento--. Y hay un motivo
   * concreto: `useLiveQuery` devuelve `[]` en el primer render, asi que la fila
   * de la cuenta aparecia un fotograma despues y el boton Guardar nacia apagado
   * y se encendia solo. El formulario se re-acomodaba a la vista cada vez que
   * se abria.
   */
  const cuentas = useMemo(() => listarCuentas(db, contexto), [db, contexto]);
  const { cuentaId: alcance, porDefecto } = useCuentaActiva();
  // `null` significa **que nadie lo toco**, igual que `comprometido`. Al editar
  // arranca con la cuenta del movimiento, asi que la cadena de abajo no corre.
  const [cuentaElegida, setCuentaElegida] = useState<string | null>(inicial?.cuentaId ?? null);
  /**
   * A que cuenta va si nadie tocó el campo.
   *
   * La que se esta mirando, que es lo que pidio el usuario. Cuando el alcance es
   * "todas" no hay una, y ahi vale la marcada con estrella antes que la primera:
   * la primera es la primera **alfabeticamente**, o sea arbitraria.
   *
   * Las dos adivinanzas se comprueban contra la lista antes de usarse. Un
   * alcance puede quedar apuntando a una cuenta borrada, y sin esta guarda el
   * movimiento se guardaria contra una cuenta que no existe, en silencio. Lo
   * que **no** se valida es `cuentaElegida`: al editar puede traer la cuenta
   * borrada del movimiento, y reasignarla sola seria decidir por el usuario.
   */
  const adivinada = alcance ?? porDefecto;
  const cuentaId = cuentaElegida
    ?? (cuentas.some((c) => c.id === adivinada) ? adivinada : cuentas[0]?.id ?? null);

  const montoParseado = money.parseMoney(monto);
  const fechaParseada = dates.parsePlainDate(fecha);
  // El ingreso no lleva categoria: un sueldo no es un tipo de gasto.
  const pideCategoria = tipo === 'gasto';
  const puedeGuardar =
    montoParseado !== null
    && montoParseado.amountMinor > 0
    && nombre.trim().length > 0
    && fechaParseada !== null
    && cuentaId !== null;

  const opcionesDeCategoria = useMemo(() => [
    { valor: null, etiqueta: 'Sin categoría' },
    ...categorias.todas.map((categoria) => ({
      valor: categoria.id,
      etiqueta: categoria.nombre,
      icono: iconoDeCategoria(categoria.id),
    })),
  ], [categorias]);

  // El valor se declara anulable aunque ninguna opcion lo sea, para que case con
  // `cuentaId`, que si puede ser nulo mientras no haya cuentas.
  const opcionesDeCuenta = useMemo<{ valor: string | null; etiqueta: string }[]>(
    () => cuentas.map((cuenta) => ({ valor: cuenta.id, etiqueta: cuenta.nombre })),
    [cuentas],
  );
  // El `??` cubre editar un movimiento cuya cuenta se borro: la fila ya no esta
  // en la lista, pero el id sigue escrito en el movimiento.
  const nombreDeLaCuenta = cuentas.find((c) => c.id === cuentaId)?.nombre ?? 'Elegir cuenta';

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
            // Los puntos se ponen solos mientras se escribe: a partir del quinto
            // digito, `150000` obliga a contar con el dedo. Es solo lo que se ve
            // --`parseMoney` ya sabe leerlos-- y por eso pasa por el mismo estado.
            onChangeText={(texto) => setMonto(money.agruparMientrasSeEscribe(texto))}
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
        <Campo
          styles={styles}
          etiqueta="Categoría"
          estilo={desplegable === 'categoria' ? styles.campoElevado : undefined}
        >
          <ConDesplegable
            abierto={desplegable === 'categoria'}
            disparador={(
              <View style={styles.filaChip}>
                <ChipDisparador
                  theme={theme}
                  etiqueta={categorias.nombreCorto(categoriaId)}
                  icono={categoriaId === null ? null : iconoDeCategoria(categoriaId)}
                  abierto={desplegable === 'categoria'}
                  activo={categoriaId !== null}
                  onPress={() => alternar('categoria')}
                  accesible={
                    categoriaId === null
                      ? 'Elegir categoría'
                      : `Categoría ${categorias.nombre(categoriaId)}. Tocar para cambiar`
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
                onElegir={(valor: string | null) => {
                  setCategoriaId(valor);
                  setDesplegable(null);
                }}
              />
            )}
          />
        </Campo>
      ) : null}

      {/*
        La cuenta va ultima, y es a proposito.

        El formulario sigue el orden en que uno decide: cuanto, de que, cuando,
        de que rubro, y recien al final de que bolsillo sale. Es ademas el unico
        campo que **ya viene contestado**, asi que es el que menos molesta abajo;
        arriba solo retrasaria al monto, que es el unico que siempre hay que
        escribir.

        Con una sola cuenta no se dibuja: un selector de una opcion no es una
        eleccion, es una fila que ocupa. Lo que se esconde es el control, no el
        dato: `cuentaId` se resuelve igual y viaja igual al guardar.
      */}
      {cuentas.length > 1 ? (
        <Campo
          styles={styles}
          etiqueta="Cuenta"
          estilo={desplegable === 'cuenta' ? styles.campoElevado : undefined}
        >
          <ConDesplegable
            abierto={desplegable === 'cuenta'}
            disparador={(
              // En una fila aunque haya un solo chip: suelto dentro del campo
              // se estira a los 520 px del formulario y queda una caja vacia a
              // la derecha del nombre.
              <View style={styles.filaChip}>
                <ChipDisparador
                  theme={theme}
                  etiqueta={nombreDeLaCuenta}
                  abierto={desplegable === 'cuenta'}
                  activo={cuentaId !== null}
                  onPress={() => alternar('cuenta')}
                  accesible={`Cuenta ${nombreDeLaCuenta}. Tocar para cambiar`}
                />
              </View>
            )}
            panel={(
              <ListaDeOpciones
                theme={theme}
                opciones={opcionesDeCuenta}
                seleccionado={cuentaId}
                onElegir={(valor: string | null) => {
                  setCuentaElegida(valor);
                  setDesplegable(null);
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
            cuentaId,
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

function crearEstilos(theme: Theme, letra: Letra) {
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
    titulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.lg, color: theme.tinta },
    cancelar: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.silencio },

    selector: {
      flexDirection: 'row',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      borderRadius: radii.sm,
      overflow: 'hidden',
    },
    opcion: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
    opcionActiva: { backgroundColor: theme.tinta },
    opcionTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.silencio },
    opcionTextoActivo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.sm, color: theme.fondo },

    campo: { gap: spacing.sm },
    /**
     * Elevado para que su lista se abra **encima** de lo que sigue.
     *
     * `ConDesplegable` ya se eleva, pero solo compite dentro de su propio
     * contexto de apilado: sin esto, el interruptor y el boton de guardar --que
     * vienen despues en el orden del documento-- se dibujaban sobre la lista
     * abierta.
     *
     * Se lo lleva **el campo abierto**, no los dos. Con el mismo `zIndex` en
     * ambos gana el ultimo del documento, asi que el panel de Categoria
     * quedaria tapado por la fila de Cuenta, y al reves no se arregla poniendo
     * el otro primero: es un empate y siempre lo gana el de abajo.
     *
     * Queda un detalle conocido: al cerrar, el campo pierde la elevacion
     * mientras su panel todavia se esta desvaneciendo --`Aparecer` lo deja
     * montado 160 ms-- asi que el boton de guardar se dibuja encima de ese
     * resto. Dura lo que el fundido y no vale el estado extra que costaria.
     */
    campoElevado: { zIndex: capas.desplegable },
    filaChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    claseDeGasto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    claseTexto: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      color: theme.silencio,
    },
    etiqueta: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.xs,
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
    simbolo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.lg, color: theme.silencio },
    entradaMonto: {
      flex: 1,
      fontFamily: fonts.mono,
      fontWeight: pesos.medium,
      fontSize: letra.px(34),
      color: theme.tinta,
      padding: 0,
    },

    entrada: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.md,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
    },
    ayuda: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencio },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.vencidoTexto },
    error: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.vencidoTexto },


    guardar: {
      backgroundColor: theme.acento,
      borderRadius: radii.sm,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    guardarApagado: { opacity: 0.4 },
    guardarTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.md, color: theme.sobreAcento },

    borrar: { paddingVertical: spacing.md, alignItems: 'center' },
    borrarTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.sm, color: theme.vencidoTexto },
  });
}
