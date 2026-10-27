import type {ReactNode} from 'react';
import './style.css';
import programInfo from '../data/program.json';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const metadata = {
  title: programInfo.name + ' | Workout Tracker',
  description: 'Personal workout logging and approved next-session targets',
  manifest: base + '/manifest.webmanifest',
  icons: {icon: base + '/icon-192.png', apple: base + '/icon-192.png'},
  appleWebApp: {capable: true, statusBarStyle: 'default', title: programInfo.name},
};
export const viewport = {width: 'device-width', initialScale: 1, themeColor: '#101827'};
export default function Layout({children}: {children: ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
