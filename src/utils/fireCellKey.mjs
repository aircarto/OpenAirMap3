/**
 * Découpage en cellules des points de chaleur EFFIS.
 *
 * Module volontairement en .mjs : il est le SEUL endroit où la clé de cellule est
 * définie, et il doit être importable à la fois par le runtime (TypeScript, via Vite)
 * et par scripts/build-fire-mask.mjs (Node brut, sans passe de compilation).
 * Toute divergence entre les deux rendrait le masque pré-calculé inopérant.
 */

/** ~1,1 km en latitude : l'ordre de grandeur de la précision des capteurs (375 m à 1 km) */
export const FIRE_CELL_SIZE = 0.01;

/**
 * Clé de cellule stable pour un point.
 *
 * Math.floor (et non Math.round) pour que la cellule reste continue de part et
 * d'autre de zéro : l'emprise France descend à -5,2° de longitude.
 *
 * L'arrondi à 1e-9 avant troncature n'est pas cosmétique : `2.28 / 0.01` vaut
 * 227.99999999999997 en flottant, et un Math.floor direct rangerait un point situé
 * exactement sur une frontière de cellule dans la cellule précédente. La fonction
 * ne serait alors même pas idempotente — cellKey(cellKey(x)) ≠ cellKey(x) — ce qui
 * désaligne silencieusement le masque pré-calculé du filtrage au runtime.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} [cellSize]
 * @returns {string} ex. "43.44,4.89"
 */
export function cellKey(lat, lon, cellSize = FIRE_CELL_SIZE) {
  const snap = (value) => {
    const index = Math.floor(Number((value / cellSize).toFixed(9)));
    return (index * cellSize).toFixed(2);
  };
  return `${snap(lat)},${snap(lon)}`;
}
