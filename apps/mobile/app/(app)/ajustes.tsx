/**
 * Ajustes: apariencia, y de donde salen los datos que se estan viendo.
 *
 * La identidad del dispositivo se muestra porque en modo hogar (F5) va a
 * importar saber cual es este aparato, y porque tenerla a la vista ayuda a
 * depurar cuando algo no cuadra entre dos telefonos.
 */

import { crypto, dates, money } from '@iceberg/core';
import {
  CLAVE_ARCHIVO_PROPIO, CLAVE_CARPETA, CLAVE_CATEGORIAS_COMPROMETIDAS, CLAVE_PINGUINOS,
  CLAVE_DISPOSITIVO, CLAVE_HOGAR,
  CLAVE_MIEMBRO, borrarCategoria, escribirAjuste, borrarTodo, crearCategoria, crearCuenta,
  deshacerLote, editarCuenta, leerAjuste, renombrarMiembro, unirseAHogar,
  type ConflictoLegible, type Lote, type Miembro,
} from '@iceberg/db';
import {
  ESCALAS_DE_LETRA, elevation, fonts, pesos, radii, spacing, type Letra, type Theme,
} from '@iceberg/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { Ayuda } from '../../components/Ayuda';
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { Interruptor } from '../../components/Interruptor';
import { Panel } from '../../components/Panel';
import { Pantalla } from '../../components/Pantalla';
import { Titulo } from '../../components/Titulo';
import { useAireInferior } from '../../datos/desplazamiento';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  PINGUINOS_MAXIMO, PINGUINOS_MINIMO, useCuentas, useLotes, useMiembros, useMovimientos,
  usePinguinos, useSaldo, useSaldoInicial,
} from '../../datos/consultas';
import { useCategorias } from '../../datos/catalogo';
import { useCuentaActiva } from '../../datos/cuenta';
import { useComprometidas } from '../../datos/consultas';
import { TIPOS, usePeriodo } from '../../datos/periodo';
import {
  CarpetaPerdidaError, HAY_CARPETA, elegirCarpeta, nombreDeCarpeta,
} from '../../datos/carpeta';
import { useFraseDeCifrado } from '../../datos/cifrado';
import { useCambiarEscala, useLetra } from '../../datos/letra';
import { sincronizarCarpeta } from '../../datos/sincronizar';
import { cargarSemilla } from '../../datos/semilla';
import { useTema } from '../../datos/tema';

