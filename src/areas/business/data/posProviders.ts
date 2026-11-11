import type { StaticImageData } from 'next/image';
import ready2orderLogo from '../assets/pos/ready2order-seeklogo.svg';
import orderbirdLogo from '../assets/pos/orderbird-logo.svg';
import lightspeedLogo from '../assets/pos/lightspeed-logo-svg-vector.svg';
import vectronLogo from '../assets/pos/logo-vectron-green.svg';

export type PosProviderId = 'ready2order' | 'orderbird' | 'lightspeed' | 'vectron';

export interface PosProvider {
  id: PosProviderId;
  name: string;
  logo: StaticImageData;
  featured: boolean;
}

export const posProviders: readonly PosProvider[] = [
  {
    id: 'ready2order',
    name: 'ready2order',
    logo: ready2orderLogo,
    featured: true,
  },
  {
    id: 'orderbird',
    name: 'orderbird',
    logo: orderbirdLogo,
    featured: true,
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed',
    logo: lightspeedLogo,
    featured: true,
  },
  {
    id: 'vectron',
    name: 'Vectron',
    logo: vectronLogo,
    featured: false,
  },
];
