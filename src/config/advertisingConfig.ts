export const advertisingConfig = {
  sensorShopUrl:
    (import.meta.env.VITE_SENSOR_SHOP_URL as string | undefined)?.trim() ?? "",
};
