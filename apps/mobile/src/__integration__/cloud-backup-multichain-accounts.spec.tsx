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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
    useBackupSyncStateStore,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'
import {
    accountRecordItemKey,
    createItemKeyHasher,
} from '@perawallet/wallet-core-backup/test-handlers'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { CloudBackupAccountsScreen } from '@modules/cloud-backup/screens/CloudBackupAccountsScreen'
import { CloudBackupAccountsReviewScreen } from '@modules/cloud-backup/screens/CloudBackupAccountsReviewScreen'
import {
    ETH_ADDRESS,
    seedHoldings,
    TWO_CHAIN_ACCOUNT,
} from './__fixtures__/multichainHoldings'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

// The integration setup registers whichever chains config enables.
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

const REMOTE_ONLY_ADDRESS =
    'ZZZ7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'
const REMOTE_ONLY_ETH = '0x1111111111111111111111111111111111111111'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

describe('Flow: Cloud backup accounts across networks', () => {
    // The background account fetch is left unmocked: holdings are seeded.
    setSuiteUnhandledRequestMode('bypass')

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedHoldings()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
    })

    afterEach(() => {
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it("Given Ethereum switched off while an account still holds an Ethereum entry, when the list renders, then the row drops its network icons and hint but keeps the account overview's currency total", async () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('chain_ethereum_overrides', '{"enabled":false}')
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])

        renderWithNavigation(CloudBackupAccountsScreen, 'CloudBackupAccounts')

        const row = await screen.findByTestId(
            `cloud_backup_account_${ALGO25_TEST_ADDRESS}`,
        )
        expect(
            within(row).queryByTestId('chain_icon_stack_algorand'),
        ).toBeNull()
        expect(
            screen.queryByTestId('cloud_backup_accounts_networks_hint'),
        ).toBeNull()
        expect(
            within(row).queryByTestId('backup_account_row_toggle'),
        ).toBeNull()
        // The overview values the account in the preferred currency whenever
        // any account holds another registered chain, switched off or not.
        expect(
            within(row).getByTestId('backup_account_summary_fiat'),
        ).toBeTruthy()
    })

    it('Given an account on Algorand and Ethereum, when the backup accounts list renders, then the row shows both networks and the list says the backup covers every network', async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])

        renderWithNavigation(CloudBackupAccountsScreen, 'CloudBackupAccounts')

        const row = await screen.findByTestId(
            `cloud_backup_account_${ALGO25_TEST_ADDRESS}`,
        )
        expect(
            within(row).getByTestId('chain_icon_stack_algorand'),
        ).toBeTruthy()
        expect(
            within(row).getByTestId('chain_icon_stack_ethereum'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('cloud_backup_accounts_networks_hint'),
        ).toBeTruthy()
        expect(
            within(row).queryByTestId('backup_account_address_ethereum'),
        ).toBeNull()
    })

    it("Given that row, when it is pressed, then each network's address shows under it, ready to copy", async () => {
        useAccountsStore.getState().setAccounts([TWO_CHAIN_ACCOUNT])
        renderWithNavigation(CloudBackupAccountsScreen, 'CloudBackupAccounts')
        const row = await screen.findByTestId(
            `cloud_backup_account_${ALGO25_TEST_ADDRESS}`,
        )

        fireEvent.click(within(row).getByTestId('backup_account_row_toggle'))

        expect(
            await within(row).findByTestId('backup_account_address_algorand'),
        ).toBeTruthy()
        const ethereum = within(row).getByTestId(
            'backup_account_address_ethereum',
        )
        expect(ethereum.textContent).toContain('Ethereum')
        expect(ethereum.textContent?.toLowerCase()).toContain(
            ETH_ADDRESS.slice(0, 6),
        )
    })

    it('Given an account on Algorand and Ethereum that only the backup holds, when the review list renders, then its row lists both networks too', async () => {
        useBackupSyncStateStore.getState().setSyncState({
            ...createEmptySyncState('did:pera:test'),
            items: {
                [accountRecordItemKey(hashAddress(REMOTE_ONLY_ADDRESS))]: {
                    type: BackupItemType.ACCOUNT,
                    knownVer: 1,
                    baseVer: 1,
                    isDirty: false,
                    status: BackupItemStatus.ACTIVE,
                    lastRemoteHash: null,
                    pendingImport: true,
                    address: REMOTE_ONLY_ADDRESS,
                    addresses: [REMOTE_ONLY_ADDRESS, REMOTE_ONLY_ETH],
                    record: {
                        formatVersion: 2,
                        updatedAt: 1,
                        chains: [
                            {
                                chain: 'algorand',
                                type: 'watch',
                                address: REMOTE_ONLY_ADDRESS,
                            },
                            {
                                chain: 'ethereum',
                                type: 'watch',
                                address: REMOTE_ONLY_ETH,
                            },
                        ],
                    },
                },
            },
        })

        renderWithNavigation(
            CloudBackupAccountsReviewScreen,
            'CloudBackupAccountsReview',
        )

        const row = await screen.findByTestId(
            `backup_review_available_${REMOTE_ONLY_ADDRESS}`,
        )
        expect(
            within(row).getByTestId('chain_icon_stack_algorand'),
        ).toBeTruthy()
        expect(
            within(row).getByTestId('chain_icon_stack_ethereum'),
        ).toBeTruthy()
    })
})
