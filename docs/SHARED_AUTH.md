# Auth partagée (login / mot de passe unique)

Gate d’accès optionnel pour une instance privée (ex. **AirCrowd**), activable
uniquement via variables **serveur** — jamais exposées au bundle client.

## Quand l’utiliser

- Partager **un** couple identifiant / mot de passe avec les acteurs du projet
- Ne pas ouvrir la carte au public sur ce Host
- Garder openairmap / preprod **ouverts** (flag désactivé ou absent)

## Configuration

Dans le `.env` du **seul** déploiement concerné :

```bash
SHARED_AUTH_ENABLED=true
SHARED_AUTH_USER=aircrowd
SHARED_AUTH_PASSWORD=change-me
SHARED_AUTH_SECRET=long-random-hmac-secret
```

| Variable | Défaut | Notes |
|----------|--------|--------|
| `SHARED_AUTH_ENABLED` | `false` | Opt-in |
| `SHARED_AUTH_USER` | — | Requis si enabled |
| `SHARED_AUTH_PASSWORD` | — | Requis si enabled |
| `SHARED_AUTH_SECRET` | — | HMAC du cookie ; requis si enabled |

Redémarrer le process Node après modification du `.env` (les vars serveur
ne sont pas figées au build, contrairement à `NEXT_PUBLIC_*`).

## Comportement

1. Flag off → aucune redirection, pas de page login utile
2. Flag on + pas de cookie valide → redirect vers `/connexion` (i18n)
3. `POST /api/auth/login` → cookie `oam-shared-auth` (httpOnly, SameSite=Lax)
4. `POST /api/auth/logout` → efface le cookie

Les chemins `/api/auth/*`, `/connexion` (et équivalents i18n), `robots.txt` et
`sitemap.xml` restent accessibles sans session.

## Isolation multi-instance

- **Auth** : contrôlée par le `.env` du déploiement (pas par le code métier)
- **Config AirCrowd** (carte, WMS, whitelist) : clé hostname
  `aircrowd.atmosud.org` dans `domainConfig.ts` — n’affecte pas les autres Hosts

Ne pas committer de vrais mots de passe. Ne jamais préfixer ces vars avec
`NEXT_PUBLIC_`.
