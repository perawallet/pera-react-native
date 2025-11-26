export interface CrashReportingService {
    initializeCrashReporting(): void
    recordNonFatalError(error: unknown): void
}
