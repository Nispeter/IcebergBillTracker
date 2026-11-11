/**
 * Lo único irreversible de Ajustes, y por eso al final y aparte. Con la base
 * vacía ofrece cargar datos de prueba para ver la app antes de meter los propios.
 */

import { borrarTodo, crearCuenta } from '@iceberg/db';
import { StyleSheet, Text } from 'react-native';
import { Boton } from '../Boton';
import { Seccion } from './comun';
import { useAvisar } from '../../datos/aviso';
import { useDatos } from '../../datos/BaseDeDatos';
import { useMovimientos } from '../../datos/consultas';
import { useEstilos, type Estilo } from '../../datos/estilos';
import { cargarSemilla } from '../../datos/semilla';

export function EmpezarDeCero() {
  const styles = useEstilos(crearEstilos);
  const { db, contexto } = useDatos();
  const avisar = useAvisar();
  const vacia = useMovimientos().length === 0;

  return (
    <Seccion
      titulo="Empezar de cero"
      ayuda={'Borra cuentas, movimientos, reglas e importaciones de este teléfono. '
        + 'No se puede deshacer: si hay algo que conservar, sincroniza antes con la '
        + 'carpeta compartida.\n\n'
        + 'La base arranca vacía, con una cuenta y nada más. Los datos de prueba se '
        + 'cargan desde acá cuando quieras verlos, y se borran igual de fácil.'}
    >
      {vacia ? (
        <>
          <Text style={styles.nota}>
            La base está vacía. Puedes cargar 18 meses de datos chilenos inventados para ver
            cómo se comporta la app antes de meter los tuyos.
          </Text>
          <Boton
            etiqueta="Cargar datos de prueba"
            onPress={() => avisar(`Cargados ${cargarSemilla(db, contexto)} movimientos de prueba`)}
          />
        </>
      ) : (
        <Boton
          variante="peligro"
          etiqueta="Borrar todos los datos"
          confirmar="Tocar de nuevo para borrar todo"
          onPress={() => {
            borrarTodo(db, contexto);
            // Sin ninguna cuenta la app no deja escribir ni un movimiento.
            crearCuenta(db, contexto, { nombre: 'Cuenta corriente', tipo: 'corriente', saldoInicialMinor: 0 });
            avisar('Se borró todo. Quedó una cuenta vacía para empezar');
          }}
        />
      )}
    </Seccion>
  );
}

function crearEstilos({ t, letra }: Estilo) {
  return StyleSheet.create({
    nota: { ...t.nota, lineHeight: letra.px(17) },
  });
}
