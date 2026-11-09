#!/usr/bin/env python3
"""
Génère les fichiers GeoJSON des « zones » affichées sur OpenAirMap :
aéroports, ports et sites Seveso de la région PACA.

Données 100 % publiques et gratuites :
  - Aéroports / ports / empreintes d'usines : OpenStreetMap via l'Overpass API
  - Liste officielle des sites Seveso         : API Géorisques (BRGM / État)

Ces données sont quasi statiques (un aéroport ou une usine ne déménage pas) :
on les pré-génère donc UNE FOIS dans des fichiers GeoJSON, lus ensuite
directement par la carte (rapide, fiable, aucune dépendance externe au runtime).

Pour régénérer (ex. 1×/an) :  python3 scripts/generate-zones.py

Sortie : public/data/zones/{airports,ports,seveso}.geojson
"""

import json
import os
import time
import urllib.parse
import urllib.request

# Emprise PACA (sud, ouest, nord, est)
PACA_BBOX = (42.98, 4.23, 45.13, 7.72)

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
GEORISQUES_URL = "https://www.georisques.gouv.fr/api/v1/installations_classees"
USER_AGENT = "OpenAirMap-zones/1.0 (https://openairmap.fr; contact@aircarto.fr)"

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "data", "zones",
)

# Centres (lon, lat) couvrant les zones industrielles de PACA pour la requête
# Géorisques (rayon max 20 km/appel). On dédoublonne ensuite par code AIOT.
GEORISQUES_CENTERS = [
    (4.95, 43.45), (5.10, 43.64), (5.37, 43.30), (5.45, 43.53),
    (5.93, 43.13), (4.81, 43.95), (5.78, 43.83), (6.47, 43.54),
    (7.13, 43.65), (6.08, 44.56), (6.99, 43.62), (5.05, 43.40),
]


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------
def http_get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8")


def overpass(query):
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(3):
            try:
                data = urllib.parse.urlencode({"data": query}).encode()
                req = urllib.request.Request(
                    endpoint, data=data, headers={"User-Agent": USER_AGENT}
                )
                with urllib.request.urlopen(req, timeout=180) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception as e:  # noqa: BLE001
                last_err = e
                print(f"   Overpass {endpoint} tentative {attempt + 1} échec: {e}")
                time.sleep(8 * (attempt + 1))  # backoff: 8s, 16s, 24s
    raise RuntimeError(f"Overpass injoignable: {last_err}")


# --------------------------------------------------------------------------
# Conversion Overpass -> géométries GeoJSON (lon/lat)
# --------------------------------------------------------------------------
def way_ring(geometry):
    """Liste de {lat,lon} -> anneau [[lon,lat],...] fermé, ou None."""
    if not geometry or len(geometry) < 3:
        return None
    ring = [[p["lon"], p["lat"]] for p in geometry]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def stitch_rings(ways):
    """Recolle des tronçons (listes de [lon,lat]) en anneaux fermés."""
    segments = [list(w) for w in ways if w and len(w) >= 2]
    rings = []
    while segments:
        ring = segments.pop(0)
        extended = True
        while extended and ring[0] != ring[-1]:
            extended = False
            for i, seg in enumerate(segments):
                if ring[-1] == seg[0]:
                    ring += seg[1:]
                elif ring[-1] == seg[-1]:
                    ring += list(reversed(seg))[1:]
                elif ring[0] == seg[-1]:
                    ring = seg[:-1] + ring
                elif ring[0] == seg[0]:
                    ring = list(reversed(seg))[:-1] + ring
                else:
                    continue
                segments.pop(i)
                extended = True
                break
        if len(ring) >= 4:
            if ring[0] != ring[-1]:
                ring.append(ring[0])
            rings.append(ring)
    return rings


