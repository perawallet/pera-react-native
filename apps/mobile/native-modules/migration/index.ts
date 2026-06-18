import { requireOptionalNativeModule } from 'expo'

export type LegacyMigrationModule = {
    hasLegacyData(): Promise<boolean>
    getLegacyData(): Promise<unknown>
    getMigrationPlans(): Promise<unknown>
    simulateLegacyDatabase(args: {
        dbName: string
        version: number
        includeUnroutableAccounts?: boolean
        includeAuthState?: boolean
    }): Promise<void>
    simulatePreSixxAccounts?(): Promise<void>
    resetLegacyData(): Promise<void>
}

export const LegacyMigration =
    requireOptionalNativeModule<LegacyMigrationModule>('LegacyMigration')
