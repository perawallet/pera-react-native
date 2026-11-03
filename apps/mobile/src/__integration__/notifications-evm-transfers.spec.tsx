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

// Ethereum transfer notifications carry no account and a server-rendered
// message; their tap target is a chain-scoped asset-detail link.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { StackActions } from '@react-navigation/native'
import { Notifier } from 'react-native-notifier'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    mockInbox,
    mockMessageStatus,
    mockNotificationList,
} from '@perawallet/wallet-core-messages/test-handlers'
import type { Optional } from '@perawallet/wallet-core-shared'
import { server } from '@test-utils/msw-server'
import { render } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { ConnectionsProvider } from '@modules/connections/shell'
import { useDeepLink } from '@modules/deeplink/hooks/useDeepLink'
import { NotificationsScreen } from '@modules/messages/screens/NotificationsScreen/NotificationsScreen'
import { navigationRef } from '@routes/navigationRef'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

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

// Hardhat account #0; the backend sends EVM addresses lowercase.
const ETHEREUM_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const ETHEREUM_ADDRESS_LOWER = ETHEREUM_ADDRESS.toLowerCase()
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const ALGORAND_ACCOUNT: WalletAccount = {
    id: 'algo-signer',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Algo',
}

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'eth-account',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        ethereum: { address: ETHEREUM_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Eth',
} as WalletAccount

const assetDetailUrl = (chain: string, assetId?: string): string =>
    `perawallet://app/asset-detail/?chain=${encodeURIComponent(chain)}&address=${ETHEREUM_ADDRESS_LOWER}` +
    (assetId ? `&assetId=${assetId}` : '')

const RECEIVED_URL = assetDetailUrl('eip155:1')
const SENT_URL = assetDetailUrl('eip155:1', TOKEN.toLowerCase())
const FAILED_URL = assetDetailUrl('eip155:1')
const SEPOLIA_URL = assetDetailUrl('eip155:11155111')

const evmRow = (
    id: string,
    type: string,
    message: string,
    url: string,
    icon: { logo: string; shape: 'circle' | 'rectangle' } | null = null,
) => ({
    id,
    type,
    account_address: null,
    message,
    url,
    creation_datetime: '2026-11-02T12:00:00Z',
    is_unread: false,
    icon,
})

const EVM_ROWS = [
    evmRow(
        '301',
        'evm-transfer-received',
        '0.5 ETH received from 0x1234…5678',
        RECEIVED_URL,
    ),
    evmRow(
        '302',
        'evm-transfer-sent',
        'Transaction successful: 250 USDC to 0x1234…5678',
        SENT_URL,
        { logo: 'https://example.com/usdc.png', shape: 'circle' },
    ),
    evmRow(
        '303',
        'evm-transfer-failed',
        'Transaction failed: 0.5 ETH to 0x1234…5678',
        FAILED_URL,
    ),
]

const assetDetailsRoute = (assetId: string) => ({
    screen: 'Home',
    params: {
        screen: 'AssetDetails',
        params: { assetId, chainId: 'ethereum' },
    },
})

type UseDeepLink = ReturnType<typeof useDeepLink>
const captured: {
    handleDeepLink: Optional<UseDeepLink['handleDeepLink']>
    parseDeeplink: Optional<UseDeepLink['parseDeeplink']>
} = {
    handleDeepLink: undefined,
    parseDeeplink: undefined,
}
const DeepLinkProbe = () => {
    const { handleDeepLink, parseDeeplink } = useDeepLink()
    captured.handleDeepLink = handleDeepLink
    captured.parseDeeplink = parseDeeplink
    return null
}