def element_polygon(el):
    """Élément Overpass (way/relation) -> géométrie GeoJSON Polygon/MultiPolygon."""
    if el["type"] == "way":
        ring = way_ring(el.get("geometry"))
        if ring:
            return {"type": "Polygon", "coordinates": [ring]}
        return None

    if el["type"] == "relation":
        outers = [
            [[p["lon"], p["lat"]] for p in m["geometry"]]
            for m in el.get("members", [])
            if m.get("type") == "way" and m.get("role") in ("outer", "")
            and m.get("geometry")
        ]
        rings = stitch_rings(outers)
        if not rings:
            return None
        if len(rings) == 1:
            return {"type": "Polygon", "coordinates": [rings[0]]}
        return {"type": "MultiPolygon", "coordinates": [[r] for r in rings]}
    return None


def feature(geometry, props):
    # Retirer les valeurs vides pour alléger le GeoJSON
    clean = {k: v for k, v in props.items() if v not in (None, "")}
    return {"type": "Feature", "geometry": geometry, "properties": clean}


def common_tags(tags):
    """Étiquettes OSM utiles pour la fiche (photo, site web, exploitant)."""
    out = {}
    for key in ("wikidata", "wikipedia", "website", "operator"):
        if tags.get(key):
            out[key] = tags[key]
    return out


def centroid(geometry):
    """Point représentatif [lon, lat] d'une géométrie (pour la vue aérienne)."""
    if geometry["type"] == "Point":
        return geometry["coordinates"]
    if geometry["type"] == "Polygon":
        ring = geometry["coordinates"][0]
    else:  # MultiPolygon
        ring = geometry["coordinates"][0][0]
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return [round(sum(xs) / len(xs), 6), round(sum(ys) / len(ys), 6)]


_NAF_LABELS = None


def naf_label(code):
    """Code NAF (ex: 19.20Z) -> libellé clair (ex: Raffinage du pétrole)."""
    global _NAF_LABELS
    if _NAF_LABELS is None:
        try:
            data = json.loads(http_get(
                "https://raw.githubusercontent.com/SocialGouv/codes-naf/master/index.json"
            ))
            _NAF_LABELS = {it["id"]: it["label"] for it in data}
        except Exception as e:  # noqa: BLE001
            print(f"   table NAF indisponible: {e}")
            _NAF_LABELS = {}
    return _NAF_LABELS.get(code)


# Entrées de rubriques ICPE qui ne décrivent pas une activité (bruit à écarter)
def clean_activites(natures):
    out = []
    for n in natures:
        s = (n or "").strip()
        low = s.lower()
        if not s:
            continue
        if low.startswith("quantité") or "susceptible d'être présente" in low:
            continue
        if low.startswith("substances ou mélanges auxquels"):
            continue
        # Retirer le suffixe de régime administratif s'il est accolé
        for suf in (" enregistré", " déclaré", " autorisé"):
            if s.lower().endswith(suf):
                s = s[: -len(suf)].strip()
                break
        s = s[0].upper() + s[1:]
        if s not in out:
            out.append(s)
    return out[:6]


def fetch_company(siret):
    """Infos entreprise via l'API Recherche d'entreprises (État, gratuite)."""
    if not siret:
        return {}
    try:
        url = f"https://recherche-entreprises.api.gouv.fr/search?q={siret}"
        d = json.loads(http_get(url, {"Accept": "application/json"}))
        r = (d.get("results") or [None])[0]
        if not r:
            return {}
        out = {}
        dc = r.get("date_creation") or ""
        # Écarter les dates manifestement fictives (1900-01-01 / 1970-01-01)
        if len(dc) >= 4 and dc[:4] not in ("1900", "1970"):
            out["since"] = dc[:4]
        if r.get("section_activite_principale"):
            out["nafSection"] = r["section_activite_principale"]
        label = naf_label(r.get("activite_principale"))
        if label:
            out["naf"] = label
        if r.get("tranche_effectif_salarie"):
            out["effectif"] = r["tranche_effectif_salarie"]
        if r.get("categorie_entreprise"):
            out["categorie"] = r["categorie_entreprise"]
        return out
    except Exception as e:  # noqa: BLE001
        print(f"   recherche-entreprises échec ({siret}): {e}")
        return {}


def write_geojson(name, features):
    path = os.path.join(OUT_DIR, f"{name}.geojson")
    fc = {"type": "FeatureCollection", "features": features}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"   -> {path} ({len(features)} zones, {size // 1024} Ko)")


