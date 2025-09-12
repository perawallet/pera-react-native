import { container } from "tsyringe";
import { useMemo } from "react";

export const RemoteConfigServiceContainerKey = "RemoteConfigService";

export const RemoteConfigKeys = {
  welcome_message: "welcome_message",
} as const;

export type RemoteConfigKey = typeof RemoteConfigKeys[keyof typeof RemoteConfigKeys];

export interface RemoteConfigService {
  initializeRemoteConfig(): void;
  getStringValue(key: RemoteConfigKey, fallback?: string): string;
  getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean;
  getNumberValue(key: RemoteConfigKey, fallback?: number): number;
}

export const useRemoteConfigService = () => {
  return useMemo(
    () => container.resolve<RemoteConfigService>(RemoteConfigServiceContainerKey),
    [RemoteConfigServiceContainerKey]
  );
};
