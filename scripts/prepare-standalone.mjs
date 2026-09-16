/**
 * Après `next build` (standalone) : copie public/ et .next/static
 * dans le bundle standalone pour servir les assets.
 */
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
const standaloneNext = join(standalone, '.next');

if (!existsSync(standalone)) {
  console.error('standalone manquant — lancer npm run build d’abord');
  process.exit(1);
}

mkdirSync(standaloneNext, { recursive: true });
cpSync(join(root, 'public'), join(standalone, 'public'), { recursive: true });
cpSync(join(root, '.next', 'static'), join(standaloneNext, 'static'), {
  recursive: true,
});
console.log('Assets copiés dans .next/standalone');
