import { DataService } from "../types";
import { featureFlags } from "../config/featureFlags";
import { AtmoRefService } from "./AtmoRefService";
import { AtmoMicroService } from "./AtmoMicroService";
import { AtmoMicroV2Service } from "./AtmoMicroV2Service";
import { NebuleAirService } from "./NebuleAirService";
import { SignalAirService } from "./SignalAirService";
import { MobileAirService } from "./MobileAirService";
import { PurpleAirService } from "./PurpleAirService";
import { SensorCommunityService } from "./SensorCommunityService";

export class DataServiceFactory {
  private static services: Map<string, DataService> = new Map();
  private static readonly serviceConstructors: Record<
    string,
    new () => DataService
  > = {
    atmoRef: AtmoRefService,
    // Les microcapteurs ont deux implémentations : la nouvelle API microspot,
    // et l'ancienne (api.atmosud.org/observations/capteurs) qui reste le chemin
    // de repli tant que le périmètre de diffusion microspot n'est pas complet.
    atmoMicro: featureFlags.useMicrospotApi
      ? AtmoMicroV2Service
      : AtmoMicroService,
    nebuleair: NebuleAirService,
    signalair: SignalAirService,
    mobileair: MobileAirService,
    purpleair: PurpleAirService,
    sensorCommunity: SensorCommunityService,
  };

  static getService(sourceCode: string): DataService {
    if (!this.services.has(sourceCode)) {
      const ServiceConstructor = this.serviceConstructors[sourceCode];
      if (!ServiceConstructor) {
        throw new Error(`Service non supporté pour la source: ${sourceCode}`);
      }
      this.services.set(sourceCode, new ServiceConstructor());
    }

    return this.services.get(sourceCode)!;
  }

  static getServices(sourceCodes: string[]): DataService[] {
    return sourceCodes.map((code) => this.getService(code));
  }
}