# --------------------------------------------------------------------------
# Point dans polygone (ray casting) sur l'anneau extérieur
# --------------------------------------------------------------------------
def point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-15) + xi
        ):
            inside = not inside
        j = i
    return inside


def point_in_geometry(lon, lat, geometry):
    if geometry["type"] == "Polygon":
        return point_in_ring(lon, lat, geometry["coordinates"][0])
    if geometry["type"] == "MultiPolygon":
        return any(point_in_ring(lon, lat, poly[0]) for poly in geometry["coordinates"])
    return False


# --------------------------------------------------------------------------
# 1) Aéroports
# --------------------------------------------------------------------------
def build_airports():
    print("1) Aéroports (OpenStreetMap)…")
    s, w, n, e = PACA_BBOX
    q = f"""[out:json][timeout:120];
(
  way["aeroway"="aerodrome"]({s},{w},{n},{e});
  relation["aeroway"="aerodrome"]({s},{w},{n},{e});
);
out geom;"""
    els = overpass(q).get("elements", [])
    feats = []
    for el in els:
        t = el.get("tags", {})
        # Garder les aérodromes nommés (filtre le bruit)
        if not t.get("name"):
            continue
        geom = element_polygon(el)
        if not geom:
            continue
        lon, lat = centroid(geom)
        props = {
            "kind": "airport",
            "name": t.get("name"),
            "iata": t.get("iata"),
            "icao": t.get("icao"),
            "subtype": t.get("aerodrome:type")
            or (t.get("military") and "militaire") or None,
            "lon": lon,
            "lat": lat,
        }
        props.update(common_tags(t))
        feats.append(feature(geom, props))
    write_geojson("airports", feats)
    return len(feats)


# --------------------------------------------------------------------------
# 2) Ports
# --------------------------------------------------------------------------
def build_ports():
    print("2) Ports (OpenStreetMap)…")
    s, w, n, e = PACA_BBOX
    q = f"""[out:json][timeout:120];
(
  way["harbour"="yes"]["name"]({s},{w},{n},{e});
  relation["harbour"="yes"]["name"]({s},{w},{n},{e});
  way["landuse"="harbour"]({s},{w},{n},{e});
  relation["landuse"="harbour"]({s},{w},{n},{e});
  way["industrial"="port"]({s},{w},{n},{e});
  relation["industrial"="port"]({s},{w},{n},{e});
);
out geom;"""
    els = overpass(q).get("elements", [])
    feats = []
    for el in els:
        t = el.get("tags", {})
        geom = element_polygon(el)
        if not geom:
            continue
        lon, lat = centroid(geom)
        props = {
            "kind": "port",
            "name": t.get("name") or "Port",
            "lon": lon,
            "lat": lat,
        }
        props.update(common_tags(t))
        feats.append(feature(geom, props))
    write_geojson("ports", feats)
    return len(feats)


# --------------------------------------------------------------------------
# 3) Sites Seveso (Géorisques) + empreinte d'usine (OpenStreetMap)
# --------------------------------------------------------------------------
def fetch_seveso_sites():
    sites = {}  # codeAIOT -> infos
    for lon, lat in GEORISQUES_CENTERS:
        page = 1
        while True:
            url = (
                f"{GEORISQUES_URL}?page={page}&page_size=100"
                f"&rayon=20000&latlon={lon},{lat}"
            )
            try:
                d = json.loads(http_get(url, {"Accept": "application/json"}))
            except Exception as e:  # noqa: BLE001
                print(f"   Géorisques échec ({lon},{lat}) p{page}: {e}")
                break
            data = d.get("data") or []
            for r in data:
                statut = (r.get("statutSeveso") or "").strip()
                if not statut.startswith("Seveso"):
                    continue
                code = r.get("codeAIOT") or f"{r.get('latitude')},{r.get('longitude')}"
                if code in sites:
                    continue
                lonr, latr = r.get("longitude"), r.get("latitude")
                if lonr is None or latr is None:
                    continue
                adresse = " ".join(
                    str(r.get(k)).strip()
                    for k in ("adresse1", "adresse2", "adresse3")
                    if r.get(k)
                )
                # Rubriques ICPE = ce que le site manipule (activités classées),
                # nettoyées du jargon administratif
                activites = clean_activites(
                    [ru.get("nature") for ru in (r.get("rubriques") or [])]
                )
                sites[code] = {
                    "name": (r.get("raisonSociale") or "Site Seveso").title(),
                    "seuil": statut,
                    "commune": (r.get("commune") or "").title(),
                    "regime": r.get("regime"),
                    "adresse": adresse or None,
                    "siret": r.get("siret"),
                    "activites": activites[:6],
                    "lon": float(lonr),
                    "lat": float(latr),
                }
            if page >= (d.get("total_pages") or 1):
                break
            page += 1
            time.sleep(0.3)
    return list(sites.values())


