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

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { PWText } from '@components/core'
import {
    signingKeyOn,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    deleteBackupKeys,
    persistBackupKeys,
    useBackupSyncStateStore,
    useCloudBackupStore,
    useMnemonicBackupStore,
} from '@perawallet/wallet-core-backup'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { CloudBackupOverviewScreen } from '@modules/cloud-backup/screens/CloudBackupOverviewScreen'

import {
    BACKUP_MNEMONIC,
    fundOnAlgorandMainnet,
    seedAlgo25Account,
    seedHDWalletAccounts,
} from './__fixtures__/cloudBackup'
import { addressOf } from './__fixtures__/accounts'

// The launcher navigates to `BackupWallet` with the backup flow's first screen
// and its params nested under `params`.
type BackupWalletStubProps = {
    route: { params?: { params?: { accountId?: string } } }
}

const BackupWalletStub = ({ route }: BackupWalletStubProps) => (
    <PWText testID='backup_wallet_stub'>
        {route.params?.params?.accountId}
    </PWText>
)

const renderOverview = () =>
    renderWithNavigation(CloudBackupOverviewScreen, 'CloudBackupOverview', {
        additionalScreens: [
            { name: 'BackupWallet', component: BackupWalletStub },
        ],
    })

const openTurnOffSheet = async (
    choiceTestID:
        | 'turn_off_backup_turn_off'
        | 'turn_off_backup_turn_off_and_remove',
) => {
    fireEvent.click(await screen.findByTestId('cloud_backup_overview_turn_off'))
    fireEvent.click(await screen.findByTestId(choiceTestID))
    await screen.findByTestId('confirm_turn_off_backup_sheet')
}

describe('Flow: turning off Cloud Backup lists the accounts that lose their only backup', () => {
    let account: WalletAccount

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useCloudBackupStore.getState().resetState()
        useBackupSyncStateStore.getState().resetState()
        useMnemonicBackupStore.getState().resetState()
        useDeviceStore
            .getState()
            .setDeviceID(useNetworkStore.getState().mode, 'test-device-id')
        await deleteBackupKeys().catch(() => undefined)

        await persistBackupKeys({
            encryptionKey: new Uint8Array(32).fill(1),
            authSecretKey: new Uint8Array(64).fill(2),
            itemKey: new Uint8Array(32).fill(3),
            mnemonic: BACKUP_MNEMONIC,
        })
        useCloudBackupStore.getState().setConfigured({
            backupId: 'did:pera:AT-RISK-TEST',
            salt: 'q311Z4ReDNWpMVuH8XdvSw==',
            deviceId: 'test-device-id',
            credentialsConfirmed: true,
        })

        account = await seedAlgo25Account()
        useAccountsStore.getState().setAccounts([account])
        await fundOnAlgorandMainnet(addressOf(account))
    })

    it('Given a funded account never backed up, then the confirmation lists it and Back Up Passphrases First opens the backup flow for it', async () => {
        renderOverview()

        await openTurnOffSheet('turn_off_backup_turn_off')

        expect(
            await screen.findByTestId(
                'confirm_turn_off_backup_at_risk_summary',
            ),
        ).toBeTruthy()
        expect(
            screen.getByTestId(
                `confirm_turn_off_backup_at_risk_account_${account.id}`,
            ),
        ).toBeTruthy()

        fireEvent.click(
            screen.getByTestId('confirm_turn_off_backup_back_up_first'),
        )

        expect(
            (await screen.findByTestId('backup_wallet_stub')).textContent,
        ).toBe(account.id)
        expect(useCloudBackupStore.getState().backupId).toBe(
            'did:pera:AT-RISK-TEST',
        )
    })

    it('Given its passphrase is backed up, then the confirmation looks as it always did', async () => {
        useMnemonicBackupStore
            .getState()
            .markBackedUp(signingKeyOn(account, ALGORAND_CHAIN_ID)!)
        renderOverview()

        await openTurnOffSheet('turn_off_backup_turn_off')

        await waitFor(() =>
            expect(
                screen
                    .getByTestId('confirm_turn_off_backup_confirm')
                    .getAttribute('aria-disabled'),
            ).not.toBe('true'),
        )
        expect(
            screen.queryByTestId('confirm_turn_off_backup_at_risk_summary'),
        ).toBeNull()
        expect(
            screen.queryByTestId('confirm_turn_off_backup_turn_off_anyway'),
        ).toBeNull()
    })

    it('Given turning off and removing with an account at risk, then Turn Off Anyway waits for the acknowledgement', async () => {
        renderOverview()

        await openTurnOffSheet('turn_off_backup_turn_off_and_remove')

        const turnOffAnyway = await screen.findByTestId(
            'confirm_turn_off_backup_turn_off_anyway',
        )
        await waitFor(() =>
            expect(
                screen.getByTestId('confirm_turn_off_backup_at_risk_summary'),
            ).toBeTruthy(),
        )
        expect(turnOffAnyway.getAttribute('aria-disabled')).toBe('true')

        fireEvent.click(screen.getByTestId('confirm_turn_off_backup_checkbox'))

        await waitFor(() =>
            expect(
                screen
                    .getByTestId('confirm_turn_off_backup_turn_off_anyway')
                    .getAttribute('aria-disabled'),
            ).not.toBe('true'),
        )
    })

    it("Given several funded accounts at risk, then the list from its first to its last row is the sheet's scroll body, with the checkbox and buttons pinned below it", async () => {
        const { first, second } = await seedHDWalletAccounts({
            isAdditionalWallet: true,
        })
        await fundOnAlgorandMainnet(addressOf(first))
        await fundOnAlgorandMainnet(addressOf(second))
        renderOverview()

        await openTurnOffSheet('turn_off_backup_turn_off_and_remove')

        const lastRow = await screen.findByTestId(
            `confirm_turn_off_backup_at_risk_account_${second.id}`,
        )
        const firstRow = screen.getByTestId(
            `confirm_turn_off_backup_at_risk_account_${account.id}`,
        )
        const scrollBody = document.querySelector(
            '[data-scroll-body="confirm_turn_off_backup_sheet"]',
        )
        expect(scrollBody).not.toBeNull()
        expect(scrollBody!.contains(firstRow)).toBe(true)
        expect(scrollBody!.contains(lastRow)).toBe(true)
        expect(
            firstRow.compareDocumentPosition(lastRow) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()

        const footer = screen.getByTestId(
            'confirm_turn_off_backup_sheet_footer',
        )
        for (const id of [
            'confirm_turn_off_backup_checkbox',
            'confirm_turn_off_backup_back_up_first',
            'confirm_turn_off_backup_turn_off_anyway',
            'confirm_turn_off_backup_cancel',
        ]) {
            const control = screen.getByTestId(id)
            expect(footer.contains(control)).toBe(true)
            expect(scrollBody!.contains(control)).toBe(false)
        }
    })
})
