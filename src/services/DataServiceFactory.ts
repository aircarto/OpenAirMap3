import { DataService } from "../types";
import { featureFlags } from "../config/featureFlags";
import { AtmoRefService } from "./AtmoRefService";
import { AtmoMicroService } from "./AtmoMicroService";
import { MicrospotService } from "./MicrospotService";
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
    atmoMicro: featureFlags.useMicrospotApi ? MicrospotService : AtmoMicroService,
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
