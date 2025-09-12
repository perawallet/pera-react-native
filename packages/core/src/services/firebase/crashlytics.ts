import { container } from "tsyringe";
import { useMemo } from "react";

export const CrashReportingServiceContainerKey = "CrashReportingService";

export interface CrashReportingService {
  initializeCrashReporting(): void;
  recordNonFatalError(error: unknown): void;
}

export const useCrashlyticsService = () => {
  return useMemo(
    () => container.resolve<CrashReportingService>(CrashReportingServiceContainerKey),
    [CrashReportingServiceContainerKey]
  );
};
