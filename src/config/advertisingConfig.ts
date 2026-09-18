import { env } from '../lib/env';

export const advertisingConfig = {
  sensorShopUrl: env.sensorShopUrl?.trim() ?? '',
};
