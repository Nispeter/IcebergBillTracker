/**
 * Ajustes: apariencia, y de donde salen los datos que se estan viendo.
 *
 * La identidad del dispositivo se muestra porque en modo hogar (F5) va a
 * importar saber cual es este aparato, y porque tenerla a la vista ayuda a
 * depurar cuando algo no cuadra entre dos telefonos.
 */

import { categories, crypto, dates, money } from '@iceberg/core';
import {
  CLAVE_CATEGORIAS_COMPROMETIDAS, CLAVE_DISPOSITIVO, CLAVE_HOGAR, CLAVE_MIEMBRO, escribirAjuste, borrarTodo, contarRespaldo, crearCuenta,
  HogarAjenoError, deshacerLote, editarCuenta, exportarRespaldo, fusionarRespaldo,
  leerAjuste, renombrarMiembro, unirseAHogar,
  restaurarRespaldo, type ConflictoLegible, type Lote, type Miembro,
} from '@iceberg/db';
import {
  elevation, fontSizes, fonts, pesos, radii, spacing, type Theme,
} from '@iceberg/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Ayuda } from '../../components/Ayuda';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Interruptor } from '../../components/Interruptor';
import { Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior, useDesplazamiento } from '../../datos/desplazamiento';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  useCuentas, useLotes, useMiembros, useMovimientos, useSaldo, useSaldoInicial,
} from '../../datos/consultas';
import { useCuentaActiva } from '../../datos/cuenta';
import { useComprometidas } from '../../datos/consultas';
import { TIPOS, usePeriodo } from '../../datos/periodo';
import { elegirRespaldo, guardarRespaldo } from '../../datos/archivo';
import { cargarSemilla } from '../../datos/semilla';
import { useTema } from '../../datos/tema';

