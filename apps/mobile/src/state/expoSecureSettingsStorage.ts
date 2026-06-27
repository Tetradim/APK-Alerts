import * as SecureStore from "expo-secure-store";
import type { SecureSettingsStorage } from "./secureSettingsPersistence";

export const expoSecureSettingsStorage: SecureSettingsStorage = {
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
};