export default function Ajustes() {
  const { nombre: tema, theme, alternar } = useTema();
  const aireInferior = useAireInferior();
  const { porDefecto, marcarPorDefecto } = useCuentaActiva();
  const comprometidas = useComprometidas();
  const categorias = useCategorias();
  const letra = useLetra();
  const styles = useMemo(() => crearEstilos(theme, letra), [theme, letra]);
  const { db, contexto, cambiarHogar } = useDatos();
  const avisar = useAvisar();
  const periodo = usePeriodo();

  const movimientos = useMovimientos();
  const cuentas = useCuentas();
  const saldo = useSaldo(useSaldoInicial());
  const lotes = useLotes();
  const miembros = useMiembros();
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<'borrar' | null>(null);
  const [conflictos, setConflictos] = useState<readonly ConflictoLegible[]>([]);
  /**
   * La palabra con la que se cifra. La app ya se la invento: no hay estado
   * "sin cifrar" que este componente pueda producir.
   */
  const cifrado = useFraseDeCifrado();
  /** Lo que hay escrito en el campo, o `null` si nadie lo toco todavia. */
  const [fraseEditada, setFraseEditada] = useState<string | null>(null);
  const [codigoDeHogar, setCodigoDeHogar] = useState('');
  /** La carpeta compartida, o `null` si todavia no se eligio ninguna. */
  const [carpeta, setCarpeta] = useState<string | null>(
    () => leerAjuste(db, CLAVE_CARPETA) || null,
  );
  const [sincronizando, setSincronizando] = useState(false);
  /**
   * Lo que salio mal con la carpeta, dicho **junto a la carpeta**.
   *
   * El aviso general se dibuja al final de Ajustes, a varias secciones de aca: un
   * error al elegir carpeta aparecia fuera de la pantalla y el usuario se
   * quedaba sin saber por que no habia pasado nada.
   */
  const [problemaDeCarpeta, setProblemaDeCarpeta] = useState<string | null>(null);
  /** Archivos de la ultima pasada que se saltaron por venir de otro hogar. */
  const [ajenosEnCarpeta, setAjenosEnCarpeta] = useState(0);
  const [nombrePropio, setNombrePropio] = useState<string | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const pinguinos = usePinguinos();
  const cambiarEscala = useCambiarEscala();

  const vacia = movimientos.length === 0;

  /** Abre el selector del sistema y recuerda la carpeta elegida. */
  async function elegir() {
    setProblemaDeCarpeta(null);
    try {
      const elegida = await elegirCarpeta();
      if (elegida === null) return;
      escribirAjuste(db, CLAVE_CARPETA, elegida);
      // La carpeta cambio: la URI del archivo propio apuntaba a la anterior.
      escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, '');
      setCarpeta(elegida);
      setAviso('Carpeta lista. Ahora toca Sincronizar.');
    } catch (e) {
      setProblemaDeCarpeta((e as Error).message);
    }
  }

  /**
   * Una pasada por la carpeta: traer lo de los otros y dejar lo propio al dia.
   *
   * `permitirOtroHogar` solo llega en verdadero desde el boton de confirmar. Un
   * archivo de otro hogar se salta sin escribir nada, y la unica forma de que
   * entre es que alguien lo diga a proposito.
   */
  async function sincronizar(permitirOtroHogar = false) {
    if (carpeta === null) return;
    setProblemaDeCarpeta(null);
    setSincronizando(true);
    try {
      const r = await sincronizarCarpeta(
        db, contexto, carpeta, { frase: cifrado.frase, permitirOtroHogar },
      );
      setConflictos(r.ejemplos);
      setAjenosEnCarpeta(r.ajenos);

      const { nuevas, actualizadas, conflictos: cuantos } = r.total;
      const cambios = nuevas === 0 && actualizadas === 0
        ? 'Ya estaban al día: nada que traer.'
        : `${nuevas} nuevas, ${actualizadas} actualizadas.`
          + (cuantos === 0 ? '' : ` ${cuantos} se resolvieron por fecha.`);
      setAviso(
        cambios
        + (r.ajenos === 0 ? '' : ` Se saltaron ${r.ajenos} de otro hogar.`)
        + (r.cerrados === 0
          ? ''
          : ` ${r.cerrados} no se pudieron abrir: revisa que la palabra de cifrado`
            + ' sea la misma en los dos teléfonos.'),
      );
    } catch (e) {
      // **La carpeta no se borra por un error cualquiera.** Antes si, y el
      // sintoma era desconcertante: fallaba algo, el boton de sincronizar
      // desaparecia y volvia el de elegir carpeta, sin decir que habia pasado.
      // Solo se suelta cuando el error dice con certeza que ya no hay permiso.
      if (e instanceof CarpetaPerdidaError) {
        escribirAjuste(db, CLAVE_CARPETA, '');
        escribirAjuste(db, CLAVE_ARCHIVO_PROPIO, '');
        setCarpeta(null);
      }
      setProblemaDeCarpeta((e as Error).message);
    } finally {
      setSincronizando(false);
    }
  }

  /** Suma o resta uno, sin salirse de los limites. */
  function cambiarPinguinos(cuanto: number) {
    const van = Math.min(PINGUINOS_MAXIMO, Math.max(PINGUINOS_MINIMO, pinguinos + cuanto));
    if (van === pinguinos) return;
    escribirAjuste(db, CLAVE_PINGUINOS, String(van));
    avisar(van === 1 ? 'Queda un pingüino' : `Quedan ${van} pingüinos`);
  }

  /** Un paso mas grande o mas chica, sin salirse de la tabla. */
  function cambiarTamanoDeLetra(cuanto: number) {
    const donde = ESCALAS_DE_LETRA.findIndex((e) => e.valor === letra.escala);
    const siguiente = ESCALAS_DE_LETRA[
      Math.min(ESCALAS_DE_LETRA.length - 1, Math.max(0, donde + cuanto))
    ];
    if (siguiente === undefined || siguiente.valor === letra.escala) return;
    cambiarEscala(siguiente.valor);
    avisar(`Letra ${siguiente.etiqueta.toLowerCase()}`);
  }

  /** Deja la palabra escrita como la definitiva. Vacia no se acepta. */
  function guardarFrase() {
    const escrita = (fraseEditada ?? '').trim();
    if (escrita === '' || escrita === cifrado.frase) { setFraseEditada(null); return; }
    cifrado.cambiar(escrita);
    setFraseEditada(null);
    setAviso('Palabra guardada. La otra persona tiene que poner la misma.');
  }

  function agregarCategoria() {
    if (nuevaCategoria.trim() === '') return;
    try {
      const creada = crearCategoria(db, contexto, nuevaCategoria);
      setNuevaCategoria('');
      avisar(`Categoría "${creada.nombre}" creada`);
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  /**
   * Saca una categoria propia de la lista.
   *
   * No pide confirmacion, y es a proposito: los movimientos que la usaban no se
   * tocan y siguen mostrando su nombre, y volver a escribirla la revive. Es de
   * las pocas cosas de esta pantalla que no cuesta nada deshacer.
   */
  function quitarCategoria(id: string, nombre: string) {
    try {
      borrarCategoria(db, contexto, id);
      avisar(`Se quitó "${nombre}"`);
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

  const identidad = useMemo(() => ({
    dispositivo: leerAjuste(db, CLAVE_DISPOSITIVO),
    hogar: leerAjuste(db, CLAVE_HOGAR),
    miembro: leerAjuste(db, CLAVE_MIEMBRO),
  }), [db]);
  const identidadDelMiembro = identidad.miembro;
  const yo = miembros.find((m: Miembro) => m.id === identidadDelMiembro);

  return (
    <Pantalla titulo="Ajustes" sinPeriodo>
      <ScrollView
        contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}
      >
        <Seccion
          styles={styles}
          theme={theme}
          titulo="Apariencia"
          ayuda={'Los pingüinos acompañan al iceberg del Resumen: saltan sobre el hielo '
            + 'cuando la mayor parte del gasto es variable y nadan en el mar cuando es '
            + 'poca. De uno a seis, y no hacen nada más que estar ahí.\n\n'
            + 'Deshielo es el tema claro y Noche polar el oscuro. Por ahora la elección '
            + 'dura hasta que cierres la app: al volver a abrirla arranca en Noche polar.'
            + '\n\n'
            + 'El **tamaño de letra** sí se queda guardado, y vale para toda la app: '
            + 'cuatro pasos, de Chica a Enorme.'}
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

        <View style={styles.fila}>
          <Text style={styles.etiqueta}>Pingüinos</Text>
          <View style={styles.contador}>
            <Pressable
              onPress={() => cambiarPinguinos(-1)}
              disabled={pinguinos <= PINGUINOS_MINIMO}
              hitSlop={8}
              style={[styles.botonDeContador, pinguinos <= PINGUINOS_MINIMO && styles.apagado]}
              accessibilityRole="button"
              accessibilityLabel="Un pingüino menos"
            >
              <Minus size={14} weight="bold" color={theme.acentoTexto} />
            </Pressable>
            <Text style={styles.cuantosPinguinos}>{pinguinos}</Text>
            <Pressable
              onPress={() => cambiarPinguinos(1)}
              disabled={pinguinos >= PINGUINOS_MAXIMO}
              hitSlop={8}
              style={[styles.botonDeContador, pinguinos >= PINGUINOS_MAXIMO && styles.apagado]}
              accessibilityRole="button"
              accessibilityLabel="Un pingüino más"
            >
              <Plus size={14} weight="bold" color={theme.acentoTexto} />
            </Pressable>
          </View>
        </View>

        {/*
          El tamano de letra, con los mismos dos botones que los pinguinos.

          El ajuste del sistema no alcanza: React Native solo lo aplica cuando el
          estilo no fija `fontSize`, y en esta app todos lo fijan. Media pantalla
          de Iceberg son cifras de once o doce puntos, asi que hacia falta uno
          propio. Se ve en el acto y en toda la app, porque el mismo objeto
          alimenta los estilos de cada pantalla. Ver `datos/letra`.
        */}
        <View style={styles.fila}>
          <Text style={styles.etiqueta}>Tamaño de letra</Text>
          <View style={styles.contador}>
            <Pressable
              onPress={() => cambiarTamanoDeLetra(-1)}
              disabled={letra.escala === ESCALAS_DE_LETRA[0]!.valor}
              hitSlop={8}
              style={[
                styles.botonDeContador,
                letra.escala === ESCALAS_DE_LETRA[0]!.valor && styles.apagado,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Letra más chica"
            >
              <Minus size={14} weight="bold" color={theme.acentoTexto} />
            </Pressable>
            <Text style={styles.tamanoDeLetra}>{letra.etiqueta}</Text>
            <Pressable
              onPress={() => cambiarTamanoDeLetra(1)}
              disabled={letra.escala === ESCALAS_DE_LETRA[ESCALAS_DE_LETRA.length - 1]!.valor}
              hitSlop={8}
              style={[
                styles.botonDeContador,
                letra.escala === ESCALAS_DE_LETRA[ESCALAS_DE_LETRA.length - 1]!.valor
                  && styles.apagado,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Letra más grande"
            >
              <Plus size={14} weight="bold" color={theme.acentoTexto} />
            </Pressable>
          </View>
        </View>

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
              onPress={() => {
                marcarPorDefecto(porDefecto === cuenta.id ? null : cuenta.id);
                avisar(porDefecto === cuenta.id ? 'Ya no abre con esta cuenta' : 'Guardado');
              }}
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
            + 'Comprometido es lo que llega igual: arriendo, cuentas, cuotas. Variable es '
            + 'lo que decides tú.\n\n'
            + 'Cámbialas si no te calzan: hay quien paga el arriendo con tarjeta y lo '
            + 'lleva en Deudas, y quien ahorra cuando sobra en vez de todos los meses.\n\n'
            + 'Un gasto suelto se puede corregir sin tocar esto, con el interruptor que '
            + 'está al lado de la categoría al crearlo o editarlo.\n\n'
            + 'Las doce primeras vienen con la app y no se pueden quitar. Las que agregues '
            + 'tú aparecen al final y llevan un basurero: quitarlas no borra ningún '
            + 'movimiento, que sigue mostrando el nombre. Y volver a escribirlas las trae '
            + 'de vuelta.\n\n'
            + 'Las categorías propias viajan al sincronizar, así que el otro teléfono ve '
            + 'los mismos nombres.'}
        />
        <Panel theme={theme}>
          {/*
            Alto fijo y scroll propio: la lista arranca en doce y no tiene tope,
            asi que sin esto cada categoria nueva empuja hacia abajo el resto de
            Ajustes y la pantalla se vuelve interminable.
          */}
          <ScrollView style={styles.listaDeCategorias} nestedScrollEnabled>
            {categorias.todas.map((categoria) => {
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
                        avisar('Guardado');
                      }}
                    />
                    {/* El hueco cuando no es propia mantiene alineada la columna
                        del interruptor: sin el, las doce de la app quedarian
                        corridas respecto de las que si se pueden borrar. */}
                    {categoria.propia ? (
                      <Pressable
                        onPress={() => quitarCategoria(categoria.id, categoria.nombre)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Quitar la categoría ${categoria.nombre}`}
                      >
                        <Trash size={14} weight="regular" color={theme.silencio} />
                      </Pressable>
                    ) : <View style={styles.huecoDeBasurero} />}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </Panel>

        <Text style={styles.etiquetaSuelta}>Agregar una categoría</Text>
        <View style={styles.filaDeAgregar}>
          <TextInput
            value={nuevaCategoria}
            onChangeText={setNuevaCategoria}
            placeholder="Mascotas, auto, gimnasio…"
            placeholderTextColor={theme.silencio}
            autoCapitalize="sentences"
            autoCorrect={false}
            onSubmitEditing={agregarCategoria}
            returnKeyType="done"
            style={[styles.entradaFrase, styles.entradaDeCategoria]}
            accessibilityLabel="Nombre de la categoría nueva"
          />
          <Pressable
            onPress={agregarCategoria}
            disabled={nuevaCategoria.trim() === ''}
            style={[styles.botonSecundario, nuevaCategoria.trim() === '' && styles.apagado]}
            accessibilityRole="button"
            accessibilityLabel="Agregar la categoría"
          >
            <Text style={styles.botonTexto}>Agregar</Text>
          </Pressable>
        </View>

        <Seccion
          styles={styles}
          theme={theme}
          titulo="Importar"
          ayuda={'Baja la cartola desde la web de tu banco y elígela aquí. En Banco de '
            + 'Chile se llama Cartola en Excel. Verás una vista previa antes de que se '
            + 'escriba nada.\n\n'
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
          titulo="Sincronizar"
          ayuda={'Sincronizar deja tus datos en una carpeta del teléfono y trae lo que '
            + 'hayan dejado los demás. La app no habla con ninguna nube: solo con esa '
            + 'carpeta.\n\n'
            + '**Para compartir con otra persona**, una sola vez:\n\n'
            + '1. Instalen **Syncthing** en los dos teléfonos y compartan una carpeta.\n'
            + '2. Cada uno la elige acá con Elegir carpeta.\n'
            + '3. Envíale tu código de hogar y tu palabra de cifrado.\n'
            + '4. Esa persona lo pega en "Unirme a otro hogar".\n\n'
            + 'De ahí en adelante Syncthing mueve la carpeta sola, y a ustedes solo les '
            + 'queda tocar Sincronizar para ponerse al día.\n\n'
            + '**Google Drive no sirve**: deja elegir sus carpetas, pero no que otras '
            + 'apps escriban en ellas.\n\n'
            + 'Sincronizar nunca borra nada. Si el mismo movimiento se editó en los dos '
            + 'teléfonos, gana la edición más nueva.\n\n'
            + 'Las cuentas marcadas como no compartidas no viajan, así que tampoco '
            + 'quedan respaldadas en la carpeta.'
            + '\n\n'
            + 'Lo que se deja en la carpeta va **siempre cifrado**, con la palabra que '
            + 'la app se inventó. Los dos teléfonos tienen que tener la misma: '
            + 'envíasela con el botón y pégala allá.'}
        />
        {!HAY_CARPETA ? (
          <Text style={styles.nota}>
            Este navegador no sabe abrir una carpeta. Usa la app del teléfono para
            sincronizar.
          </Text>
        ) : carpeta === null ? (
          <Pressable
            onPress={elegir}
            style={[styles.botonSecundario, styles.botonConAire]}
            accessibilityRole="button"
            accessibilityLabel="Elegir la carpeta compartida"
          >
            <Text style={styles.botonTexto}>Elegir carpeta compartida</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.etiquetaSuelta}>Carpeta</Text>
            <Text style={styles.valor} numberOfLines={1}>{nombreDeCarpeta(carpeta)}</Text>
            {/* En fila: los dos textos son cortos y caben. Estaban en columna de
                cuando decian "Fusionar con un archivo" y "Exportar para
                compartir", que no cabian ni de lejos. */}
            <View style={[styles.acciones, styles.botonConAire]}>
              <Pressable
                onPress={() => sincronizar()}
                disabled={sincronizando}
                style={[styles.botonSecundario, sincronizando && styles.apagado]}
                accessibilityRole="button"
                accessibilityLabel="Sincronizar con la carpeta"
              >
                <Text style={styles.botonTexto}>
                  {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
                </Text>
              </Pressable>
              <Pressable
                onPress={elegir}
                style={styles.botonSecundario}
                accessibilityRole="button"
                accessibilityLabel="Cambiar la carpeta compartida"
              >
                <Text style={styles.botonTexto}>Cambiar carpeta</Text>
              </Pressable>
            </View>
          </>
        )}

        {problemaDeCarpeta === null ? null : (
          <Text style={styles.problemaDeCarpeta}>{problemaDeCarpeta}</Text>
        )}

        {ajenosEnCarpeta === 0 ? null : (
          <View style={styles.avisoDeHogar}>
            <Text style={styles.avisoDeHogarTexto}>
              {ajenosEnCarpeta === 1
                ? 'Hay un archivo en la carpeta que no es de tu hogar. '
                : 'Hay ' + ajenosEnCarpeta + ' archivos en la carpeta que no son de tu hogar. '}
              Lo que corresponde es unirte a ese hogar con el código. Si los mezclas igual,
              sus movimientos quedan con los tuyos y no hay forma de separarlos después.
            </Text>
            <View style={styles.acciones}>
              <Pressable
                onPress={() => sincronizar(true)}
                style={[styles.botonSecundario, styles.botonDestructivo]}
                accessibilityRole="button"
                accessibilityLabel="Mezclar igual, aunque sean de otro hogar"
              >
                <Text style={styles.botonTextoDestructivo}>Mezclar igual</Text>
              </Pressable>
              <Pressable
                onPress={() => setAjenosEnCarpeta(0)}
                style={styles.botonSecundario}
                accessibilityRole="button"
                accessibilityLabel="Dejarlos fuera"
              >
                <Text style={styles.botonTexto}>Dejarlos fuera</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/*
          La palabra de cifrado, dentro de Sincronizar y no en una seccion
          aparte.

          Antes era su propia seccion, arrancaba vacia, y vacia queria decir
          "sin cifrar": el archivo con el historial financiero completo salia en
          claro a una carpeta de nube salvo que a alguien se le ocurriera
          escribir una frase. Nadie lo hacia, porque no hay motivo para
          escribir una frase antes de que pase algo.

          Ahora la app se la inventa sola --cuatro palabras y un numero, para
          poder dictarla-- y lo unico que queda por decidir es si se cambia. Va
          aca porque solo significa algo junto a la carpeta: es lo que hay que
          pasarle a la otra persona para que sus archivos se abran.
        */}
        <Text style={styles.etiquetaSuelta}>Palabra de cifrado</Text>
        <TextInput
          value={fraseEditada ?? cifrado.frase}
          onChangeText={setFraseEditada}
          onBlur={guardarFrase}
          placeholder="Inventándola…"
          placeholderTextColor={theme.silencio}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.entradaFrase}
          accessibilityLabel="Palabra de cifrado"
        />
        {/* A la vista y sin puntitos: hay que poder leerla para dictarla, y lo
            que protege es la carpeta, no esta pantalla.

            Mientras el campo este vacio no se dice nada: el unico momento en que
            eso pasa es el instante antes de que la app termine de inventarla, y
            ahi "usa al menos 8 caracteres" seria un reproche por algo que no
            hizo nadie. */}
        {(fraseEditada ?? cifrado.frase) === '' ? null
          : crypto.fraseDebil(fraseEditada ?? cifrado.frase) === null ? (
            <Text style={styles.fraseOk}>
              Todo lo que sale a la carpeta va cifrado con esta palabra.
            </Text>
          ) : (
            <Text style={styles.fraseFloja}>
              {crypto.fraseDebil(fraseEditada ?? cifrado.frase)}
            </Text>
          )}
        <View style={[styles.acciones, styles.botonConAire]}>
          <Pressable
            onPress={() => Share.share({ message: cifrado.frase })}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Enviar la palabra de cifrado"
          >
            <Text style={styles.botonTexto}>Enviársela a alguien</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              cifrado.renovar();
              setFraseEditada(null);
              setAviso('Palabra nueva. Hasta que la otra persona la ponga, sus archivos no se abren.');
            }}
            style={styles.botonSecundario}
            accessibilityRole="button"
            accessibilityLabel="Inventar otra palabra de cifrado"
          >
            <Text style={styles.botonTexto}>Inventar otra</Text>
          </Pressable>
        </View>

        <Text style={styles.etiquetaSuelta}>Código de tu hogar</Text>
        <Pressable
          onPress={() => Share.share({ message: identidad.hogar ?? '' })}
          style={styles.codigo}
          accessibilityRole="button"
          accessibilityLabel="Compartir el código de tu hogar"
        >
          <Text style={styles.codigoTexto} numberOfLines={1}>{identidad.hogar ?? '—'}</Text>
        </Pressable>

        <Text style={styles.etiquetaSuelta}>Unirme a otro hogar</Text>
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
          style={[
            styles.botonSecundario, styles.botonConAire,
            codigoDeHogar.trim() === '' && styles.apagado,
          ]}
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

        {/* El aviso general, al final de todo: lo escriben acciones de
            varias secciones y no es de ninguna. */}
        {aviso === null ? null : <Text style={styles.aviso}>{aviso}</Text>}

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

function crearEstilos(theme: Theme, letra: Letra) {
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
      fontSize: letra.xs, color: theme.tinta,
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
      fontSize: letra.xs, lineHeight: letra.px(18), color: theme.tinta,
    },

    claseDeCategoria: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

    // Lo irreversible no puede verse igual que lo reversible: "Borrar todos los
    // datos" tenia el mismo borde y el mismo color que "Exportar".
    botonDestructivo: { borderColor: theme.vencido },
    botonTextoDestructivo: {
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.xs,
      color: theme.vencidoTexto,
    },
    etiqueta: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.silencioHondo },
    /**
     * La misma etiqueta, pero encabezando un control en vez de viviendo en una
     * fila de dos columnas.
     *
     * Necesita su propio estilo porque `etiqueta` se usa tambien dentro de
     * `fila`, que centra verticalmente: ahi un margen la descuadraria del valor
     * que tiene al lado.
     */
    etiquetaSuelta: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      color: theme.silencioHondo,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    contador: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    botonDeContador: {
      width: 26,
      height: 26,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
    },
    // Ancho fijo: sin el, la fila se corre un pixel al pasar de un digito a
    // otro y los dos botones bailan.
    cuantosPinguinos: {
      minWidth: 14,
      textAlign: 'center',
      fontFamily: fonts.mono,
      fontWeight: pesos.medium,
      fontSize: letra.sm,
      color: theme.tinta,
    },
    // Igual que el contador de pinguinos, pero el valor es una palabra: el
    // ancho fijo lo pone la mas larga para que los botones no bailen.
    tamanoDeLetra: {
      minWidth: 62,
      textAlign: 'center',
      fontFamily: fonts.texto,
      fontWeight: pesos.medium,
      fontSize: letra.sm,
      color: theme.tinta,
    },

    /** Un boton que sigue a un texto o a un campo, no a otro boton. */
    botonConAire: { marginTop: spacing.md },
    /**
     * Alto de la lista de categorias.
     *
     * Unas ocho filas. Que se corte a mitad de una fila es deliberado: es lo que
     * hace evidente que hay mas abajo, cosa que un corte limpio esconderia.
     */
    listaDeCategorias: { maxHeight: 268 },
    huecoDeBasurero: { width: 14 },
    filaDeAgregar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    entradaDeCategoria: { flex: 1 },
    valor: { fontFamily: fonts.mono, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.tinta },
    valorMono: {
      flex: 1,
      textAlign: 'right',
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: letra.px(10),
      color: theme.tinta,
    },

    boton: {
      paddingVertical: 4,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
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
    botonPrincipalTexto: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.sm, color: theme.sobreAcento },
    notaImportar: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.xs, lineHeight: letra.px(18), color: theme.silencio, paddingBottom: spacing.sm },
    lote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    loteTexto: { flex: 1, gap: 1 },
    loteArchivo: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    loteDetalle: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio },
    deshacerTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.vencidoTexto },
    acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    // Los botones se dimensionan por su contenido, asi que el contenedor los
    // alinea a la izquierda en vez de estirarlos a lo ancho.
    entradaFrase: {
      fontFamily: fonts.mono,
      fontWeight: pesos.regular,
      fontSize: letra.sm,
      color: theme.tinta,
      borderBottomWidth: elevation.hairlineWidth,
      borderBottomColor: theme.hairline,
      paddingVertical: spacing.sm,
      // El subrayado del campo quedaba pegado al boton de abajo y los dos se
      // leian como una sola pieza.
      marginBottom: spacing.md,
    },
    fraseOk: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.ingresoTexto },
    fraseFloja: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.vencidoTexto },
    conflictos: {
      gap: spacing.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      backgroundColor: theme.superficie,
    },
    conflictosTitulo: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.tinta },
    conflicto: { gap: 1 },
    conflictoGana: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.xs, color: theme.tinta },
    conflictoPierde: { fontFamily: fonts.mono, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio, textDecorationLine: 'line-through' },
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
      borderRadius: radii.sm,
      borderWidth: elevation.hairlineWidth,
      borderColor: theme.hairline,
      alignSelf: 'flex-start',
    },
    botonTextoAlerta: { fontFamily: fonts.texto, fontWeight: pesos.semibold, fontSize: letra.xs, color: theme.vencidoTexto },
    aviso: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, lineHeight: letra.px(18), color: theme.acentoTexto, paddingTop: spacing.sm },
    botonTexto: { fontFamily: fonts.texto, fontWeight: pesos.medium, fontSize: letra.xs, color: theme.acentoTexto },

    nota: { fontFamily: fonts.texto, fontWeight: pesos.regular, fontSize: letra.px(10), color: theme.silencio, marginTop: spacing.sm },
    /** En rojo y con aire: es lo unico de la seccion que exige una decision. */
    problemaDeCarpeta: {
      fontFamily: fonts.texto,
      fontWeight: pesos.regular,
      fontSize: letra.xs,
      lineHeight: letra.px(18),
      color: theme.vencidoTexto,
      marginTop: spacing.md,
    },
  });
}
