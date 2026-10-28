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
import { fireEvent, screen } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'

import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { ChainSelectionScreen } from '@modules/transactions/screens/receive-funds/ChainSelectionScreen/ChainSelectionScreen'
import { QRViewScreen } from '@modules/transactions/screens/receive-funds/QRViewScreen/QRViewScreen'
import { useReceiveFundsStore } from '@modules/transactions/hooks/receive-funds/useReceiveFunds'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

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

const STORED_ADDRESS = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const CHECKSUMMED_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-watch-1',
    custody: { kind: 'watch' },
    chains: { ethereum: { address: STORED_ADDRESS } },
    name: 'Ethereum watch',
}

const ALGORAND_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'

const MULTI_CHAIN_ACCOUNT: WalletAccount = {
    id: 'multi-watch-1',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: ALGORAND_ADDRESS },
        ethereum: { address: STORED_ADDRESS },
    },
    name: 'Multi-chain watch',
}

describe('Flow: Receive funds on Ethereum', () => {
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    beforeEach(() => {
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        useReceiveFundsStore.getState().reset()
        useReceiveFundsStore.getState().setSelectedAccount(ETHEREUM_ACCOUNT)
        useReceiveFundsStore.getState().setCanSelectAccount(false)
        vi.mocked(Clipboard.setStringAsync).mockClear()
    })

    afterEach(() => {
        useReceiveFundsStore.getState().reset()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given an Ethereum account, when the QR view mounts, then the QR encodes an EIP-681 URI of its checksummed address on mainnet', () => {
        renderWithNavigation(QRViewScreen, 'QRView')

        const qr = screen.getByTestId('QRCode') as HTMLElement
        expect(qr.getAttribute('value')).toBe(
            `ethereum:${CHECKSUMMED_ADDRESS}@1`,
        )
        expect(screen.getByText(CHECKSUMMED_ADDRESS)).toBeTruthy()
        expect(screen.getByTestId('chain_icon_ethereum')).toBeTruthy()
        expect(screen.getByTestId('receive_chain_caption').textContent).toBe(
            'receive_funds.qrview.receive_on',
        )
        expectFlowEvents(analytics, 'receive', 'ethereum')
    })

    it('Given an Ethereum account, when the user taps "Copy address", then the checksummed address is written to the clipboard', () => {
        renderWithNavigation(QRViewScreen, 'QRView')

        fireEvent.click(screen.getByTestId('receive_copy_address_button'))

        expect(vi.mocked(Clipboard.setStringAsync)).toHaveBeenCalledWith(
            CHECKSUMMED_ADDRESS,
        )
    })

    it('Given an account on Algorand and Ethereum, when the user picks Ethereum on Choose Network, then the QR encodes an EIP-681 URI of its checksummed address', () => {
        useAccountsStore.getState().setAccounts([MULTI_CHAIN_ACCOUNT])
        useReceiveFundsStore.getState().setSelectedAccount(MULTI_CHAIN_ACCOUNT)

        renderWithNavigation(ChainSelectionScreen, 'ChainSelection', {
            additionalScreens: [{ name: 'QRView', component: QRViewScreen }],
        })

        expect(
            screen.getByText(
                addressCodecs.get('algorand').truncate(ALGORAND_ADDRESS),
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                addressCodecs.get('ethereum').truncate(STORED_ADDRESS),
            ),
        ).toBeTruthy()
        expect(screen.queryByTestId('receive_chain_add_algorand')).toBeNull()
        expect(screen.queryByTestId('receive_chain_add_ethereum')).toBeNull()

        fireEvent.click(screen.getByTestId('receive_chain_row_ethereum'))

        const qr = screen.getByTestId('QRCode') as HTMLElement
        expect(qr.getAttribute('value')).toBe(
            `ethereum:${CHECKSUMMED_ADDRESS}@1`,
        )
    })
})
