export interface PromotedSensor {
  id: string;
  /** Clé i18n pour le nom affiché (ex. promo.sensor.sensors.nebuleair) */
  nameKey: string;
  /** Clé i18n pour le texte alternatif de l'image */
  altKey: string;
  imageUrl: string;
}

/**
 * Capteurs mis en avant dans l'encart publicitaire.
 * Ajouter une entrée ici lorsque l'image est disponible dans public/capteurs/.
 */
export const promotedSensors: PromotedSensor[] = [
  {
    id: "nebuleair",
    nameKey: "promo.sensor.sensors.nebuleair",
    altKey: "promo.sensor.sensors.nebuleairAlt",
    imageUrl: "/capteurs/NebuleAir_photo.png",
  },
];
