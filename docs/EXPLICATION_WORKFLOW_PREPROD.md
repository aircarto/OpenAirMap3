# Explication detaillee du workflow `preprod-deploy.yaml`

Ce document explique simplement le fichier :
- `.gitea/workflows/preprod-deploy.yaml`

Objectif du workflow :
- Lancer automatiquement un deploiement vers preprod quand tu pushes sur la branche `preprod`.
- Permettre aussi un lancement manuel depuis Gitea pour tester.

---

## 1) Vue d'ensemble du fonctionnement

Quand le workflow se lance :
1. Il prend un runner (`runs-on: ubuntu-latest`).
2. Il recupere le code du repo.
3. Il configure SSH avec une cle stockee en secret.
4. Il se connecte en SSH sur la machine preprod.
5. Il execute :
   - `git pull`
   - `npm ci`
   - `npm run build`

Important :
- Ton application n'est pas dockerisee, et ce n'est pas un probleme.
- Le conteneur runner sert seulement a executer les commandes CI.
- Le vrai build applicatif se fait sur la machine preprod.

---

## 2) Explication bloc par bloc

## 2.1 Nom du workflow

```yaml
name: preprod-deploy
```

- C'est le nom affiche dans l'onglet `Actions` de Gitea.
- Tu peux le renommer librement, cela ne change pas le comportement.

## 2.2 Declencheurs (`on`)

```yaml
on:
  push:
    branches:
      - preprod
  workflow_dispatch:
```

- `push` + `branches: preprod` :
  - Le workflow se lance a chaque push sur `preprod`.
  - Donc merge d'une PR vers `preprod` = declenchement aussi (car cela cree un push sur `preprod`).
- `workflow_dispatch` :
  - Ajoute un bouton "Run workflow" dans l'UI.
  - Tres utile pour tester sans faire un nouveau commit.

## 2.3 Jobs

```yaml
jobs:
  deploy-preprod:
    runs-on: ubuntu-latest
```

- `deploy-preprod` : identifiant du job.
- `runs-on: ubuntu-latest` :
  - Le job doit etre pris par un runner qui a ce label.
  - Dans ton cas, ton runner enregistre possede ce label par defaut.

## 2.4 Etape checkout

```yaml
- name: Checkout
  uses: actions/checkout@v4
```

- Recupere le code du repo dans l'environnement du job.
- Sans cette etape, le job n'a pas le contenu du projet localement.

## 2.5 Etape contexte run

```yaml
- name: Contexte run
  run: |
    echo "ref=${{ gitea.ref }}"
    echo "sha=${{ gitea.sha }}"
```

- Affiche dans les logs :
  - la branche/ref cible,
  - le commit SHA qui a declenche le workflow.
- Utile pour diagnostiquer "quel commit a ete deploie".

## 2.6 Etape setup SSH

```yaml
- name: Setup SSH
  shell: bash
  run: |
    set -euo pipefail
    mkdir -p ~/.ssh
    chmod 700 ~/.ssh
    printf '%s\n' "${{ secrets.PREPROD_SSH_KEY }}" > ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
    ssh-keyscan -p "${{ secrets.PREPROD_PORT }}" "${{ secrets.PREPROD_HOST }}" >> ~/.ssh/known_hosts
```

Cette etape prepare la connexion SSH.

Details :
- `set -euo pipefail` :
  - `-e` stoppe au premier echec,
  - `-u` echoue si variable manquante,
  - `pipefail` propage les erreurs dans les pipes.
- `~/.ssh` + droits :
  - Cree le dossier SSH avec permissions strictes.
- `PREPROD_SSH_KEY` :
  - Recupere la cle privee depuis les secrets Gitea.
  - Ne jamais versionner cette cle dans Git.
- `ssh-keyscan` :
  - Enregistre la cle d'hote du serveur dans `known_hosts`.
  - Evite le prompt interactif "Are you sure you want to continue connecting?".

## 2.7 Etape deploy SSH

```yaml
- name: Deploy preprod
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

Cette etape execute les commandes sur la machine preprod.

Details :
- `ssh ... " ... "` :
  - Ouvre une session distante et lance le bloc de commandes.
- `cd PREPROD_APP_PATH` :
  - Va dans ton dossier app (ex: `/webapps/preprod-openairmap.atmosud.org`).
- `git fetch --all --prune` :
  - Met a jour les refs et nettoie les refs obsoletes.
- `git checkout preprod` + `git pull --ff-only origin preprod` :
  - Force le deploiement de la bonne branche.
  - `--ff-only` evite les merges locaux implicites.
- `npm ci` :
  - Installe exactement les versions du lockfile.
- `npm run build` :
  - Genere le build preprod.
- `git rev-parse --short HEAD` :
  - Affiche le SHA reellement deploie.

---

## 3) Secrets necessaires (obligatoires)

Dans Gitea `Parametres > Actions > Secrets`, tu dois avoir :
- `PREPROD_HOST` : host/IP preprod
- `PREPROD_PORT` : port SSH (souvent `22`)
- `PREPROD_USER` : user SSH
- `PREPROD_SSH_KEY` : cle privee SSH
- `PREPROD_APP_PATH` : chemin app sur preprod

Si un secret manque, le workflow echoue.

---

## 4) Ce qui peut casser (et comment corriger)

- Job en attente :
  - Runner offline, ou label `runs-on` non correspondant.
- Erreur SSH :
  - mauvais host/port/user/cle,
  - reseau non joignable depuis le runner.
- `npm ci` echoue :
  - lockfile incoherent, registry inaccessible, version Node incompatible.
- `git pull --ff-only` echoue :
  - etat local divergent sur preprod (a corriger manuellement une fois).

---

## 5) Pourquoi ce workflow est une bonne base

- Simple a comprendre.
- Reprend exactement ton flux manuel actuel.
- Traçable (SHA dans les logs).
- Facile a durcir ensuite (ajout job CI, verifs, notifications, user SSH dedie).

---

## 6) Ameliorations recommandees ensuite

- Ajouter un job `ci` avant deploy (`lint`, tests).
- Ajouter `concurrency` pour eviter 2 deploiements en meme temps.
- Migrer de ta cle SSH perso vers une cle technique dediee.
- Faire tourner le runner en service `systemd` au lieu d'un terminal manuel.
