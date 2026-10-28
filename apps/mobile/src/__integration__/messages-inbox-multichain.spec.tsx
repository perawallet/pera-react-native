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
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import { mockInbox } from '@perawallet/wallet-core-messages/test-handlers'
import { PWButton } from '@components/core'
import { BottomSheetIdContext } from '@modules/bottom-sheet'
import { InboxInfoContent } from '@modules/messages/components/InboxInfoContent'
import { InboxScreen } from '@modules/messages/screens/InboxScreen/InboxScreen'
import { useMessagesScreen } from '@modules/messages/screens/MessagesScreen/useMessagesScreen'
import { useWebViewStore } from '@modules/webview'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

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

const DEVICE_ID = 'test-device-id'

const SIGNER: WalletAccount = {
    id: 'signer-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'signer-key' },
    },
    name: 'Trading',
}

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-1',
    custody: { kind: 'local', seed: null },
    chains: {
        ethereum: {
            address: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
            keyPairId: 'eth-key',
        },
    },
    name: 'Eth main',
}

const ASA_INBOX = {
    joint_account_import_requests: [],
    joint_account_sign_requests: [],
    asa_inboxes: [
        { address: HD_TEST_ADDRESS, inbox_address: null, request_count: 2 },
    ],
}

// The ⓘ lives in the stack header, which the integration navigator drops
// (setOptions is a no-op). This host runs the real useMessagesScreen and
// surfaces the same openInboxInfo through a body button, so the sheet opens
// through the real bottom-sheet manager.
const MessagesInfoHost = () => {
    const { activeTab, openInboxInfo } = useMessagesScreen()

    return activeTab === 'Inbox' ? (
        <PWButton
            title='info'
            variant='secondary'
            onPress={openInboxInfo}
            testID='messages_info_host_button'
        />
    ) : null
}

const InboxInfoSheet = () => (
    <BottomSheetIdContext.Provider value='inbox-info'>
        <InboxInfoContent />
    </BottomSheetIdContext.Provider>
)

describe('Flow: Messages — inbox across chains', () => {
    // Unmount before MSW resets so the inbox poll doesn't outlive its handler.
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        resetTestKeystore()
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('live', DEVICE_ID)
        useDeviceStore.getState().setDeviceID('developer', DEVICE_ID)
        useWebViewStore.getState().clearWebViews()
        server.use(mockInbox({ deviceID: DEVICE_ID, response: ASA_INBOX }))
    })

    it('Given a wallet on Algorand and Ethereum, when the inbox lists an ASA request, then the row carries the Algorand badge', async () => {
        useAccountsStore.getState().setAccounts([SIGNER, ETHEREUM_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(SIGNER.id)

        renderWithNavigation(InboxScreen, 'Inbox')

        const row = await screen.findByTestId('asa_inbox_item')
        expect(row.textContent).toContain('Algorand')
    })

    it('Given an Algorand-only wallet, when the inbox lists an ASA request, then the row carries no chain badge', async () => {
        useAccountsStore.getState().setAccounts([SIGNER])
        useAccountsStore.getState().setSelectedAccountId(SIGNER.id)

        renderWithNavigation(InboxScreen, 'Inbox')

        const row = await screen.findByTestId('asa_inbox_item')
        expect(row.textContent).not.toContain('Algorand')
    })

    it('Given the inbox explainer, when it opens, then it covers Algorand and EVM networks and links to the help article', async () => {
        useAccountsStore.getState().setAccounts([SIGNER])

        renderWithNavigation(InboxInfoSheet, 'InboxInfo')

        await waitFor(() => {
            expect(
                screen.getByText('messages.inbox.info.algorand_title'),
            ).toBeTruthy()
        })
        expect(screen.getByText('messages.inbox.info.evm_title')).toBeTruthy()

        fireEvent.click(screen.getByTestId('inbox_info_learn_more'))

        expect(useWebViewStore.getState().openWebViews).toEqual([
            expect.objectContaining({ url: config.assetInboxSupportUrl }),
        ])
    })

    it('Given the Messages screen on its Inbox tab, when the info action fires, then the inbox explainer opens as a sheet', async () => {
        useAccountsStore.getState().setAccounts([SIGNER])
        useAccountsStore.getState().setSelectedAccountId(SIGNER.id)

        renderWithNavigation(MessagesInfoHost, 'MessagesHome', {
            initialParams: { initialTab: 'Inbox' },
        })

        fireEvent.click(await screen.findByTestId('messages_info_host_button'))

        expect(await screen.findByTestId('inbox_info_content')).toBeTruthy()
    })
})
