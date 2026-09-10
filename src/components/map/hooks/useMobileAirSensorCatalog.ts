import { useEffect, useMemo, useState } from "react";
import { DataServiceFactory } from "../../../services/DataServiceFactory";
import { MobileAirService } from "../../../services/MobileAirService";
import type { MobileAirSensor } from "../../../types";

export interface MobileAirSensorCatalog {
  sensors: MobileAirSensor[];
  loading: boolean;
  /**
   * Suffixe de clé i18n sous `panels.mobileAirSelection.`, et non un message
   * déjà traduit — même contrat que l'ancien état local du panneau, pour que
   * l'affichage reste `t(\`panels.mobileAirSelection.${error}\`)`.
   */
  error: string | null;
}

/**
 * Catalogue des capteurs MobileAir, en miroir du service.
 *
 * Trois raisons d'exister, toutes des défauts de l'état local qu'il remplace
 * dans `MobileAirSelectionPanel` :
 *
 * 1. Le panneau faisait `new MobileAirService()` — une instance **distincte** du
 *    singleton du `DataServiceFactory`. Chaque remontage relançait donc un
 *    `GET /metadata`, et le catalogue obtenu ne profitait jamais au pipeline de
 *    données. Ici on lit le singleton, et l'amorçage synchrone de `useState`
 *    fait qu'un remontage sur catalogue déjà chargé ne déclenche aucun rendu
 *    intermédiaire vide, ni aucun appel réseau.
 * 2. Le chargement passait par `fetchData()`, qui **sort avant** de charger le
 *    catalogue quand le polluant courant n'est pas supporté par MobileAir. Avec
 *    NO₂ sélectionné, la liste restait vide, sans erreur et sans explication.
 *    `ensureSensorsLoaded()` n'a pas ce garde.
 * 3. Le chargement était conditionné à l'ouverture d'un panneau (`isOpen` +
 *    `hasLoadedRef`), ce qui n'a plus de sens pour une UI qui vit dans un menu
 *    monté et démonté à chaque ouverture.
 *
 * `enabled` permet de ne rien charger tant que l'interface de sélection n'est
 * pas visible ; les appels concurrents sont dédupliqués par le service.
 */
export const useMobileAirSensorCatalog = (
  enabled: boolean = true
): MobileAirSensorCatalog => {
  const service = useMemo(
    () => DataServiceFactory.getService("mobileair") as MobileAirService,
    []
  );

  const [sensors, setSensors] = useState<MobileAirSensor[]>(() =>
    service.getSensors()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoaded = sensors.length > 0;

  useEffect(() => {
    if (!enabled || isLoaded) return;

    // `cancelled` plutôt qu'un AbortController : la requête est mutualisée par
    // le service, l'annuler priverait les autres consommateurs de son résultat.
    // Seule la publication dans cet état-ci est abandonnée.
    let cancelled = false;
    setLoading(true);
    setError(null);

    service
      .ensureSensorsLoaded()
      .then((loaded) => {
        if (!cancelled) setSensors(loaded);
      })
      .catch((err: unknown) => {
        console.error("Erreur lors du chargement des capteurs MobileAir:", err);
        if (!cancelled) setError("loadError");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `isLoaded` et non `sensors` : une fois le catalogue en place l'effet ne
    // doit plus rien tenter, et un échec laisse `isLoaded` à false sans
    // relancer de boucle puisque aucune dépendance ne change.
  }, [enabled, isLoaded, service]);

  return { sensors, loading, error };
};

export default useMobileAirSensorCatalog;
