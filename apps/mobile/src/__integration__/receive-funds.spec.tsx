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
import { fireEvent, screen, waitFor } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { AccountSelectionScreen } from '@modules/transactions/screens/receive-funds/AccountSelectionScreen/AccountSelectionScreen'
import { QRViewScreen } from '@modules/transactions/screens/receive-funds/QRViewScreen/QRViewScreen'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useReceiveFundsStore } from '@modules/transactions/hooks/receive-funds/useReceiveFunds'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

const PRIMARY_ACCOUNT: WalletAccount = {
    id: 'primary-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: {
            address: ALGO25_TEST_ADDRESS,
            keyPairId: 'primary-keypair',
        },
    },
    name: 'Primary',
}

const SECONDARY_ACCOUNT: WalletAccount = {
    id: 'secondary-1',
    custody: { kind: 'watch' },
    chains: { algorand: { address: HD_TEST_ADDRESS } },
    name: 'Hardware backup',
}

describe('Flow: Receive funds', () => {
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useReceiveFundsStore.getState().reset()
        vi.mocked(Clipboard.setStringAsync).mockClear()
    })

    afterEach(() => {
        useReceiveFundsStore.getState().reset()
    })

    it('Given a selected account, when the QR view mounts, then the account address and copy/share controls render', () => {
        useAccountsStore.getState().setAccounts([PRIMARY_ACCOUNT])
        useReceiveFundsStore.getState().setSelectedAccount(PRIMARY_ACCOUNT)
        useReceiveFundsStore.getState().setCanSelectAccount(false)

        renderWithNavigation(QRViewScreen, 'QRView')

        // The react-native-qrcode-svg mock keys every QR under the
        // hardcoded 'QRCode' testid; the production `receive_qr_code`
        // testid is on the wrapping component but doesn't reach the DOM
        // through the mock. Assert on the mock's testid plus the payment
        // URI the QR encodes — that's what the user actually scans.
        const qr = screen.getByTestId('QRCode') as HTMLElement
        expect(qr.getAttribute('value')).toBe(
            `algorand://${addressOf(PRIMARY_ACCOUNT)}`,
        )
        expect(screen.getByTestId('receive_copy_address_button')).toBeTruthy()
        expect(screen.getByTestId('receive_share_address_button')).toBeTruthy()
        expectFlowEvents(analytics, 'receive', 'algorand')
    })

    it('Given the QR view, when the user taps "Copy address", then the address is written to the clipboard', () => {
        useAccountsStore.getState().setAccounts([PRIMARY_ACCOUNT])
        useReceiveFundsStore.getState().setSelectedAccount(PRIMARY_ACCOUNT)

        renderWithNavigation(QRViewScreen, 'QRView')

        fireEvent.click(screen.getByTestId('receive_copy_address_button'))

        expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
            addressOf(PRIMARY_ACCOUNT),
        )
    })

    it('Given two accounts, when the user picks the second from the selection screen, then the receive store is updated and the QR view shows that account', async () => {
        useAccountsStore
            .getState()
            .setAccounts([PRIMARY_ACCOUNT, SECONDARY_ACCOUNT])
        useReceiveFundsStore.getState().setCanSelectAccount(true)

        renderWithNavigation(AccountSelectionScreen, 'AccountSelection', {
            additionalScreens: [{ name: 'QRView', component: QRViewScreen }],
        })

        fireEvent.click(
            screen.getByTestId(
                `receive_account_row-${addressOf(SECONDARY_ACCOUNT)}`,
            ),
        )

        // Navigation pushes the QR screen for the picked account; the
        // react-native-qrcode-svg mock renders under the hardcoded testid.
        await waitFor(() => screen.getByTestId('QRCode'))
        const { selectedAccount } = useReceiveFundsStore.getState()
        expect(selectedAccount ? addressOf(selectedAccount) : undefined).toBe(
            addressOf(SECONDARY_ACCOUNT),
        )
        const qr = screen.getByTestId('QRCode') as HTMLElement
        expect(qr.getAttribute('value')).toContain(addressOf(SECONDARY_ACCOUNT))
    })
})
