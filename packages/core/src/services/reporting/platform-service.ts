import { container } from 'tsyringe'

export const CrashReportingServiceContainerKey = 'CrashReportingService'

export interface CrashReportingService {
	initializeCrashReporting(): void
	recordNonFatalError(error: unknown): void
}

export const useCrashReportingService = () =>
	container.resolve<CrashReportingService>(CrashReportingServiceContainerKey)
