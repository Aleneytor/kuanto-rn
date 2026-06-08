import { ImageSourcePropType } from 'react-native';

export interface Bank {
  code: string;
  name: string;
}

export const VENEZUELAN_BANKS: Bank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Exterior' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Sofitasa' },
  { code: '0138', name: 'Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'Del Sur' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'R4 (Banco R4)' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0173', name: 'Banco Internacional de Desarrollo' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Digital de los Trabajadores (BDT)' },
  { code: '0177', name: 'Banfanb' },
  { code: '0178', name: 'N58 Banco Digital' },
  { code: '0191', name: 'BNC Nacional de Crédito' },
  { code: '0601', name: 'IMCP' },
];

export const BANK_LOGOS: Record<string, ImageSourcePropType> = {
  '0102': require('../../assets/banks/0102.png'),
  '0104': require('../../assets/banks/0104.jpg'),
  '0105': require('../../assets/banks/0105.png'),
  '0108': require('../../assets/banks/0108.png'),
  '0114': require('../../assets/banks/0114.jpeg'),
  '0115': require('../../assets/banks/0115.jpeg'),
  '0128': require('../../assets/banks/0128.png'),
  '0134': require('../../assets/banks/0134.jpeg'),
  '0137': require('../../assets/banks/0137.jpg'),
  '0138': require('../../assets/banks/0138.png'),
  '0146': require('../../assets/banks/0146.jpg'),
  '0151': require('../../assets/banks/0151.png'),
  '0156': require('../../assets/banks/0156.jpg'),
  '0157': require('../../assets/banks/0157.jpg'),
  '0163': require('../../assets/banks/0163.jpg'),
  '0166': require('../../assets/banks/0166.jpg'),
  '0168': require('../../assets/banks/0168.png'),
  '0169': require('../../assets/banks/0169.png'),
  '0171': require('../../assets/banks/0171.png'),
  '0172': require('../../assets/banks/0172.png'),
  '0173': require('../../assets/banks/0173.png'),
  '0174': require('../../assets/banks/0174.jpeg'),
  '0175': require('../../assets/banks/0175.png'),
  '0177': require('../../assets/banks/0177.png'),
  '0178': require('../../assets/banks/0178.jpg'),
  '0191': require('../../assets/banks/0191.png'),
  '0601': require('../../assets/banks/0601.png'),
};

export const ACCOUNT_TYPES = [
  { value: 'pago_movil', label: 'Pago Móvil' },
  { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
  { value: 'cuenta_ahorro', label: 'Cuenta de Ahorro' },
] as const;

export type AccountType = 'pago_movil' | 'cuenta_corriente' | 'cuenta_ahorro';

export interface PaymentMethod {
  id: string;
  type: AccountType;
  bankCode: string;
  bankName: string;
  holderName: string;
  idPrefix: string; // V, E, J, G
  holderId: string;
  phoneNumber?: string; // para pago_movil
  accountNumber?: string; // para transferencias
}
