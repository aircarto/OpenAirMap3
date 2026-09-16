# Déploiement Next.js (standalone) derrière Nginx

OpenAirMap n’est plus une SPA Vite (`dist/`). Le build produit un serveur Node
(`output: 'standalone'`) que Nginx reverse-proxifie.

## Prérequis

- Node.js 20+ recommandé (18 minimum selon moteurs locaux)
- Unité systemd : voir [`deploy/openairmap.service`](../deploy/openairmap.service)
- Nginx : voir [`deploy/nginx-openairmap.conf.example`](../deploy/nginx-openairmap.conf.example)
- Fichier `.env` sur la VM (gabarit [`.env.inc`](../.env.inc))

## Build et démarrage manuel

```bash
npm ci
npm run build
# Assets pour standalone :
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
NODE_ENV=production PORT=3000 node .next/standalone/server.js
```

Ou via systemd : `sudo systemctl restart openairmap`.

## Variables importantes

| Variable | Rôle |
|----------|------|
| `NEXT_PUBLIC_*` | Flags client, injectés **au build** (comme l’ancien `VITE_*`) |
| `NOINDEX=true` | Preprod : `noindex` + robots Disallow + sitemap vide |
| `NEXT_PUBLIC_FORCE_DOMAIN_CONFIG` | Forcer `atmosud` / `default` / `aircrowd.atmosud.org` sans DNS |
| `SHARED_AUTH_ENABLED` | Auth login/mdp unique (serveur). Défaut off |
| `SHARED_AUTH_USER` / `PASSWORD` / `SECRET` | Credentials + HMAC cookie (jamais `NEXT_PUBLIC_`) |

Le Host virtuel (multi-domaine) est propagé aux pages via le cookie `oam-host`
posé par le middleware. `robots.txt` / `sitemap.xml` lisent directement le
header `Host` de la requête.

## Auth partagée (AirCrowd)

Opt-in **par déploiement** : ne pas activer sur openairmap.atmosud.org / preprod /
openairmap.fr. Uniquement sur le `.env` de l’instance privée (ex. AirCrowd).

```bash
SHARED_AUTH_ENABLED=true
SHARED_AUTH_USER=aircrowd
SHARED_AUTH_PASSWORD='…'
SHARED_AUTH_SECRET='…'   # longue chaîne aléatoire
```

- Middleware : sans cookie valide → redirect `/connexion` (ou `/en/login`, …)
- Cookie `oam-shared-auth` httpOnly, signé HMAC, TTL 7 jours
- Les secrets ne doivent **jamais** être préfixés `NEXT_PUBLIC_`

Voir aussi [SHARED_AUTH.md](./SHARED_AUTH.md).

## Vérifications SEO

```bash
curl -sI -H 'Host: openairmap.atmosud.org' https://localhost/ | head
curl -s -H 'Host: openairmap.atmosud.org' https://localhost/ | grep -E '<title>|description|application/ld\+json'
curl -s -H 'Host: openairmap.fr' https://localhost/a-propos | head
curl -s -H 'Host: preprod-openairmap.atmosud.org' https://localhost/robots.txt
```

## Cutover depuis Vite

1. Installer Node + unité systemd + adapter Nginx (`proxy_pass` au lieu de `root dist/`).
2. Déployer via le workflow Gitea (build + `systemctl restart`).
3. Vérifier la carte, `/a-propos`, `/mentions-legales`, `/en`, metadata `curl`.
4. Retirer l’ancien `try_files` SPA une fois validé.
