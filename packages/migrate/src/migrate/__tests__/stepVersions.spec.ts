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

import { describe, it, expect } from 'vitest'
import { createStubMigrationService } from '@perawallet/wallet-extension-platform'
import {
    ALL_MIGRATION_STEPS,
    MIGRATION_STEP_TARGET_VERSIONS,
    getPendingSteps,
    resolveCompletedStepVersions,
} from '../stepVersions'

describe('stepVersions', () => {
    it('treats a fresh install (no sentinel, no record) as all steps pending', async () => {
        const service = createStubMigrationService({ hasData: true })
        await expect(getPendingSteps(service)).resolves.toEqual(
            ALL_MIGRATION_STEPS,
        )
    })

    it('synthesizes version 1 for every step when only the legacy sentinel exists', async () => {
        const service = createStubMigrationService({ hasData: true })
        await service.markMigrationComplete('ios')
        const resolved = await resolveCompletedStepVersions(service)
        for (const step of ALL_MIGRATION_STEPS) {
            expect(resolved[step]).toBe(1)
        }
        // accounts (v2, PERA-4655) and deviceIdentifiers (v3, PERA-4670)
        // are the only steps with a target above 1; a legacy sentinel user
        // is synthesized at version 1 for every step, so those are the
        // only ones left pending.
        await expect(getPendingSteps(service)).resolves.toEqual([
            'accounts',
            'deviceIdentifiers',
        ])
    })

    it('reports only steps whose recorded version is behind the target', async () => {
        const service = createStubMigrationService({ hasData: true })
        const allAtTarget = Object.fromEntries(
            ALL_MIGRATION_STEPS.map(step => [
                step,
                MIGRATION_STEP_TARGET_VERSIONS[step],
            ]),
        )
        await service.setCompletedStepVersions({
            ...allAtTarget,
            deviceIdentifiers: 0,
        })
        await expect(getPendingSteps(service)).resolves.toEqual([
            'deviceIdentifiers',
        ])
    })

    it('prefers the explicit record over the legacy sentinel', async () => {
        const service = createStubMigrationService({ hasData: true })
        await service.markMigrationComplete('android')
        await service.setCompletedStepVersions({ accounts: 1 })
        const resolved = await resolveCompletedStepVersions(service)
        expect(resolved).toEqual({ accounts: 1 })
    })
})
