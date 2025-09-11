import { container } from "tsyringe";
import { useMemo } from "react";

export const CrashlyticsServiceContainerKey = "CrashlyticsService";

export interface CrashlyticsService {
  initialize(): void;
  recordNonFatalError(error: unknown): void;
}

export const useCrashlyticsService = () => {
  return useMemo(
    () => container.resolve<CrashlyticsService>(CrashlyticsServiceContainerKey),
    [CrashlyticsServiceContainerKey]
  );
};
