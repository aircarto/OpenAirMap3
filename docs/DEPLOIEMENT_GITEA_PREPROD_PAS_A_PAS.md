# CI/CD preprod avec Gitea Actions (pas a pas)

## Objectif

Mettre en place un deploiement automatique de la preprod :
- Declenchement sur push/merge de la branche `preprod`
- Execution d'un workflow Gitea Actions
- Deploiement sur la machine preprod interne

Dans ton cas, le deploiement actuel est deja :
- `git pull`
- `npm ci`
- `npm run build`

Ce document transforme ce flux manuel en flux automatique, sans changer la logique applicative.

---

## Strategie recommandee pour ton cas

Pour une premiere mise en place rapide :
- Installer le runner sur ta VM de dev perso.
- Utiliser temporairement ton user SSH et ta cle actuelle.
- Valider que le deploiement automatique fonctionne sur `preprod`.

Puis dans un second temps :
- Migrer vers un user technique dedie CI/CD.
- Migrer vers une cle dediee CI/CD.
- Restreindre les droits SSH et durcir la securite.

Cette approche est acceptable pour demarrer vite, a condition de planifier la phase de durcissement.

---

## Parametres de reference (ton setup)

- URL Gitea : `http://vmli-gitea.airmaraix1.com`
- Nom runner souhaite : `preprod-openairmap-test`
- Branche de declenchement : `preprod`

Ces valeurs sont reprises dans les exemples ci-dessous.

---

## 1) Prerequis indispensables

## 1.1 Cote Gitea
- Onglet `Actions` actif sur le repo.
- Au moins un `Executeur` (runner) disponible.
- Acces aux `Secrets` du repo.

Important : ta capture montre `Gestion des executeurs (Total: 0)`.
Tu dois donc d'abord enregistrer un runner.

## 1.2 Cote reseau (point critique)

Ta machine preprod est accessible uniquement en reseau interne.
Le runner doit donc etre dans le reseau interne aussi.

Dans ta situation actuelle (recommandation pratique) :
- Runner installe sur ta VM de dev perso (accessible en SSH vers preprod).
- Deploiement effectue avec ton user SSH dans un premier temps.
- Durcissement ensuite vers user/cle dedies.


---

## 2) Etape 1 - Creer et enregistrer un runner

Depuis `Parametres > Actions > Executeurs` :
- Cliquer `Creer un nouvel executeur`.
- Recuperer le token d'enregistrement.

Installer `act_runner` sur la machine interne choisie, puis l'enregistrer avec ce token.
Exemple conceptuel (adapter selon ton OS) :

```bash
./act_runner register \
  --instance http://vmli-gitea.airmaraix1.com \
  --token <token_runner> \
  --name preprod-openairmap-test \
  --labels "linux:host"
```

Puis lancer le runner :

```bash
./act_runner daemon
```

Verification attendue dans Gitea :
- Le runner apparait `online`.
- Le label configure (ex: `linux:host`) est visible.
- Le nom du runner est `preprod-openairmap-test`.

---

## 3) Etape 2 - Ajouter les secrets du repo

Dans `Parametres > Actions > Secrets`, creer :
- `PREPROD_HOST` : IP/hostname interne
- `PREPROD_PORT` : port SSH (souvent `22`)
- `PREPROD_USER` : utilisateur SSH
- `PREPROD_SSH_KEY` : cle privee SSH (format OpenSSH)
- `PREPROD_APP_PATH` : `/webapps/preprod-openairmap.atmosud.org`

Conseil :
- Phase 1 (rapide) : tu peux utiliser temporairement ta cle actuelle.
- Phase 2 (durcissement) : migrer vers une cle dediee CI/CD.
- Autoriser seulement ce qui est necessaire sur le serveur.

---

## 4) Etape 3 - Ajouter le workflow Gitea

Creer le fichier :
- `.gitea/workflows/preprod-deploy.yml`

Contenu recommande :

```yaml
name: preprod-deploy

on:
  push:
    branches:
      - preprod
  workflow_dispatch:

jobs:
  deploy-preprod:
    runs-on: linux:host
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Afficher le contexte
        run: |
          echo "ref=${{ gitea.ref }}"
          echo "sha=${{ gitea.sha }}"

      - name: Installer cle SSH
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          printf '%s\n' "${{ secrets.PREPROD_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -p "${{ secrets.PREPROD_PORT }}" "${{ secrets.PREPROD_HOST }}" >> ~/.ssh/known_hosts

      - name: Deployer sur preprod
        shell: bash
        run: |
          set -euo pipefail
          ssh -p "${{ secrets.PREPROD_PORT }}" "${{ secrets.PREPROD_USER }}@${{ secrets.PREPROD_HOST }}" "
            set -euo pipefail
            cd '${{ secrets.PREPROD_APP_PATH }}'
            git fetch --all --prune
            git checkout preprod
            git pull --ff-only origin preprod
            npm ci
            npm run build
            echo 'SHA deploye:' \$(git rev-parse --short HEAD)
          "
```

Notes importantes :
- `runs-on` doit correspondre exactement au label du runner.
- Le `workflow_dispatch` permet un lancement manuel pour test.

---

## 5) Etape 4 - Test de bout en bout

1. Faire un petit commit sur `preprod`.
2. Verifier qu'un run apparait dans `Actions`.
3. Ouvrir les logs :
   - Runner selectionne correctement
   - Connexion SSH OK
   - `npm ci` et `npm run build` OK
4. Verifier le site preprod.
5. Verifier le SHA deploie dans les logs.

Si le job reste en attente :
- Runner offline ou mauvais label `runs-on`.

Si SSH echoue :
- Cle invalide, host/port faux, ou acces reseau interne manquant.

---

## 6) Durcir le pipeline (recommande ensuite)

- Ajouter un job `ci` avant deploy (`npm ci`, `npm run lint`, `npm run test:run`).
- N'executer le deploy que si `ci` est vert.
- Bloquer les executions concurrentes sur `preprod`.
- Ajouter notifications de succes/echec.
- Remplacer le user SSH personnel par un user technique (ex: `deploy-openairmap`).
- Remplacer la cle personnelle par une cle dediee CI/CD.
- Limiter les permissions du user de deploiement au strict necessaire.

---

## 7) Extension vers la production

Plus tard, dupliquer le schema :
- Nouveau workflow `prod-deploy.yml`
- Trigger sur `main` (ou tags)
- Secrets dedies prod
- Runner/host prod separes
- Validation manuelle avant deploy

Cela permet d'evoluer sans refonte.
