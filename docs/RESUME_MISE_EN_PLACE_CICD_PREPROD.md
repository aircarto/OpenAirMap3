Mise en place CI/CD preprod
---

## 1) Objectif atteint

mise en place d'un pipeline sur Gitea qui :
- se declenche sur la branche `preprod`,
- execute une phase CI (qualite),
- puis deploie sur la machine preprod seulement si la CI est verte.

En pratique :
- **CI** : lint + tests unitaires/hooks
- **CD** : connexion SSH a preprod + `git pull` + `npm ci` + `npm run build`

---

## 2) Architecture retenue

Contrainte de depart :
- la machine preprod n'est joignable qu'en reseau interne.

Choix fait :
- runner Gitea installe sur ta VM interne (accessible a preprod en SSH),
- deploiement distant via SSH vers preprod.

Flux simplifie :
1. Push sur `preprod`
2. Gitea Actions lance le workflow
3. Job `ci` dans le runner
4. Si `ci` OK -> job `deploy-preprod`
5. SSH vers preprod et execution des commandes de build

---

## 3) Fichiers importants

- Workflow principal :
  - `.gitea/workflows/preprod-deploy.yaml`

Recommandation :
- garder un seul fichier workflow (`.yaml` ou `.yml`) pour eviter toute confusion.

---

## 4) Contenu du workflow actuel

Le workflow contient 2 jobs :

## 4.1 Job `ci`
- `npm ci`
- `npm run lint`
- `npx vitest run src/services/__tests__ src/hooks/__tests__`

But :
- verifier la qualite avant de deployer.

## 4.2 Job `deploy-preprod`
- `needs: ci` (donc ne se lance que si CI reussit)
- setup SSH avec les secrets
- SSH sur preprod
- execution :
  - `git fetch --all --prune`
  - `git checkout preprod`
  - `git pull --ff-only origin preprod`
  - `npm ci`
  - `npm run build`

---

## 5) Secrets utilises

Dans Gitea Actions > Secrets :
- `PREPROD_HOST` ip machine preprod
- `PREPROD_PORT` port machine preprod
- `PREPROD_USER` user machine preprod
- `PREPROD_SSH_KEY` clé privé de ma machine de dev
- `PREPROD_APP_PATH` chemin du repo sur la machine de preprod

---

## 6) Ce qui definit succes / echec

Regle simple :
- une commande qui retourne `exit code 0` = succes,
- une commande qui retourne `exit code != 0` = echec.

Donc :
- lint avec erreurs => CI echoue,
- tests KO => CI echoue,
- si CI echoue => `deploy-preprod` ne se lance pas.

Note :
- des warnings seuls ne bloquent pas forcement (selon l'outil et ses options).

---

## 7) Deja valide

- Runner enregistre et fonctionnel et passé en service.
- Workflow execute sur `preprod`.
- CI passe (lint + tests cibles).
- SSH vers preprod valide.
- Commandes de deploiement validees manuellement.

---

## 8) Limites connues a ce stade

- La machine preprod doit respecter Node `>= 20.19.0` (voir `engines.node` dans `package.json`, aligné Next.js 15).
- Un upgrade Node vers 22 LTS est recommandé en production si la VM est encore en dessous.

Ces points n'empechent pas le fonctionnement actuel, mais doivent etre suivis.

---

## 9) Mise en place du runner en service systemd (pas a pas)

Objectif :
- ne plus dependre d'un terminal ouvert avec `act_runner daemon`
- avoir un runner qui redemarre automatiquement

### 9.1 Prerequis verifies

Verifier sur la VM runner :

```bash
systemctl --user --version
ls -l /home/airpaca/gitea-runner/act_runner
id
ls -l /var/run/docker.sock
getent group docker
```

Points attendus :
- `systemctl --user` disponible
- binaire `act_runner` present
- user `airpaca` dans le groupe `docker`
- socket Docker en groupe `docker`

### 9.2 Creation du service user

Creer le fichier :
- `~/.config/systemd/user/gitea-runner.service`

Contenu final valide :

```ini
[Unit]
Description=Gitea Act Runner
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/airpaca/gitea-runner
Environment=HOME=/home/airpaca
ExecStart=/usr/bin/sg docker -c '/home/airpaca/gitea-runner/act_runner daemon'
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

Pourquoi `sg docker` :
- dans ce contexte `systemd --user`, le runner n'accedait pas a `/var/run/docker.sock`
- `sg docker` force l'execution dans le groupe Docker

### 9.3 Activation et demarrage

```bash
systemctl --user daemon-reload
systemctl --user enable --now gitea-runner.service
systemctl --user status gitea-runner.service --no-pager
```

### 9.4 Verification logs

```bash
journalctl --user -u gitea-runner.service -n 30 --no-pager
```

Indicateurs de succes :
- `Active: active (running)`
- log `Starting runner daemon`
- log `declare successfully` avec le nom du runner

### 9.5 Erreurs rencontrees et resolution

Erreur 1 :
- `permission denied ... /var/run/docker.sock`

Resolution :
- passage de `ExecStart` en `sg docker -c ...`

Erreur 2 :
- `status=216/GROUP` avec `SupplementaryGroups=docker`

Resolution :
- retirer `SupplementaryGroups` (non supporte ici en service user)
- conserver la solution `sg docker`

### 9.6 Verification finale dans Gitea

- Runner visible `online` dans `Actions > Executeurs` sans lancement manuel du runner
- un run `workflow_dispatch` execute bien :
  - `ci`
  - puis `deploy-preprod`

### 9.7 Option de durcissement

Pour que le service user survive aux deconnexions/reboots sans session ouverte :

```bash
loginctl show-user airpaca -p Linger
```

Si `Linger=no`, faire activer (admin/sudo) :

```bash
sudo loginctl enable-linger airpaca
```

---