import type { ReactNode } from 'react';
import '../src/index.css';

/**
 * Layout racine : le html/body localisé vit dans [locale]/layout.
 * Next exige un root layout minimal.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
