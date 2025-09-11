import { container } from "tsyringe";
import { useMemo } from "react";

export const RemoteConfigContainerKey = "RemoteConfigService";

export enum RemoteConfigKey {
  welcome_message = "welcome_message",
}

export interface RemoteConfigService {
  initialize(): void;
  getStringValue(key: RemoteConfigKey, fallback?: string): string;
  getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean;
  getNumberValue(key: RemoteConfigKey, fallback?: number): number;
}

export const useRemoteConfigService = () => {
  return useMemo(
    () => container.resolve<RemoteConfigService>(RemoteConfigContainerKey),
    [RemoteConfigContainerKey]
  );
};
