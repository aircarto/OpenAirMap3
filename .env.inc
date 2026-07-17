# =====================================================
# Configuration generale de l'application
# =====================================================

# Active le mode maintenance (true/false)
VITE_MAINTENANCE_MODE=boolean

# Force une configuration de domaine (ex: aircrowd.atmosud.org)
VITE_FORCE_DOMAIN_CONFIG=string


# =====================================================
# Couches et affichage carte
# =====================================================

# Active la couche feux de foret (marqueurs feuxdeforet.fr)
VITE_ENABLE_WILDFIRE_LAYER=boolean

# Cle API NASA FIRMS (MAP_KEY) pour la couche WMS points chauds VIIRS (7 jours).
# Si absente ou vide, le toggle FIRMS n'apparait pas dans le menu fonds de carte.
VITE_FIRMS_MAP_KEY=string

# Couches EFFIS/GWIS (points de chaleur 7 jours WFS+repli WMS + zones brulees saison) :
# aucune variable d'environnement — toujours proposees dans le menu fonds de carte.
# Voir docs/features/DOCUMENTATION_COUCHES_FEUX.md

# Affiche les traces NebuleAir en ligne continue
VITE_SOLID_LINE_NEBULEAIR=boolean

# Active la verification/correction de certaines donnees
VITE_CORRECTED_CHECK=boolean

# Utilise un marqueur specifique pour NebuleAir
VITE_MARKER_NEBULEAIR=boolean

# Affiche le bouton d'activation du clustering
VITE_DISPLAY_CLUSTERING_TOGGLE=boolean

# Affiche la fonctionnalite "commentaire de contexte"
VITE_DISPLAY_CONTEXT_COMMENT_FEATURE=boolean

# Zoom minimum pour afficher les tooltips des marqueurs (ex: 11)
# Mettre false (ou laisser vide) pour afficher les tooltips a tous les zooms
VITE_TOOLTIP_MIN_ZOOM=number|false


# =====================================================
# Publicite / promotion
# =====================================================

# Active l'encart promotionnel capteurs sur la carte
VITE_USE_ADVERTISING=boolean

# URL du bouton CTA "Acheter un capteur" (nouvel onglet)
VITE_SENSOR_SHOP_URL=url


# =====================================================
# Analytics Matomo
# =====================================================

# Active ou desactive le module analytics
VITE_MATOMO_ENABLED=boolean

# Affiche des logs analytics dans la console (dev)
VITE_MATOMO_DEBUG=boolean

# true = envoie les donnees a Matomo / false = logs uniquement (pas d'envoi)
VITE_MATOMO_SEND=boolean

# Le mode CNIL est force dans le code (toujours actif)

# Enleve les query params de l'URL envoyee a Matomo
VITE_MATOMO_STRIP_QUERY_PARAMS=boolean

# URL de base de ton instance Matomo 
VITE_MATOMO_URL=url

# Identifiant du site dans Matomo
VITE_MATOMO_SITE_ID=string|number


# =====================================================
# Debug / diagnostics
# =====================================================

# Active des logs console detailles pour le mode historique
# (fusion multi-sources, collisions d'ID entre AtmoRef/AtmoMicro/NebuleAir)
VITE_HISTORICAL_MODE_LOGS=boolean