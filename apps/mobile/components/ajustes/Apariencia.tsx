/** Tema, pingüinos, tamaño de letra, cómo salen las explicaciones y el tutorial. */

import { CLAVE_PINGUINOS, escribirAjuste } from '@iceberg/db';
import { ESCALAS_DE_LETRA, type ThemeName } from '@iceberg/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Boton } from '../Boton';
import { Opciones, type Opcion } from '../Formulario';
import { Contador, Fila, Seccion } from './comun';
import { useDatos } from '../../datos/BaseDeDatos';
import {
  PINGUINOS_MAXIMO, PINGUINOS_MINIMO, useExplicacionDeAPoco, usePinguinos,
} from '../../datos/consultas';
import { useCambiarEscala, useLetra } from '../../datos/letra';
import { useCambiarTema, useTema } from '../../datos/tema';
import { useMostrarTutorial } from '../../datos/tutorial';

const TEMAS: readonly Opcion<ThemeName>[] = [
  { valor: 'light', etiqueta: 'Deshielo', accesible: 'Tema claro, Deshielo' },
  { valor: 'dark', etiqueta: 'Noche polar', accesible: 'Tema oscuro, Noche polar' },
];

const EXPLICACIONES: readonly Opcion<boolean>[] = [
  { valor: false, etiqueta: 'Enteras', accesible: 'Las explicaciones salen enteras' },
  { valor: true, etiqueta: 'De a poco', accesible: 'El pingüino cuenta las explicaciones de a poco' },
];

export function Apariencia() {
  const { db } = useDatos();
  const router = useRouter();
  const { nombre: tema } = useTema();
  const cambiarTema = useCambiarTema();
  const pinguinos = usePinguinos();
  const letra = useLetra();
  const cambiarEscala = useCambiarEscala();
  const explicaciones = useExplicacionDeAPoco();
  const mostrarTutorial = useMostrarTutorial();

  const pasoDeLetra = ESCALAS_DE_LETRA.findIndex((e) => e.valor === letra.escala);

  function cambiarPinguinos(cuanto: number) {
    const van = Math.min(PINGUINOS_MAXIMO, Math.max(PINGUINOS_MINIMO, pinguinos + cuanto));
    if (van === pinguinos) return;
    escribirAjuste(db, CLAVE_PINGUINOS, String(van));
  }

  // El del sistema no alcanza: React Native solo lo aplica si el estilo no fija
  // `fontSize`, y acá todos lo fijan.
  function cambiarLetra(cuanto: number) {
    const siguiente = ESCALAS_DE_LETRA[pasoDeLetra + cuanto];
    if (siguiente !== undefined) cambiarEscala(siguiente.valor);
  }

  return (
    <Seccion
      titulo="Apariencia"
      ayuda={'Deshielo es el tema claro y Noche polar el oscuro. Mientras no elijas '
        + 'ninguno, la app sigue al teléfono.\n\n'
        + 'Los pingüinos acompañan al iceberg del Resumen: saltan sobre el hielo '
        + 'cuando la mayor parte del gasto es variable y nadan en el mar cuando es '
        + 'poca. De uno a seis, y no hacen nada más que estar ahí.\n\n'
        + 'El **tamaño de letra** vale para toda la app: cuatro pasos, de Chica a '
        + 'Enorme.\n\n'
        + 'Las **explicaciones** son las que abre la i. Salen enteras; si las pones '
        + 'de a poco, el pingüino te las cuenta de a un párrafo y tocando la hoja '
        + 'aparecen todas de golpe.'}
    >
      <Opciones opciones={TEMAS} valor={tema} onElegir={cambiarTema} />

      <Fila etiqueta="Pingüinos">
        <Contador
          valor={String(pinguinos)}
          ancho={16}
          onMenos={() => cambiarPinguinos(-1)}
          onMas={() => cambiarPinguinos(1)}
          puedeMenos={pinguinos > PINGUINOS_MINIMO}
          puedeMas={pinguinos < PINGUINOS_MAXIMO}
          menos="Un pingüino menos"
          mas="Un pingüino más"
        />
      </Fila>

      <Fila etiqueta="Tamaño de letra">
        <Contador
          valor={letra.etiqueta}
          // La palabra más larga ("Enorme") pone el ancho, para que los botones no bailen.
          ancho={64}
          onMenos={() => cambiarLetra(-1)}
          onMas={() => cambiarLetra(1)}
          puedeMenos={pasoDeLetra > 0}
          puedeMas={pasoDeLetra < ESCALAS_DE_LETRA.length - 1}
          menos="Letra más chica"
          mas="Letra más grande"
        />
      </Fila>

      <Fila etiqueta="Explicaciones">
        <View style={styles.opciones}>
          <Opciones opciones={EXPLICACIONES} valor={explicaciones.deAPoco} onElegir={explicaciones.cambiar} />
        </View>
      </Fila>

      {/* Se ve sobre el Resumen, así que se lanza y se navega en el mismo toque. */}
      <Boton
        etiqueta="Ver otra vez el tutorial"
        onPress={() => { mostrarTutorial(); router.replace('/'); }}
      />
    </Seccion>
  );
}

const styles = StyleSheet.create({
  opciones: { width: 200 },
});
