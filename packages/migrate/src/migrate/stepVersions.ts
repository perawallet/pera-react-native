/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type {
    MigrationService,
    MigrationStepName,
    MigrationStepVersions,
} from '@perawallet/wallet-extension-platform'

/**
 * Target version per migration step. Bumping a step's target causes it to
 * re-run on next launch for every user whose recorded version is behind —
 * including users who already migrated (legacy data is never wiped).
 * Steps must stay idempotent for this reason.
 */
export const MIGRATION_STEP_TARGET_VERSIONS: Record<MigrationStepName, number> =
    {
        // v2 (PERA-4655): authAddress fidelity + watch-account reconciliation.
        accounts: 2,
        preferences: 1,
        swaps: 1,
        // v2 (PERA-4655): legacy single-id fallback.
        deviceIdentifiers: 2,
        contacts: 1,
        notifications: 1,
        auth: 1,
        walletConnect: 1,
        passkeys: 1,
        stashed: 1,
    }

export const ALL_MIGRATION_STEPS = Object.keys(
    MIGRATION_STEP_TARGET_VERSIONS,
) as MigrationStepName[]

/**
 * A pre-step-versioning sentinel means "everything the v1 code migrated" —
 * synthesized as version 1 for every step so target bumps re-run correctly.
 */
export const resolveCompletedStepVersions = async (
    service: MigrationService,
): Promise<MigrationStepVersions> => {
    const record = await service.getCompletedStepVersions()
    if (record !== null) return record
    const legacySentinelSet = await service.isMigrationComplete()
    if (!legacySentinelSet) return {}
    return Object.fromEntries(ALL_MIGRATION_STEPS.map(step => [step, 1]))
}

export const getPendingSteps = async (
    service: MigrationService,
): Promise<MigrationStepName[]> => {
    const completed = await resolveCompletedStepVersions(service)
    return ALL_MIGRATION_STEPS.filter(
        step => (completed[step] ?? 0) < MIGRATION_STEP_TARGET_VERSIONS[step],
    )
}
