# Auth Keycloak (login optionnel)

OpenAirMap reste **public** sans session. Une connexion Keycloak optionnelle
envoie un Bearer JWT à l’API microspot et active les paramètres privilégiés
documentés côté uspot-api-export (`docs/auth-keycloak-front.md`).

## Ce que débloque le token

| Capacité | Param / route API |
|----------|-------------------|
| Mesures invalidées + champ `status_code` | `invalid=true` sur `/observations*` |
| Campagnes non exposées | `include_non_exposed=true` |
| Identité | `GET /me` (utilisée via claims OIDC côté front) |

Sans Bearer, le comportement carte reste inchangé (filtre public A/O/R,
campagnes `exposed`).

## Configuration OpenAirMap

Dans `.env` / `.env.local` :

```bash
NEXT_PUBLIC_USE_MICROSPOT_API=true
# Proxy same-origin : obligatoire en dev pour que le Bearer atteigne l'API LAN
MICROSPOT_PROXY_TARGET=http://172.16.13.183:3032/microspot
NEXT_PUBLIC_MICROSPOT_API_URL=/microspot

NEXT_PUBLIC_KEYCLOAK_ENABLED=true
NEXT_PUBLIC_KEYCLOAK_URL=https://auth.atmosud.org
NEXT_PUBLIC_KEYCLOAK_REALM=master
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=openairmap

# localhost = secure context (PKCE / crypto.subtle)
NEXT_PUBLIC_AUTH_ORIGIN=http://localhost:3000
```

Sans le proxy, un fetch `localhost` → `http://172.16.x:3032` peut partir avec
les params privilégiés **sans** header `Authorization` (CORS / réseau privé) :
l'API répond alors 401 et on ne voit pas les données enrichies.

- Client Keycloak **public** + **PKCE** (S256).
- Redirect URI à déclarer : `http://localhost:3000/auth/callback`.
- Web origin : `http://localhost:3000`.
- Ouvrir l’app via **`http://localhost:3000`** (pas une IP LAN : sinon
  `crypto.subtle` est indisponible en HTTP).

## Configuration API (uspot-api-export)

Ajouter le `client_id` du front dans `KEYCLOAK_ACCEPTED_AZP` (CSV), **sans**
le mettre en premier si le premier doit rester le client Swagger :

```bash
KEYCLOAK_ACCEPTED_AZP=atmosud-api-uspot,openairmap
```

L’API valide `azp` du JWT ; sans cette entrée, le Bearer est traité comme
anonyme.

CORS : l’origine OpenAirMap doit être autorisée (ex. `http://localhost:3000`).

## Flux

1. Bouton **Se connecter** dans le rail (utilitaires).
2. Authorization Code + PKCE vers Keycloak (`oidc-client-ts`).
3. Retour sur `/auth/callback` → access_token en sessionStorage.
4. `AtmoMicroV2Service` ajoute `Authorization: Bearer …` et les params
   privilégiés ; les caches microspot sont invalidés ; la carte recharge.

Déconnexion : logout Keycloak (redirect) + nettoyage local.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `src/auth/*` | Config, UserManager, tokenStore, AuthProvider |
| `app/auth/callback/page.tsx` | Callback OIDC (hors i18n) |
| `src/components/auth/AuthRailControl.tsx` | UI rail |
| `src/services/AtmoMicroV2Service.ts` | Bearer + params privilégiés |
