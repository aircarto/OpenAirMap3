# =====================================================
# Configuration generale de l'application
# =====================================================

# Active le mode maintenance (true/false)
NEXT_PUBLIC_MAINTENANCE_MODE=boolean

# Force une configuration de domaine (ex: atmosud, default, aircrowd.atmosud.org)
NEXT_PUBLIC_FORCE_DOMAIN_CONFIG=string

# noindex + sitemap vide + Disallow (preprod). Variable serveur (pas NEXT_PUBLIC_).
NOINDEX=boolean


# =====================================================
# Couches et affichage carte
# =====================================================

# Active la couche feux de foret (marqueurs feuxdeforet.fr)
NEXT_PUBLIC_ENABLE_WILDFIRE_LAYER=boolean

# Affiche les traces NebuleAir en ligne continue
NEXT_PUBLIC_SOLID_LINE_NEBULEAIR=boolean

# Utilise un marqueur specifique pour NebuleAir
NEXT_PUBLIC_MARKER_NEBULEAIR=boolean

# Zoom minimum pour afficher les tooltips des marqueurs (ex: 11)
# Mettre false (ou laisser vide) pour afficher les tooltips a tous les zooms
NEXT_PUBLIC_TOOLTIP_MIN_ZOOM=number|false


# =====================================================
# Publicite / promotion
# =====================================================

# Active l'encart promotionnel capteurs sur la carte
NEXT_PUBLIC_USE_ADVERTISING=boolean

# URL du bouton CTA "Acheter un capteur" (nouvel onglet)
NEXT_PUBLIC_SENSOR_SHOP_URL=url


# =====================================================
# Analytics Matomo
# =====================================================

NEXT_PUBLIC_MATOMO_ENABLED=boolean
NEXT_PUBLIC_MATOMO_DEBUG=boolean
NEXT_PUBLIC_MATOMO_SEND=boolean
NEXT_PUBLIC_MATOMO_STRIP_QUERY_PARAMS=boolean
NEXT_PUBLIC_MATOMO_URL=url
NEXT_PUBLIC_MATOMO_SITE_ID=string|number


# =====================================================
# Sources de donnees
# =====================================================

NEXT_PUBLIC_USE_MICROSPOT_API=boolean


# =====================================================
# Debug / diagnostics
# =====================================================

NEXT_PUBLIC_HISTORICAL_MODE_LOGS=boolean