def fetch_industrial_near(sites):
    """Empreintes landuse=industrial à proximité des sites Seveso.

    Requête découpée en lots : une requête couvrant les ~90 sites d'un coup
    dépasse le timeout d'Overpass.
    """
    polys = []
    batch_size = 10
    batches = [sites[i:i + batch_size] for i in range(0, len(sites), batch_size)]
    for n, batch in enumerate(batches, 1):
        clauses = []
        for st in batch:
            clauses.append(f'way(around:2000,{st["lat"]},{st["lon"]})["landuse"="industrial"];')
            clauses.append(f'relation(around:2000,{st["lat"]},{st["lon"]})["landuse"="industrial"];')
        q = "[out:json][timeout:90];\n(\n" + "\n".join(clauses) + "\n);\nout geom;"
        print(f"   empreintes industrielles, lot {n}/{len(batches)}…")
        try:
            els = overpass(q).get("elements", [])
        except RuntimeError as e:
            # Un lot qui échoue ne doit pas faire perdre toute la couche :
            # les sites concernés tomberont simplement en marqueur (sans contour).
            print(f"   lot {n} ignoré ({e})")
            els = []
        for el in els:
            geom = element_polygon(el)
            if geom:
                polys.append({"geom": geom, "tags": el.get("tags", {})})
        time.sleep(3)
    return polys


def build_seveso():
    print("3) Sites Seveso (Géorisques) + empreintes d'usines (OpenStreetMap)…")
    sites = fetch_seveso_sites()
    print(f"   {len(sites)} sites Seveso trouvés en PACA")
    polys = fetch_industrial_near(sites)
    print(f"   {len(polys)} empreintes industrielles candidates")

    print("   enrichissement entreprises (API Recherche d'entreprises)…")
    feats = []
    matched = 0
    for st in sites:
        props = {
            "kind": "seveso",
            "name": st["name"],
            "seuil": st["seuil"],
            "commune": st["commune"],
            "regime": st.get("regime"),
            "adresse": st.get("adresse"),
            "lon": round(st["lon"], 6),
            "lat": round(st["lat"], 6),
        }
        if st.get("activites"):
            props["activites"] = st["activites"]
        # Profil entreprise (secteur, ancienneté, taille) via le SIRET
        props.update(fetch_company(st.get("siret")))
        time.sleep(0.2)
        # Empreinte qui contient le point Seveso
        hit = next(
            (p for p in polys if point_in_geometry(st["lon"], st["lat"], p["geom"])),
            None,
        )
        if hit:
            matched += 1
            # Récupérer photo/lien si l'empreinte OSM est documentée
            props.update(common_tags(hit["tags"]))
            feats.append(feature(hit["geom"], props))
        else:
            # Repli : un point (la carte affichera un petit marqueur)
            feats.append(feature(
                {"type": "Point", "coordinates": [st["lon"], st["lat"]]}, props
            ))
    print(f"   {matched}/{len(sites)} sites avec contour d'usine (le reste en marqueur)")
    write_geojson("seveso", feats)
    return len(feats)


# --------------------------------------------------------------------------
if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Génération des zones PACA (aéroports / ports / Seveso)\n")
    a = build_airports()
    p = build_ports()
    s = build_seveso()
    print(f"\nTerminé : {a} aéroports, {p} ports, {s} sites Seveso.")
