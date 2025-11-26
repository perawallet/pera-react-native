export interface AnalyticsService {
    initializeAnalytics(): void
    logEvent(key: string, payload?: unknown): void
}
