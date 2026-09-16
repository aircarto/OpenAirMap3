import { readEnv } from '../lib/env';

export const advertisingConfig = {
  sensorShopUrl:
    (
      readEnv('NEXT_PUBLIC_SENSOR_SHOP_URL') ??
      readEnv('VITE_SENSOR_SHOP_URL')
    )?.trim() ?? '',
};
