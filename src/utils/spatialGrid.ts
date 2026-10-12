import { MeasurementDevice, SignalAirReport } from '../types';
import L from 'leaflet';
import { hasValidMapCoordinates } from './instantSnapshot';

/**
 * Structure de données spatiale optimisée pour le filtrage rapide des appareils
 * Utilise spatial grid pour diviser la carte en cellules
 * et indexer les appareils par cellule.
 * 
 * Complexité :
 * - Construction : O(n) où n = nombre d'appareils
 * - Requête : O(1) pour les cellules + O(k) où k = appareils dans les cellules visibles
 * - Gain : ~50-100x plus rapide que le filtrage linéaire O(n) évite de parcourir tous les appareils pour vérifier si ils sont dans les bounds
 */
export class SpatialGrid {
  private grid: Map<string, Set<number>> = new Map();
  private devices: (MeasurementDevice | SignalAirReport)[] = [];
  private deviceIndexMap: Map<number, MeasurementDevice | SignalAirReport> = new Map();
  private cellSize: number;
  private minLat: number = -90;
  private maxLat: number = 90;
  private minLng: number = -180;
  private maxLng: number = 180;

  /**
   * @param cellSize - Taille des cellules en degrés (défaut: 1.0)
   *                   Plus petit = plus précis mais plus de cellules
   *                   Plus grand = moins précis mais moins de cellules
   */
  constructor(cellSize: number = 1.0) {
    this.cellSize = cellSize;
  }

  /**
   * Convertit des coordonnées (lat, lng) en clé de cellule
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Clé de cellule au format "x_y"
   */
  private getCellKey(lat: number, lng: number): string {
    const x = Math.floor((lng - this.minLng) / this.cellSize);
    const y = Math.floor((lat - this.minLat) / this.cellSize);
    return `${x}_${y}`;
  }

  /**
   * Récupère toutes les clés de cellules qui intersectent avec les bounds données (viewport de la carte)
   * @param bounds - Limites géographiques (viewport de la carte)
   * @returns Array de clés de cellules
   */
  private getCellKeysForBounds(bounds: L.LatLngBounds): string[] {
    const keys: string[] = [];
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    const minX = Math.floor((southWest.lng - this.minLng) / this.cellSize);
    const maxX = Math.floor((northEast.lng - this.minLng) / this.cellSize);
    const minY = Math.floor((southWest.lat - this.minLat) / this.cellSize);
    const maxY = Math.floor((northEast.lat - this.minLat) / this.cellSize);

    // Parcourir toutes les cellules dans le rectangle des bounds
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        keys.push(`${x}_${y}`);
      }
    }

    return keys;
  }

  /**
   * Construit la grille spatiale à partir d'une liste d'appareils
   * Complexité : O(n) où n = nombre d'appareils
   * 
   * @param items - Liste d'appareils ou signalements à indexer
   */
  build(items: (MeasurementDevice | SignalAirReport)[]): void {
    // Réinitialiser la grille
    this.grid.clear();
    this.deviceIndexMap.clear();
    this.devices = items;

    // Indexer chaque appareil dans sa cellule
    items.forEach((item, index) => {
      // [null, null] fait traiter Leaflet contains() comme un LatLngBounds
      // invalide → TypeError sur .lat (TimeBar / snapshot historique).
      if (!hasValidMapCoordinates(item.latitude, item.longitude)) {
        return;
      }

      const key = this.getCellKey(item.latitude, item.longitude);
      
      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      
      // Stocker l'index de l'appareil dans la cellule
      this.grid.get(key)!.add(index);
      
      // Mapper l'index à l'appareil pour récupération rapide
      this.deviceIndexMap.set(index, item);
    });
  }

  /**
   * Récupère tous les appareils visibles dans les bounds données
   * Complexité : O(k) où k = nombre d'appareils dans les cellules visibles
   *              Au lieu de O(n) pour un filtrage linéaire
   * 
   * @param bounds - Limites géographiques (viewport de la carte)
   * @returns Liste des appareils visibles
   */
  query(bounds: L.LatLngBounds): (MeasurementDevice | SignalAirReport)[] {
    // Si la grille est vide, retourner un tableau vide
    if (this.grid.size === 0 || this.devices.length === 0) {
      return [];
    }

    // Récupérer les clés de cellules qui intersectent avec les bounds
    const cellKeys = this.getCellKeysForBounds(bounds);
    
    // Si aucune cellule n'est trouvée, retourner un tableau vide
    if (cellKeys.length === 0) {
      return [];
    }

    const visibleIndices = new Set<number>();
    const results: (MeasurementDevice | SignalAirReport)[] = [];

    // Collecter tous les indices d'appareils dans les cellules visibles
    cellKeys.forEach((key) => {
      const cellIndices = this.grid.get(key);
      if (cellIndices) {
        cellIndices.forEach((index) => {
          visibleIndices.add(index);
        });
      }
    });

    // Vérifier que chaque appareil est vraiment dans les bounds
    // (car une cellule peut être partiellement dans les bounds)
    // Cette vérification finale est importante pour la précision
    visibleIndices.forEach((index) => {
      const item = this.deviceIndexMap.get(index);
      if (item) {
        // Vérification précise avec bounds.contains()
        // Leaflet gère correctement les cas limites (antimeridien, etc.)
        try {
          if (bounds.contains([item.latitude, item.longitude])) {
            results.push(item);
          }
        } catch (error) {
          // En cas d'erreur (bounds invalides), ignorer cet appareil
          console.warn('[SpatialGrid] Erreur lors de la vérification bounds:', error);
        }
      }
    });

    return results;
  }

  /**
   * TODO: Optimiser l'update pour ne pas reconstruire la grille complètement mais uniquement les cellules qui ont changé
   * Met à jour la grille avec de nouveaux appareils
   * Plus efficace que rebuild() si peu de changements
   * 
   * @param items - Nouvelle liste d'appareils
   */
  update(items: (MeasurementDevice | SignalAirReport)[]): void {
    // Pour simplifier, on rebuild complètement
    // Une optimisation future pourrait faire un diff
    this.build(items);
  }

  /**
   * Vide la grille et libère la mémoire
   */
  clear(): void {
    this.grid.clear();
    this.deviceIndexMap.clear();
    this.devices = [];
  }

  /**
   * Retourne des statistiques sur la grille (utile pour le debug)
   */
  getStats(): {
    totalItems: number;
    totalCells: number;
    averageItemsPerCell: number;
    maxItemsInCell: number;
  } {
    let totalItemsInCells = 0;
    let maxItemsInCell = 0;

    this.grid.forEach((cell) => {
      const size = cell.size;
      totalItemsInCells += size;
      maxItemsInCell = Math.max(maxItemsInCell, size);
    });

    return {
      totalItems: this.devices.length,
      totalCells: this.grid.size,
      averageItemsPerCell: this.grid.size > 0 ? totalItemsInCells / this.grid.size : 0,
      maxItemsInCell,
    };
  }
}
