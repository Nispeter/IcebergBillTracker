/**
 * Un icono de Phosphor por categoria.
 *
 * Phosphor y no Lucide ni Ionicons: esos dos son la firma visual del look
 * generico, aparecen en la mitad de las apps y se reconocen al instante.
 *
 * **Se importa icono por icono, nunca desde el barril.** `import { House } from
 * 'phosphor-react-native'` arrastra los 3.024 iconos del paquete y engorda el
 * bundle de 1,2 MB a 8,2 MB; por subpath queda en 2,3 MB. Es la diferencia entre
 * una app que carga y una que no.
 */

import type { categories } from '@iceberg/core';
import type { IconProps } from 'phosphor-react-native';
import { Briefcase } from 'phosphor-react-native/src/icons/Briefcase';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { CreditCard } from 'phosphor-react-native/src/icons/CreditCard';
import { ForkKnife } from 'phosphor-react-native/src/icons/ForkKnife';
import { Gift } from 'phosphor-react-native/src/icons/Gift';
import { Heartbeat } from 'phosphor-react-native/src/icons/Heartbeat';
import { House } from 'phosphor-react-native/src/icons/House';
import { Lightning } from 'phosphor-react-native/src/icons/Lightning';
import { PiggyBank } from 'phosphor-react-native/src/icons/PiggyBank';
import { Scales } from 'phosphor-react-native/src/icons/Scales';
import { User } from 'phosphor-react-native/src/icons/User';
import { UsersThree } from 'phosphor-react-native/src/icons/UsersThree';
import type { ComponentType } from 'react';

type IconoCategoria = ComponentType<IconProps>;

const POR_CATEGORIA: Record<categories.CategoryId, IconoCategoria> = {
  vivienda: House,
  servicios: Lightning,
  comida: ForkKnife,
  transporte: Car,
  salud: Heartbeat,
  personales: User,
  familia: UsersThree,
  regalos: Gift,
  ahorros: PiggyBank,
  deudas: CreditCard,
  impuestos: Scales,
  trabajo: Briefcase,
};

export function iconoDeCategoria(id: categories.CategoryId): IconoCategoria {
  return POR_CATEGORIA[id];
}
