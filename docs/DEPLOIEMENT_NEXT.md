# Déploiement Next.js (standalone) derrière Nginx

OpenAirMap se déploie comme une application **Next.js standalone** (process Node)
que Nginx reverse-proxifie. Le build n’écrit plus une SPA statique dans `dist/`.

## Prérequis

- Node.js `>= 20.19.0` (voir `engines.node` dans `package.json` ; Node 22 LTS recommandé)
- Unité systemd : [`deploy/openairmap.service`](../deploy/openairmap.service)
- Nginx : [`deploy/nginx-openairmap.conf.example`](../deploy/nginx-openairmap.conf.example)
- Fichier `.env` sur la VM (gabarit [`.env.inc`](../.env.inc))

## Build et démarrage

Les variables `NEXT_PUBLIC_*` (et `NOINDEX` pour la preprod) doivent être
correctes **avant** le build : elles sont injectées à la compilation, pas au
runtime navigateur.

```bash
npm ci
npm run build
```

`npm run build` enchaîne :

1. `next build` (`output: 'standalone'`) ;
2. [`scripts/prepare-standalone.mjs`](../scripts/prepare-standalone.mjs), qui copie
   `public/` et `.next/static` dans `.next/standalone`.

**Aucun `cp` manuel n’est nécessaire** après le build.

Démarrage :

```bash
# Manuel (équivalent au script npm)
HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js

# Ou
npm run start

# Ou via systemd
sudo systemctl restart openairmap
```

Points importants de l’unité systemd ([`deploy/openairmap.service`](../deploy/openairmap.service)) :

- `WorkingDirectory` = racine du déploiement (là où se trouve `.next/standalone`) ;
- `EnvironmentFile` pointe vers le `.env` de la VM ;
- `HOSTNAME=0.0.0.0` (évite un bug standalone Next + next-intl `as-needed` avec `127.0.0.1`) ;
- `ExecStart=… node .next/standalone/server.js`.

Après tout changement de `NEXT_PUBLIC_*` : rebuild puis `systemctl restart openairmap`.

## Variables importantes

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_*` | Flags client, injectés **au build** |
| `NOINDEX=true` | Preprod : `noindex` + robots Disallow + sitemap vide |
| `NEXT_PUBLIC_FORCE_DOMAIN_CONFIG` | Forcer `atmosud` / `default` sans DNS |

Liste complète des flags : [FEATURE_FLAGS.md](FEATURE_FLAGS.md).

Le Host virtuel (multi-domaine) est propagé aux pages via le cookie `oam-host`
posé par le middleware. `robots.txt` / `sitemap.xml` lisent directement le
header `Host` de la requête.

## Vérifications SEO

```bash
curl -sI -H 'Host: openairmap.atmosud.org' https://localhost/ | head
curl -s -H 'Host: openairmap.atmosud.org' https://localhost/ | grep -E '<title>|description|application/ld\+json'
curl -s -H 'Host: openairmap.fr' https://localhost/a-propos | head
curl -s -H 'Host: preprod-openairmap.atmosud.org' https://localhost/robots.txt
```

## Migration depuis l’ancien déploiement Vite (historique)

La migration vers Next.js standalone est la voie normale. Ne plus déployer
`dist/` ni un `try_files` SPA : Nginx doit `proxy_pass` vers le process Node
(port 3000). Vérifier carte, `/a-propos`, `/mentions-legales`, préfixe de locale
(`/en`, …) et metadata via les `curl` ci-dessus.
