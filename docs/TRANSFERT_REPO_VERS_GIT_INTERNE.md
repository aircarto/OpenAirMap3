# Transfert du dépôt vers le Git interne entreprise

## Situation actuelle

| Remote | URL | Rôle |
|--------|-----|------|
| **origin** | `git@github.com:alyxBenAtmo/Openairmap.git` | Repo à ton nom (à remplacer) |
| **org** | `git@github.com:aircarto/OpenAirMap3.git` | Repo à conserver |

**Alias actuel :** `git pushall` → pousse vers `origin` puis `org`.

---

## Option recommandée : migration depuis GitHub (Gitea)

Si ton Gitea propose **« Migrate / Importer un dépôt »** depuis GitHub, c’est la méthode la plus simple : Gitea récupère tout (historique, branches, tags) sans passer par ta VM.

### 1. Migrer le dépôt sur Gitea

1. Dans Gitea : **« + »** ou **« New »** → **« Migrate repository »** (ou équivalent).
2. **URL du dépôt source** : `https://github.com/alyxBenAtmo/Openairmap` (ou `git@github.com:alyxBenAtmo/Openairmap.git` si Gitea accepte l’URL SSH).
3. Si demandé : indiquer un **token GitHub** (Settings → Developer settings → Personal access tokens) avec au moins la permission `repo` (lecture des dépôts privés si besoin).
4. Choisir le **nom / l’organisation** du nouveau dépôt sur Gitea.
5. **Options de migration** (à adapter selon ton cas) :
   - **Rendre ce dépôt miroir** : **décocher**. Un miroir reste synchronisé avec la source (GitHub) et n’est pas fait pour être le dépôt sur lequel tu pousses depuis ta VM. Tu veux un dépôt normal sur Gitea que tu utilises comme nouveau `origin`.
   - **Migrer les fichiers LFS** : **cocher** seulement si le dépôt source utilise Git LFS (fichiers volumineux). Ce projet n’utilise pas LFS, tu peux laisser décoché.
6. Lancer la migration, puis noter l’**URL du dépôt** sur Gitea (ex. `git@gitea.entreprise.fr:groupe/Openairmap.git`).

### 2. Sur ta VM : pointer `origin` vers Gitea

Dans ton clone existant, remplacer l’ancien `origin` (GitHub) par le dépôt Gitea :

```bash
cd /chemin/vers/Openairmap   # ton repo local

# Remplacer par l’URL réelle du dépôt Gitea
export ORIGIN_URL="git@gitea.entreprise.fr:groupe/Openairmap.git"

git remote remove origin
git remote add origin "$ORIGIN_URL"
git remote -v
```

### 3. Mettre à jour l’alias `pushall`

Voir [Étape 4 : Mettre à jour l’alias pushall](#étape-4--mettre-à-jour-lalias-pushall) ci‑dessous.

Ensuite : `git pushall` pousse vers Gitea (**origin**) puis **org** (aircarto). Aucun push manuel depuis la VM n’est nécessaire pour le transfert initial.

---

## Méthode alternative : dépôt vide + push depuis la VM

Si tu ne peux pas utiliser la migration Gitea (dépôt vide créé à la main, ou autre outil que Gitea).

### Étape 1 : Créer le dépôt sur le Git interne

À faire **sur l’interface web** (Gitea, GitLab, etc.) :

1. Créer un **nouveau dépôt**.
2. **Ne pas** initialiser avec un README, .gitignore ou licence (dépôt vide).
3. Noter l’**URL de clonage** (SSH de préférence), ex. : `git@git.interne-entreprise.fr:groupe/openairmap.git`

### Étape 2 : Remplacer le remote `origin` par le Git interne

Sur ta VM, dans le repo :

```bash
# Remplacer ORIGIN_URL par l’URL réelle du dépôt interne (SSH de préférence)
export ORIGIN_URL="git@git.interne-entreprise.fr:groupe/openairmap.git"

git remote remove origin
git remote add origin "$ORIGIN_URL"
git remote -v
```

### Étape 3 : Pousser tout l’historique

```bash
git push -u origin --all
git push origin --tags
```

---

## Étape 4 : Mettre à jour l’alias `pushall`

L’alias doit pousser vers le **nouveau** origin (interne) et vers **org** (aircarto).  
À faire **une seule fois** (config globale ou locale) :

```bash
# Si pushall est défini en global (--global)
git config --global alias.pushall '!git push origin --all && git push org --all'

# Si tu préfères le garder local au repo uniquement
git config alias.pushall '!git push origin --all && git push org --all'
```

Ensuite, `git pushall` poussera vers : **origin** (Git interne) puis **org** (aircarto).

---

## Récap après transfert

| Remote | URL |
|--------|-----|
| **origin** | URL du Git interne entreprise |
| **org** | `git@github.com:aircarto/OpenAirMap3.git` (inchangé) |

- Travail au quotidien : comme avant, avec `git pushall` pour synchroniser les deux.
- L’ancien repo GitHub `alyxBenAtmo/Openairmap` ne sera plus utilisé ; tu peux le garder en lecture seule ou le supprimer/archiver selon la politique de ton entreprise.

---

## Dépannage

- **Connexion SSH au Git interne**  
  Tester : `ssh -T git@git.interne-entreprise.fr`  
  Si ça échoue : ajouter ta clé SSH sur le compte Git interne (Settings → SSH Keys).

- **Permission denied / accès refusé**  
  Vérifier que ton compte a les droits « push » sur le projet créé.

- **Repo interne déjà initialisé avec un README**  
  Tu peux faire un premier push avec :  
  `git push -u origin main --force`  
  (à utiliser avec précaution, seulement si le dépôt interne n’a pas d’historique à conserver.)