export default function Ajustes() {
  const { nombre: tema, theme, alternar } = useTema();
  const desplazamiento = useDesplazamiento();
  const aireInferior = useAireInferior();
  const { porDefecto, marcarPorDefecto } = useCuentaActiva();
  const comprometidas = useComprometidas();
  const styles = useMemo(() => crearEstilos(theme), [theme]);
  const { db, contexto, cambiarHogar } = useDatos();
  const periodo = usePeriodo();

  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const saldo = useSaldo(useSaldoInicial());
  const lotes = useLotes();
  const miembros = useMiembros();
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<'borrar' | 'restaurar' | null>(null);
  const [conflictos, setConflictos] = useState<readonly ConflictoLegible[]>([]);
  const [frase, setFrase] = useState('');
  const [codigoDeHogar, setCodigoDeHogar] = useState('');
  /** El archivo que espera confirmacion por venir de otro hogar. */
  const [deOtroHogar, setDeOtroHogar] = useState<unknown | null>(null);
  const [nombrePropio, setNombrePropio] = useState<string | null>(null);

  /**
   * Abre un archivo elegido, descifrandolo si hace falta.
   *
   * Un archivo cifrado y uno en claro se distinguen por su forma, asi que no hay
   * que preguntarle al usuario cual es: se mira y se actua.
   */
  function abrir(datos: unknown): unknown {
    if (!crypto.esSobre(datos)) return datos;
    if (frase.trim() === '') {
      throw new Error('Ese archivo está cifrado. Escribe la frase y vuelve a intentar.');
    }
    return JSON.parse(crypto.descifrar(datos, frase)) as unknown;
  }

  const vacia = movimientos.length === 0;

  /**
   * Guarda un archivo con lo que hay.
   *
   * `soloSincronizables` distingue **respaldar** de **compartir**, que no son lo
   * mismo: un respaldo lleva todo, porque si perdieras el telefono querrias de
   * vuelta tambien lo privado; el archivo que se le pasa a otra persona deja
   * fuera las cuentas marcadas como que no sincronizan.
   */
  async function exportar(soloSincronizables = false) {
    try {
      const respaldo = exportarRespaldo(db, contexto, { soloSincronizables });
      const dia = respaldo.exportadoEn.slice(0, 10);
      const conFrase = frase.trim() !== '';

      // Se cifra solo si hay frase. Pedirla siempre haria que alguien que solo
      // quiere un respaldo local invente una y la olvide.
      const contenido = conFrase
        ? JSON.stringify(crypto.cifrar(JSON.stringify(respaldo), frase))
        : JSON.stringify(respaldo);
      const que = soloSincronizables ? 'compartir' : 'iceberg';
      const nombre = conFrase ? `${que}-${dia}.cifrado.json` : `${que}-${dia}.json`;

      await guardarRespaldo(nombre, contenido);
      const fuera = cuentas.filter((c) => c.sincroniza === 0).length;
      setAviso(
        `${soloSincronizables ? 'Archivo' : 'Respaldo'} con ${contarRespaldo(respaldo)} `
        + `filas guardado como ${nombre}.`
        + (soloSincronizables && fuera > 0
          ? ` Quedaron fuera ${fuera === 1 ? 'una cuenta' : `${fuera} cuentas`}.`
          : '')
        + (conFrase ? ' Sin la frase no se puede abrir.' : ''),
      );
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  /**
   * Fusiona un archivo ya abierto.
   *
   * `permitirOtroHogar` solo llega en verdadero desde el boton de confirmar: un
   * archivo de otro hogar se para antes de escribir nada, y la unica forma de
   * seguir es que alguien lo diga a proposito.
   */
  function fusionarDatos(datos: unknown, permitirOtroHogar = false) {
    const resultado = fusionarRespaldo(db, contexto, datos, { permitirOtroHogar });
    setConflictos(resultado.ejemplos);
    setDeOtroHogar(null);

    const { nuevas, actualizadas, conflictos: cuantos } = resultado.total;
    setAviso(
      nuevas === 0 && actualizadas === 0
        ? 'Ya estaban sincronizados: nada que traer.'
        : `${nuevas} nuevas, ${actualizadas} actualizadas.`
          + (cuantos === 0 ? '' : ` ${cuantos} se resolvieron por fecha.`),
    );
  }

  async function fusionar() {
    try {
      const archivo = await elegirRespaldo();
      if (archivo === null) return;
      const datos = abrir(archivo.datos);
      try {
        fusionarDatos(datos);
      } catch (e) {
        if (!(e instanceof HogarAjenoError)) throw e;
        // Se guarda para poder insistir sin volver a elegir el archivo.
        setDeOtroHogar(datos);
        setAviso('Ese archivo viene de otro hogar. Revisa antes de seguir.');
      }
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  function emparejar() {
    try {
      const nuevo = codigoDeHogar.trim();
      const filas = unirseAHogar(db, contexto, nuevo);
      setCodigoDeHogar('');
      // El contexto guarda el hogar viejo: sin apuntarlo al nuevo, las consultas
      // seguirian filtrando por el anterior y la app se veria vacia.
      cambiarHogar(nuevo);
      setAviso(
        filas === 0
          ? 'Ya estabas en ese hogar.'
          : `Listo. ${filas} filas quedaron en el hogar compartido.`,
      );
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  async function restaurar() {
    try {
      const archivo = await elegirRespaldo();
      if (archivo === null) return;
      const filas = restaurarRespaldo(db, contexto, abrir(archivo.datos));
      setConfirmando(null);
      setConflictos([]);
      setAviso(`Restauradas ${filas} filas desde ${archivo.nombre}.`);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  const identidad = useMemo(() => ({
    dispositivo: leerAjuste(db, CLAVE_DISPOSITIVO),
    hogar: leerAjuste(db, CLAVE_HOGAR),
    miembro: leerAjuste(db, CLAVE_MIEMBRO),
  }), [db]);
  const identidadDelMiembro = identidad.miembro;
  const yo = miembros.find((m: Miembro) => m.id === identidadDelMiembro);

  return (
    <Pantalla sinPeriodo>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
        {...desplazamiento}
      >
        <Seccion
          styles={styles}
          theme={theme}
          titulo="Apariencia"
          ayuda={'Deshielo es el tema claro y Noche polar el oscuro. Por ahora la elección '
            + 'dura hasta que cierres la app: al volver a abrirla arranca en Noche polar.'}
        />
        <View style={styles.fila}>
          <Text style={styles.etiqueta}>Tema</Text>
          <Pressable
            onPress={alternar}
            style={styles.boton}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar a tema ${tema === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <Text style={styles.botonTexto}>{tema === 'dark' ? 'Noche polar' : 'Deshielo'}</Text>
          </Pressable>
        </View>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Quién escribe"
          ayuda={'Cada movimiento guarda quién lo escribió. Ponerle nombre a este teléfono '
            + 'hace que al sincronizar se pueda ver de quién viene cada versión.'}
        />
        {/* Solo los **otros** dispositivos se listan. El propio no: su nombre ya
            esta abajo, dentro del campo que lo edita, y mostrarlo dos veces era
            la mitad del desorden de esta seccion --y un subrayado de mas--. */}
        {miembros.filter((m: Miembro) => m.id !== identidadDelMiembro).map((miembro: Miembro) => (
          <View key={miembro.id} style={styles.lote}>
            <View style={styles.loteTexto}>
              <Text style={styles.loteArchivo} numberOfLines={1}>{miembro.nombre}</Text>
              <Text style={styles.loteDetalle}>Otro dispositivo</Text>
            </View>
          </View>
        ))}
        {yo === undefined ? null : (
          <>
            <Text style={styles.etiqueta}>Este teléfono</Text>
            <TextInput
              value={nombrePropio ?? yo.nombre}
              onChangeText={setNombrePropio}
              placeholder="Cómo se llama este teléfono"
              placeholderTextColor={theme.silencio}
              style={styles.entradaFrase}
              accessibilityLabel="Nombre de este dispositivo"
            />
            <Pressable
              onPress={() => {
                try {
                  renombrarMiembro(db, contexto, yo.id, nombrePropio ?? yo.nombre);
                  setNombrePropio(null);
                  setAviso('Listo. El nombre viaja en la próxima sincronización.');
                } catch (e) {
                  setAviso((e as Error).message);
                }
              }}
              style={styles.botonSecundario}
              accessibilityRole="button"
              accessibilityLabel="Guardar el nombre de este dispositivo"
            >
              <Text style={styles.botonTexto}>Guardar nombre</Text>
            </Pressable>
          </>
        )}

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Frase de cifrado"
          ayuda={'Si escribes una, el archivo que exportes queda cifrado y sin ella no se '
            + 'puede abrir, ni por ti. Se usa también para abrir archivos cifrados. '
            + 'No se guarda en ninguna parte.'}
        />
        <TextInput
          value={frase}
          onChangeText={setFrase}
          placeholder="Sin cifrar"
          placeholderTextColor={theme.silencio}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.entradaFrase}
          accessibilityLabel="Frase de cifrado"
        />
        {frase.trim() === '' ? null : (
          <Text style={crypto.fraseDebil(frase) === null ? styles.fraseOk : styles.fraseFloja}>
            {crypto.fraseDebil(frase) ?? 'Se cifrará con esta frase.'}
          </Text>
        )}

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Sincronizar"
          ayuda={'Para compartir cuentas con otra persona, una sola vez:\n\n'
            + '1. Toca tu código de hogar para enviárselo.\n'
            + '2. Esa persona lo pega en "Unirme a otro hogar".\n\n'
            + 'Desde ahí, cada vez que quieran ponerse al día:\n\n'
            + '3. Uno toca "Exportar para compartir" y manda el archivo.\n'
            + '4. El otro toca "Fusionar con un archivo" y lo elige.\n\n'
            + 'Fusionar no borra nada: junta los dos lados. Si el mismo movimiento se '
            + 'editó en los dos, gana la edición más nueva y abajo queda anotado cuál se '
            + 'descartó.\n\n'
            + 'Compartir el hogar no es obligatorio, pero es lo que le permite a la app '
            + 'avisarte si el archivo viene de otra persona antes de mezclarlo. Las '
            + 'cuentas marcadas como no compartidas no salen ni entran.'}
        />
        {/* En columna y con aire: los dos textos son largos y no caben en una
            fila, pero apilados sin separacion se leian como un solo bloque. */}
        <View style={styles.accionesEnColumna}>
          <Pressable
            onPress={fusionar}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Fusionar con otro dispositivo"
          >
            <Text style={styles.botonTexto}>Fusionar con un archivo</Text>
          </Pressable>
          <Pressable
            onPress={() => exportar(true)}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Exportar un archivo para compartir"
          >
            <Text style={styles.botonTexto}>Exportar para compartir</Text>
          </Pressable>
        </View>

        {deOtroHogar === null ? null : (
          <View style={styles.avisoDeHogar}>
            <Text style={styles.avisoDeHogarTexto}>
              Ese archivo no es de tu hogar. Si sigues, sus movimientos se mezclan con los
              tuyos y no hay forma de separarlos después.
            </Text>
            <View style={styles.acciones}>
              <Pressable
                onPress={() => { try { fusionarDatos(deOtroHogar, true); } catch (e) { setAviso((e as Error).message); } }}
                style={[styles.botonSecundario, styles.botonDestructivo]}
                accessibilityRole="button"
                accessibilityLabel="Fusionar igual, aunque sea de otro hogar"
              >
                <Text style={styles.botonTextoDestructivo}>Fusionar igual</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeOtroHogar(null)}
                style={styles.botonSecundario}
                accessibilityRole="button"
                accessibilityLabel="Cancelar la fusión"
              >
                <Text style={styles.botonTexto}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.etiqueta}>Código de tu hogar</Text>
        <Pressable
          onPress={() => Share.share({ message: identidad.hogar ?? '' })}
          style={styles.codigo}
          accessibilityRole="button"
          accessibilityLabel="Compartir el código de tu hogar"
        >
          <Text style={styles.codigoTexto} numberOfLines={1}>{identidad.hogar ?? '—'}</Text>
        </Pressable>

        <Text style={styles.etiqueta}>Unirme a otro hogar</Text>
        <TextInput
          value={codigoDeHogar}
          onChangeText={setCodigoDeHogar}
          placeholder="Pega aquí el código del otro teléfono"
          placeholderTextColor={theme.silencio}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.entradaFrase}
          accessibilityLabel="Código del hogar al que unirse"
        />
        <Pressable
          onPress={emparejar}
          disabled={codigoDeHogar.trim() === ''}
          style={[styles.botonSecundario, codigoDeHogar.trim() === '' && styles.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Unirme a ese hogar"
        >
          <Text style={styles.botonTexto}>Unirme a ese hogar</Text>
        </Pressable>

        {conflictos.length === 0 ? null : (
          <View style={styles.conflictos}>
            <Text style={styles.conflictosTitulo}>
              Se descartaron estas versiones por ser más antiguas
            </Text>
            {conflictos.map((conflicto) => (
              <View key={`${conflicto.tabla}|${conflicto.id}`} style={styles.conflicto}>
                <Text style={styles.conflictoGana} numberOfLines={1}>
                  {conflicto.ganadora}
                  {conflicto.escribioGanadora === '' ? '' : ` · ${conflicto.escribioGanadora}`}
                </Text>
                <Text style={styles.conflictoPierde} numberOfLines={1}>
                  antes: {conflicto.descartada}
                  {conflicto.escribioDescartada === '' ? '' : ` · ${conflicto.escribioDescartada}`}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Cuentas"
          ayuda={'El saldo inicial es cuánto había antes del primer movimiento que '
            + 'registres. Sin él, el saldo de la app no cuadra con el del banco. '
            + 'La estrella marca con cuál abre la app. Si una cuenta no se comparte, '
            + 'lo dice aquí abajo y se cambia al editarla.'}
        />
        {cuentas.map((cuenta) => (
          <View key={cuenta.id} style={styles.cuenta}>
            {/* La estrella va **fuera** del `Link`: dentro, tocarla navegaria a
                editar la cuenta en vez de marcarla. Volver a tocar la marcada la
                desmarca, y la app vuelve a abrir con todas juntas. */}
            <Pressable
              onPress={() => marcarPorDefecto(porDefecto === cuenta.id ? null : cuenta.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: porDefecto === cuenta.id }}
              accessibilityLabel={porDefecto === cuenta.id
                ? `${cuenta.nombre} es la cuenta con la que abre la app. Tocar para quitarla`
                : `Abrir la app con ${cuenta.nombre}`}
            >
              <Star
                size={16}
                weight={porDefecto === cuenta.id ? 'fill' : 'regular'}
                color={porDefecto === cuenta.id ? theme.acentoTexto : theme.silencio}
              />
            </Pressable>
            <Link href={{ pathname: '/cuenta/[id]', params: { id: cuenta.id } }} asChild>
              <Pressable
                style={styles.cuentaTocable}
                accessibilityRole="button"
                accessibilityLabel={`Editar la cuenta ${cuenta.nombre}`}
              >
                <View style={styles.loteTexto}>
                  <Text style={styles.loteArchivo} numberOfLines={1}>{cuenta.nombre}</Text>
                  <Text style={styles.loteDetalle}>
                    {TIPOS_DE_CUENTA_LEGIBLES[cuenta.tipo]}
                    {' · inicial '}{money.format(money.money(cuenta.saldoInicialMinor))}
                    {cuenta.sincroniza === 0 ? ' · no se comparte' : ''}
                  </Text>
                </View>
                <Text style={styles.botonTexto}>Editar</Text>
              </Pressable>
            </Link>
          </View>
        ))}
        <Link href={{ pathname: '/cuenta/[id]', params: { id: 'nueva' } }} asChild>
          <Pressable
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Agregar una cuenta"
          >
            <Text style={styles.botonTexto}>Agregar cuenta</Text>
          </Pressable>
        </Link>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Categorías"
          ayuda={'Cada categoría trae un tipo por omisión, y es solo eso: una suposición '
            + 'para no tener que clasificar a mano cada gasto.\n\n'
            + 'Comprometido es lo que llega igual --arriendo, cuentas, cuotas--; variable '
            + 'es lo que decides tú.\n\n'
            + 'Cámbialas si no te calzan: hay quien paga el arriendo con tarjeta y lo '
            + 'lleva en Deudas, y quien ahorra cuando sobra en vez de todos los meses.\n\n'
            + 'Un gasto suelto se puede corregir sin tocar esto, con el interruptor que '
            + 'está al lado de la categoría al crearlo o editarlo.'}
        />
        <Panel theme={theme}>
          {categories.CATEGORIES.map((categoria) => {
            const esCompromiso = comprometidas.has(categoria.id);
            return (
              <View key={categoria.id} style={styles.fila}>
                <Text style={styles.etiqueta} numberOfLines={1}>{categoria.nombre}</Text>
                <View style={styles.claseDeCategoria}>
                  <Text style={styles.etiqueta}>
                    {esCompromiso ? 'Comprometido' : 'Variable'}
                  </Text>
                  <Interruptor
                    theme={theme}
                    encendido={esCompromiso}
                    accesible={`${categoria.nombre}: ${esCompromiso ? 'comprometido' : 'variable'}`}
                    onCambiar={(valor) => {
                      const siguiente = new Set(comprometidas);
                      if (valor) siguiente.add(categoria.id);
                      else siguiente.delete(categoria.id);
                      escribirAjuste(db, CLAVE_CATEGORIAS_COMPROMETIDAS, JSON.stringify([...siguiente]));
                    }}
                  />
                </View>
              </View>
            );
          })}
        </Panel>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Respaldo"
          ayuda={'Exportar guarda todo en un archivo: hazlo antes de cambiar de teléfono '
            + 'o de borrar la app, porque la base vive solo aquí y no hay copia en ninguna '
            + 'nube.\n\n'
            + 'Restaurar **reemplaza** lo que haya, no mezcla. Úsalo en un teléfono nuevo. '
            + 'Para juntar dos que ya tienen datos, lo que corresponde es Sincronizar.\n\n'
            + 'Si escribes una frase de cifrado, el archivo sale cifrado y sin esa frase no '
            + 'se puede abrir.'}
        />
        <View style={styles.acciones}>
          <Pressable
            // Sin la lambda, `Pressable` le pasa el evento como primer argumento
            // y el respaldo saldria en modo compartir por accidente.
            onPress={() => exportar()}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Exportar respaldo"
          >
            <Text style={styles.botonTexto}>Exportar</Text>
          </Pressable>
          <Pressable
            onPress={() => (confirmando === 'restaurar' ? restaurar() : setConfirmando('restaurar'))}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel={confirmando === 'restaurar' ? 'Confirmar restauración' : 'Restaurar respaldo'}
          >
            <Text style={confirmando === 'restaurar' ? styles.botonTextoAlerta : styles.botonTexto}>
              {confirmando === 'restaurar' ? 'Elegir archivo y reemplazar' : 'Restaurar'}
            </Text>
          </Pressable>
        </View>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Importar"
          ayuda={'Baja la cartola desde la web de tu banco --en Banco de Chile es Cartola '
            + 'en Excel-- y elígela aquí. Verás una vista previa antes de que se escriba '
            + 'nada.\n\n'
            + 'Reimportar el mismo archivo no duplica: reconoce lo que ya está. Y cada '
            + 'importación se puede deshacer entera desde esta misma pantalla.\n\n'
            + 'Si tu banco no es Banco de Chile, igual sirve: te va a pedir que indiques '
            + 'qué columna es cuál.'}
        />
        <Link href="/importar" asChild>
          <Pressable
            style={styles.botonPrincipal}
            accessibilityRole="button"
            accessibilityLabel="Importar una cartola"
          >
            <Text style={styles.botonPrincipalTexto}>Importar cartola</Text>
          </Pressable>
        </Link>

        {lotes.length === 0 ? null : [...lotes].reverse().map((lote: Lote) => (
          <View key={lote.id} style={styles.lote}>
            <View style={styles.loteTexto}>
              <Text style={styles.loteArchivo} numberOfLines={1}>{lote.archivo}</Text>
              <Text style={styles.loteDetalle}>
                {lote.cantidad} {lote.cantidad === 1 ? 'movimiento' : 'movimientos'}
                {lote.desde !== null && lote.hasta !== null
                  ? ` · ${dates.formatDate(lote.desde as dates.PlainDate)} — ${dates.formatDate(lote.hasta as dates.PlainDate)}`
                  : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => deshacerLote(db, contexto, lote.id)}
              style={styles.boton}
              accessibilityRole="button"
              accessibilityLabel={`Deshacer la importación de ${lote.archivo}`}
            >
              <Text style={styles.deshacerTexto}>Deshacer</Text>
            </Pressable>
          </View>
        ))}

        <Link href="/reglas-categoria" asChild>
          <Pressable
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Reglas de categoría"
          >
            <Text style={styles.botonTexto}>Reglas de categoría</Text>
          </Pressable>
        </Link>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Empezar de cero"
          ayuda={'Borra cuentas, movimientos, reglas e importaciones de este dispositivo. '
            + 'No se puede deshacer: exporta un respaldo antes si hay algo que conservar.'}
        />
        {vacia ? (
          <>
            <Text style={styles.notaImportar}>
              La base está vacía. Puedes cargar 18 meses de datos chilenos inventados para
              ver cómo se comporta la app antes de meter los tuyos.
            </Text>
            <Pressable
              onPress={() => {
                const cuantos = cargarSemilla(db, contexto);
                setAviso(`Cargados ${cuantos} movimientos de prueba.`);
              }}
              style={styles.botonSecundario}
              accessibilityRole="button"
              accessibilityLabel="Cargar datos de prueba"
            >
              <Text style={styles.botonTexto}>Cargar datos de prueba</Text>
            </Pressable>
          </>
        ) : (
          <>

            <Pressable
              onPress={() => {
                if (confirmando !== 'borrar') {
                  setConfirmando('borrar');
                  return;
                }
                borrarTodo(db, contexto);
                // `borrarTodo` se lleva tambien la cuenta, y sin cuenta la app no
                // deja escribir ni un movimiento: quedaria vacia y ademas rota.
                crearCuenta(db, contexto, {
                  nombre: 'Cuenta corriente', tipo: 'corriente', saldoInicialMinor: 0,
                });
                setConfirmando(null);
                setAviso('Se borró todo. Quedó una cuenta vacía para empezar.');
              }}
              style={[styles.botonSecundario, styles.botonDestructivo]}
              accessibilityRole="button"
              accessibilityLabel={confirmando === 'borrar' ? 'Confirmar borrado total' : 'Borrar todos los datos'}
            >
              <Text style={confirmando === 'borrar' ? styles.botonTextoAlerta : styles.botonTextoDestructivo}>
                {confirmando === 'borrar' ? 'Tocar de nuevo para borrar todo' : 'Borrar todos los datos'}
              </Text>
            </Pressable>
          </>
        )}

        {aviso === null ? null : <Text style={styles.aviso}>{aviso}</Text>}

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Período"
          ayuda={'El rango que están mirando todas las pantallas. Se cambia desde la barra '
            + 'de arriba, no desde aquí: acá solo se ve cuál está puesto.'}
        />
        <Panel theme={theme}>
          <Dato
            styles={styles}
            etiqueta="Tipo"
            valor={TIPOS.find((t) => t.valor === periodo.tipo)?.etiqueta ?? periodo.tipo}
          />
          <Dato styles={styles} etiqueta="Desde" valor={periodo.rango.start} />
          <Dato styles={styles} etiqueta="Hasta" valor={periodo.rango.end} />
        </Panel>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Datos"
          ayuda={'Cuánto hay guardado en este teléfono. El saldo sale del saldo inicial de '
            + 'las cuentas más todo lo que entró menos todo lo que salió, y por eso no '
            + 'cuadra con el banco si no pusiste el saldo inicial.'}
        />
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Movimientos" valor={String(movimientos.length)} />
          <Dato styles={styles} etiqueta="Cuentas" valor={String(cuentas.length)} />
          <Dato styles={styles} etiqueta="Saldo" valor={money.format(saldo)} />
        </Panel>
        <Text style={styles.nota}>
          La base arranca vacía, con una cuenta y nada más. Los datos de prueba se cargan
          desde aquí cuando quieras verlos, y se borran igual de fácil.
        </Text>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Este dispositivo"
          ayuda={'Se crean una sola vez y no cambian. Cada movimiento guarda desde qué '
            + 'dispositivo se escribió, que es lo que hace posible el modo hogar.'}
        />
        <Panel theme={theme}>
          <Dato styles={styles} etiqueta="Dispositivo" valor={identidad.dispositivo ?? '—'} mono />
          <Dato styles={styles} etiqueta="Hogar" valor={identidad.hogar ?? '—'} mono />
          <Dato styles={styles} etiqueta="Miembro" valor={identidad.miembro ?? '—'} mono />
        </Panel>

      </ScrollView>
    </Pantalla>
  );
}

/** Como se lee cada tipo de cuenta en pantalla. */
const TIPOS_DE_CUENTA_LEGIBLES: Record<string, string> = {
  corriente: 'Corriente',
  vista: 'Vista',
  ahorro: 'Ahorro',
  credito: 'Crédito',
  efectivo: 'Efectivo',
};

type Estilos = ReturnType<typeof crearEstilos>;

/**
 * El titulo de una seccion, con su explicacion detras de un `?`.
 *
 * Ajustes tenia diez parrafos explicativos, uno por seccion. Todos ciertos y
 * todos ruido despues de la primera lectura: para quien ya sabe que hace
 * "Respaldo", esas tres lineas son solo distancia hasta el boton. Detras del `?`
 * siguen estando y no ocupan.
 */
function Seccion(
  { styles, theme, titulo, ayuda }:
  { styles: Estilos; theme: Theme; titulo: string; ayuda?: string },
) {
  // La regla horizontal se fue: once secciones eran once lineas que solo decian
  // donde empieza cada una, nunca donde termina. Ver `components/Titulo.tsx`.
  return <Titulo texto={titulo} ayuda={ayuda} theme={theme} estilo={styles.seccion} />;
}

function Dato(
  { styles, etiqueta, valor, mono }:
  { styles: Estilos; etiqueta: string; valor: string; mono?: boolean },
) {
  return (
    <View style={styles.fila}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={mono ? styles.valorMono : styles.valor} numberOfLines={1}>{valor}</Text>
    </View>
  );
}

function crearEstilos(theme: Theme) {
  return StyleSheet.create({
    contenido: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    // Ajustes tiene once secciones seguidas: el aire por defecto de `Titulo`
    // --pensado para dos o tres por pantalla-- las separaba demasiado y la
    // pantalla se hacia interminable.
    seccion: { marginTop: spacing.xl },

    // Sin subrayado: dos columnas alineadas ya se leen como tabla, y el panel
    // dice donde empieza y donde termina el grupo.
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      paddingVertical: 5,
    },
    // La fila de cuenta ahora lleva la estrella al lado del enlace.
    cuentaTocable: {
      flex: 1, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', gap: spacing.lg,
    },
    // Sin codigo escrito, unirse no lleva a ningun lado.
    apagado: { opacity: 0.45 },
    codigo: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
      backgroundColor: theme.superficieHonda,
    },
    codigoTexto: {
      fontFamily: fonts.mono, fontWeight: pesos.regular,
      fontSize: fontSizes.xs, color: theme.tinta,
    },
    avisoDeHogar: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.vencido,
    },
    avisoDeHogarTexto: {
      fontFamily: fonts.texto, fontWeight: pesos.regular,
      fontSize: fontSizes.xs, lineHeight: 18, color: theme.tinta,
    },

    claseDeCategoria: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    // Lo irreversible no puede verse igual que lo reversible: "Borrar todos los
    // datos" tenia el mismo borde y el mismo color que "Exportar".
    botonDestructivo: { borderColor: theme.vencido },
    botonTextoDestructivo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: fontSizes.xs,
      color: theme.vencidoTexto,
    },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.silencioHondo },
    valor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.tinta },
    valorMono: {
      flex: 1,
      textAlign: 'right',
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: 10,
      color: theme.tinta,
    },

    boton: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    botonPrincipal: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radii.sm,
      backgroundColor: theme.acento,
      marginBottom: spacing.sm,
    },
    botonPrincipalTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.sm, color: theme.sobreAcento },
    notaImportar: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: fontSizes.xs, lineHeight: 18, color: theme.silencio, paddingBottom: spacing.sm },
    lote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    loteTexto: { flex: 1, gap: 1 },
    loteArchivo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    loteDetalle: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio },
    deshacerTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    acciones: { flexDirection: 'row', gap: spacing.sm },
    // Los botones se dimensionan por su contenido, asi que el contenedor los
    // alinea a la izquierda en vez de estirarlos a lo ancho.
    accionesEnColumna: { gap: spacing.sm, alignItems: 'flex-start' },
    entradaFrase: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: fontSizes.sm,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
      // El subrayado del campo quedaba pegado al boton de abajo y los dos se
      // leian como una sola pieza.
      marginBottom: spacing.md,
    },
    fraseOk: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.ingresoTexto },
    fraseFloja: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.vencidoTexto },
    conflictos: {
      gap: spacing.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    conflictosTitulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.tinta },
    conflicto: { gap: 1 },
    conflictoGana: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: fontSizes.xs, color: theme.tinta },
    conflictoPierde: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, textDecorationLine: 'line-through' },
    // Sin subrayado: la estrella, las dos lineas de texto y el "Editar" ya
    // separan una cuenta de la siguiente.
    cuenta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    botonSecundario: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      alignSelf: 'flex-start',
    },
    botonTextoAlerta: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: fontSizes.xs, color: theme.vencidoTexto },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, lineHeight: 18, color: theme.acentoTexto, paddingTop: spacing.sm },
    botonTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: fontSizes.xs, color: theme.acentoTexto },

    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: 10, color: theme.silencio, marginTop: spacing.sm },
  });
}
