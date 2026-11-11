/**
 * Ajustes, en el orden en que se usan: lo que se toca seguido arriba, la
 * apariencia (que se elige una vez) después, y lo irreversible al final y aparte.
 * Cada sección vive en `components/ajustes`.
 */

import { columna, spacing } from '@iceberg/ui';
import { ScrollView, StyleSheet } from 'react-native';
import { Apariencia } from '../../components/ajustes/Apariencia';
import { Categorias } from '../../components/ajustes/Categorias';
import { Cuentas } from '../../components/ajustes/Cuentas';
import { EmpezarDeCero } from '../../components/ajustes/EmpezarDeCero';
import { EsteTelefono } from '../../components/ajustes/EsteTelefono';
import { Hogar } from '../../components/ajustes/Hogar';
import { Importar } from '../../components/ajustes/Importar';
import { Sincronizar } from '../../components/ajustes/Sincronizar';
import { Pantalla } from '../../components/Pantalla';
import { useAireInferior } from '../../datos/desplazamiento';

export default function Ajustes() {
  const aireInferior = useAireInferior();
  return (
    <Pantalla titulo="Ajustes" sinPeriodo>
      <ScrollView contentContainerStyle={[styles.contenido, { paddingBottom: aireInferior }]}>
        <Cuentas primera />
        <Categorias />
        <Importar />
        <Sincronizar />
        <Hogar />
        <Apariencia />
        <EsteTelefono />
        <EmpezarDeCero />
      </ScrollView>
    </Pantalla>
  );
}

const styles = StyleSheet.create({
  contenido: { ...columna, paddingTop: spacing.md },
});
