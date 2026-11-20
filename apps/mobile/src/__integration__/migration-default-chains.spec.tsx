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
import { cleanup, waitFor } from '@testing-library/react'

// The real driver carries the migration service the splash reads; see
// migration-inbox.spec.tsx.
vi.unmock('@perawallet/wallet-extension-platform')
vi.unmock('@perawallet/wallet-extension-platform-driver')

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { createEmptyLegacyMigrationData } from '@perawallet/wallet-extension-platform/test-utils'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { MigrationSplashScreen } from '@modules/migration'

import {
    installStubMigrationService,
    legacyAlgo25Account,
    legacyHdAccount,
    legacyHdWallet,
} from './__fixtures__/migration'
import {
    ALGO25_TEST_ADDRESS,
    HD_24_ETHEREUM_ADDRESS_0,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const migratedAccountAt = (address: string): WalletAccount | undefined =>
    useAccountsStore
        .getState()
        .accounts.find(
            account => chainAccountOf(account, 'algorand')?.address === address,
        )

describe('Flow: Pera 6 migration → default chains', () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
    })

    it('a migrated HD account gets its Ethereum address; a migrated algo25 account stays on Algorand', async () => {
        installStubMigrationService({
            hasData: true,
            data: {
                ...createEmptyLegacyMigrationData('ios'),
                accounts: [
                    legacyHdAccount(),
                    legacyAlgo25Account(ALGO25_TEST_ADDRESS, {
                        preferredOrder: 1,
                    }),
                ],
                hdSeeds: [legacyHdWallet()],
            },
        })

        renderWithNavigation(MigrationSplashScreen, 'MigrationSplash')

        await waitFor(
            () => {
                expect(migratedAccountAt(HD_TEST_ADDRESS)).toBeDefined()
                expect(migratedAccountAt(ALGO25_TEST_ADDRESS)).toBeDefined()
            },
            { timeout: SLOW_WAIT_TIMEOUT_MS },
        )

        const hd = migratedAccountAt(HD_TEST_ADDRESS)!
        expect(chainAccountOf(hd, 'ethereum')?.address.toLowerCase()).toBe(
            HD_24_ETHEREUM_ADDRESS_0.toLowerCase(),
        )
        expect(hd.chains.ethereum?.enabledBy).toBe('created')

        const algo25 = migratedAccountAt(ALGO25_TEST_ADDRESS)!
        expect(Object.keys(algo25.chains)).toEqual(['algorand'])
    })
})
