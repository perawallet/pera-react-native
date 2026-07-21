/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import {
    type AgeGateDeviceCapability,
    type AgeGateResult,
    type AgeGateService,
    type AppIntegrityAttestation,
    type AppIntegrityService,
    type BiometricSecurityLevel,
    type BiometricType,
    type BiometricsService,
    type LegacyMigrationData,
    type LegacyMigrationSourcePlatform,
    type MigrationPlanSummary,
    type MigrationService,
    type MigrationStepVersions,
    type SimulateLegacyDatabaseArgs,
    type NotificationOpenListener,
    type PushNotificationInitResult,
    type PushNotificationService,
} from '@perawallet/wallet-extension-platform'

const noop = (): void => undefined

export class ChromePushNotificationService implements PushNotificationService {
    // Chrome ≥116 supports MV3 web push, but the backend only accepts FCM
    // tokens today — flip this once that lands.
    isSupported(): boolean {
        return false
    }
    async initializeNotifications(): Promise<PushNotificationInitResult> {
        return { token: undefined, unsubscribe: noop }
    }
    addNotificationOpenListener(_listener: NotificationOpenListener) {
        return noop
    }
}

/** Real WebAuthn-backed implementation arrives with the vault in milestone 2. */
export class ChromeBiometricsService implements BiometricsService {
    async getSupportedBiometricType(): Promise<BiometricType> {
        return null
    }
    async checkBiometricsAvailable(): Promise<boolean> {
        return false
    }
    async getSecurityLevel(): Promise<BiometricSecurityLevel> {
        return 'none'
    }
    async authenticate(): Promise<boolean> {
        return false
    }
}

export class ChromeAgeGateService implements AgeGateService {
    async requestAgeRange(_minimumAge: number): Promise<AgeGateResult> {
        return { status: 'unknown', source: 'self-declared' }
    }
    async getDeviceCapability(): Promise<AgeGateDeviceCapability> {
        return 'manual'
    }
}

export class ChromeAppIntegrityService implements AppIntegrityService {
    async isSupported(): Promise<boolean> {
        return false
    }
    async attest(_challenge: string): Promise<AppIntegrityAttestation> {
        throw new Error('App integrity attestation is unavailable on web')
    }
}

export class ChromeMigrationService implements MigrationService {
    async hasLegacyData(): Promise<boolean> {
        return false
    }
    async getLegacyData(): Promise<LegacyMigrationData> {
        throw new Error('No legacy data exists on web')
    }
    async isMigrationComplete(): Promise<boolean> {
        return true
    }
    async markMigrationComplete(
        _sourcePlatform: LegacyMigrationSourcePlatform,
    ): Promise<void> {}
    async clearMigrationComplete(): Promise<void> {}
    async getMigrationPlans(): Promise<MigrationPlanSummary[]> {
        return []
    }
    async simulateLegacyDatabase(
        _args: SimulateLegacyDatabaseArgs,
    ): Promise<void> {
        throw new Error('simulateLegacyDatabase is unavailable on web')
    }
    async simulatePreSixxAccounts(): Promise<void> {
        throw new Error('simulatePreSixxAccounts is unavailable on web')
    }
    async resetLegacyData(): Promise<void> {}
    async getCompletedStepVersions(): Promise<MigrationStepVersions | null> {
        return null
    }
    async setCompletedStepVersions(
        _versions: MigrationStepVersions,
    ): Promise<void> {}
}
