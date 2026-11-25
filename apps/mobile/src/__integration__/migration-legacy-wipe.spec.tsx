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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

// The real driver carries the migration service the splash reads; see
// migration-inbox.spec.tsx.
vi.unmock('@perawallet/wallet-extension-platform')
vi.unmock('@perawallet/wallet-extension-platform-driver')

import {
    chainAccountOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { createEmptyLegacyMigrationData } from '@perawallet/wallet-extension-platform/test-utils'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { MigrationSplashScreen } from '@modules/migration'
import { useLegacyDataWipe } from '@modules/migration/shell'

import {
    installStubMigrationService,
    legacyAlgo25Account,
} from './__fixtures__/migration'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

const migrateOneAlgo25Account = async () => {
    installStubMigrationService({
        hasData: true,
        data: {
            ...createEmptyLegacyMigrationData('ios'),
            accounts: [legacyAlgo25Account(ALGO25_TEST_ADDRESS)],
        },
    })
    renderWithNavigation(MigrationSplashScreen, 'MigrationSplash')
    await waitFor(
        () =>
            expect(getProvider().migration.isMigrationComplete()).resolves.toBe(
                true,
            ),
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )
    cleanup()
}

describe('Flow: Pera 6 migration → legacy store wiped once the migrated keys are held', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
    })

    it('deletes the legacy store once the migrated key signs, and still reads as migrated', async () => {
        await migrateOneAlgo25Account()
        const migrated = useAccountsStore
            .getState()
            .accounts.find(
                account =>
                    chainAccountOf(account, 'algorand')?.address ===
                    ALGO25_TEST_ADDRESS,
            )
        expect(migrated?.custody.kind).not.toBe('watch')
        await expect(getProvider().migration.hasLegacyData()).resolves.toBe(
            true,
        )

        renderHook(() => useLegacyDataWipe({ isEnabled: true }))

        await waitFor(() =>
            expect(getProvider().migration.hasLegacyData()).resolves.toBe(
                false,
            ),
        )
        await expect(
            getProvider().migration.isMigrationComplete(),
        ).resolves.toBe(true)
    })

    it('keeps the legacy store while the migrated key is held only as watch', async () => {
        await migrateOneAlgo25Account()
        useAccountsStore.getState().setAccounts(
            useAccountsStore.getState().accounts.map(account => ({
                ...account,
                custody: { kind: 'watch' },
            })),
        )

        renderHook(() => useLegacyDataWipe({ isEnabled: true }))

        await new Promise(resolve => setTimeout(resolve, 50))
        await expect(getProvider().migration.hasLegacyData()).resolves.toBe(
            true,
        )
    })
})