describe('Flow: Ethereum transfer notifications', () => {
    // Unmount before MSW resets, so the list's polls don't outlive their handlers.
    afterEach(() => {
        cleanup()
    })

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore
            .getState()
            .setAccounts([ALGORAND_ACCOUNT, ETHEREUM_ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ALGORAND_ACCOUNT.id)
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('live', DEVICE_ID)
        useDeviceStore.getState().setDeviceID('developer', DEVICE_ID)
        vi.mocked(Notifier.showNotification).mockClear()
        server.use(
            mockMessageStatus({
                deviceID: DEVICE_ID,
                response: {
                    hasUnreadItems: false,
                    hasUnreadNotifications: false,
                    hasUnreadInboxItems: false,
                    unreadInboxCount: 0,
                },
            }),
            mockInbox({
                deviceID: DEVICE_ID,
                response: {
                    joint_account_import_requests: [],
                    joint_account_sign_requests: [],
                    asa_inboxes: [],
                },
            }),
            mockNotificationList({
                deviceID: DEVICE_ID,
                response: { next: null, previous: null, results: EVM_ROWS },
            }),
        )
        vi.spyOn(navigationRef, 'isReady').mockReturnValue(true)
    })

    describe('Given the notifications list holds a received, a sent and a failed transfer', () => {
        it('When NotificationsScreen mounts, then all three messages render', async () => {
            renderWithNavigation(NotificationsScreen, 'Notifications')

            await waitFor(() => {
                expect(
                    screen.getByText('0.5 ETH received from 0x1234…5678'),
                ).toBeTruthy()
            })
            expect(
                screen.getByText(
                    'Transaction successful: 250 USDC to 0x1234…5678',
                ),
            ).toBeTruthy()
            expect(
                screen.getByText('Transaction failed: 0.5 ETH to 0x1234…5678'),
            ).toBeTruthy()
        })

        it('When the received row is pressed, then the Ethereum account is selected and its ETH screen opens', async () => {
            const dispatch = vi
                .spyOn(navigationRef, 'dispatch')
                .mockImplementation(() => undefined)
            renderWithNavigation(NotificationsScreen, 'Notifications')

            fireEvent.click(await screen.findByTestId('notification_row_301'))

            await waitFor(() =>
                expect(dispatch).toHaveBeenCalledWith(
                    StackActions.replace('TabBar', assetDetailsRoute('native')),
                ),
            )
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                ETHEREUM_ACCOUNT.id,
            )
        })

        it('When the sent row is pressed, then the token screen opens', async () => {
            const dispatch = vi
                .spyOn(navigationRef, 'dispatch')
                .mockImplementation(() => undefined)
            renderWithNavigation(NotificationsScreen, 'Notifications')

            fireEvent.click(await screen.findByTestId('notification_row_302'))

            await waitFor(() =>
                expect(dispatch).toHaveBeenCalledWith(
                    StackActions.replace('TabBar', assetDetailsRoute(TOKEN)),
                ),
            )
        })
    })

    describe('Given a push for a transfer is tapped', () => {
        beforeEach(async () => {
            render(
                <ConnectionsProvider>
                    <DeepLinkProbe />
                </ConnectionsProvider>,
            )
            await waitFor(() => expect(captured.handleDeepLink).toBeTruthy())
        })

        it('When its link names the selected network, then the ETH screen opens', async () => {
            const navigate = vi
                .spyOn(navigationRef, 'navigate')
                .mockImplementation(() => undefined)
            const onError = vi.fn()

            await captured.handleDeepLink!(
                RECEIVED_URL,
                false,
                'notification',
                onError,
            )

            expect(navigate).toHaveBeenCalledWith(
                'TabBar',
                assetDetailsRoute('native'),
            )
            expect(onError).not.toHaveBeenCalled()
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                ETHEREUM_ACCOUNT.id,
            )
        })

        // A notification refusal is silent; the push listener's onError lands Home.
        it('When its link names another network, then it is refused without opening anything', async () => {
            const navigate = vi
                .spyOn(navigationRef, 'navigate')
                .mockImplementation(() => undefined)
            const onError = vi.fn()
            expect(captured.parseDeeplink!(SEPOLIA_URL)).toMatchObject({
                type: 'ASSET_DETAIL',
                target: { chainId: 'ethereum', networkId: 'sepolia' },
            })

            await captured.handleDeepLink!(
                SEPOLIA_URL,
                false,
                'notification',
                onError,
            )

            expect(onError).toHaveBeenCalledTimes(1)
            expect(navigate).not.toHaveBeenCalled()
            expect(Notifier.showNotification).not.toHaveBeenCalled()
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                ALGORAND_ACCOUNT.id,
            )
        })
    })
})
