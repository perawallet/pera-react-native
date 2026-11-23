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
import {
    act,
    cleanup,
    fireEvent,
    screen,
    waitFor,
} from '@testing-library/react'
import { StackActions } from '@react-navigation/native'
import { Notifier } from 'react-native-notifier'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
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
            chains: {
                enabled: ['algorand', 'ethereum', 'base'],
                capabilities: {},
            },
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
        base: { address: ETHEREUM_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Eth',
} as WalletAccount

const assetDetailUrl = (chain: string, assetId?: string): string =>
    `perawallet://app/asset-detail/?chain=${encodeURIComponent(chain)}&address=${ETHEREUM_ADDRESS_LOWER}` +
    (assetId ? `&assetId=${assetId}` : '')

const RECEIVED_HASH = `0x${'ab'.repeat(32)}`
const SENT_HASH = `0x${'cd'.repeat(32)}`
const FAILED_HASH = `0x${'ef'.repeat(32)}`
const withTransactionId = (url: string, transactionId: string): string =>
    `${url}&transactionId=${transactionId}`

const RECEIVED_URL = assetDetailUrl('eip155:1')
const SENT_URL = assetDetailUrl('eip155:1', TOKEN.toLowerCase())
const FAILED_URL = assetDetailUrl('eip155:1')
const SEPOLIA_URL = assetDetailUrl('eip155:11155111')
const BASE_SENT_URL = assetDetailUrl('eip155:8453', TOKEN.toLowerCase())
const RECEIVED_TX_URL = withTransactionId(RECEIVED_URL, RECEIVED_HASH)
const SENT_TX_URL = withTransactionId(BASE_SENT_URL, SENT_HASH)
const FAILED_TX_URL = withTransactionId(FAILED_URL, FAILED_HASH)
const SEPOLIA_TX_URL = withTransactionId(SEPOLIA_URL, RECEIVED_HASH)
// Algorand's own notification URL, which the legacy parser reads.
const ALGORAND_LEGACY_URL = `perawallet://asset/transactions?account=${ALGO25_TEST_ADDRESS}&asset=31566704&transactionId=ALGOTXID`

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
    evmRow(
        '304',
        'evm-transfer-sent',
        'Transaction successful: 10 USDC to 0x1234…5678 on Base',
        BASE_SENT_URL,
    ),
    evmRow(
        '305',
        'evm-transfer-received',
        '1 ETH received from 0xabcd…ef01',
        RECEIVED_TX_URL,
    ),
    evmRow(
        '306',
        'evm-transfer-sent',
        'Transaction successful: 5 USDC to 0xabcd…ef01 on Base',
        SENT_TX_URL,
    ),
    evmRow(
        '307',
        'evm-transfer-failed',
        'Transaction failed: 2 ETH to 0xabcd…ef01',
        FAILED_TX_URL,
    ),
]

const assetDetailsRoute = (assetId: string, chainId = 'ethereum') => ({
    screen: 'Home',
    params: {
        screen: 'AssetDetails',
        params: { assetId, chainId },
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

const tapPush = (url: string, onError?: () => void) =>
    act(async () => {
        await captured.handleDeepLink!(url, false, 'notification', onError)
    })

describe('Flow: Ethereum transfer notifications', () => {
    // Unmount before MSW resets, so the list's polls don't outlive their handlers.
    afterEach(() => {
        cleanup()
        captured.handleDeepLink = undefined
        captured.parseDeeplink = undefined
        vi.restoreAllMocks()
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

    describe('Given the notifications list holds received, sent and failed transfers', () => {
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

        it.each([
            { id: '305', chainId: 'ethereum', transactionId: RECEIVED_HASH },
            { id: '306', chainId: 'base', transactionId: SENT_HASH },
            { id: '307', chainId: 'ethereum', transactionId: FAILED_HASH },
        ])(
            'When row $id is pressed, then its transaction opens on $chainId',
            async ({ id, chainId, transactionId }) => {
                const dispatch = vi
                    .spyOn(navigationRef, 'dispatch')
                    .mockImplementation(() => undefined)
                renderWithNavigation(NotificationsScreen, 'Notifications')

                fireEvent.click(
                    await screen.findByTestId(`notification_row_${id}`),
                )

                await waitFor(() =>
                    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
                        StackActions.replace('TransactionDetails', {
                            scope: { chainId, networkId: 'mainnet' },
                            transactionId,
                            accountAddress: ETHEREUM_ADDRESS,
                        }),
                    ),
                )
                expect(useAccountsStore.getState().selectedAccountId).toBe(
                    ETHEREUM_ACCOUNT.id,
                )
            },
        )

        // Base has no deeplink adapter of its own; Ethereum's serves its links.
        it("When a sent row on another EVM chain is pressed, then that chain's token screen opens", async () => {
            const dispatch = vi
                .spyOn(navigationRef, 'dispatch')
                .mockImplementation(() => undefined)
            renderWithNavigation(NotificationsScreen, 'Notifications')

            fireEvent.click(await screen.findByTestId('notification_row_304'))

            await waitFor(() =>
                expect(dispatch).toHaveBeenCalledWith(
                    StackActions.replace(
                        'TabBar',
                        assetDetailsRoute(TOKEN, 'base'),
                    ),
                ),
            )
        })
    })

    describe('Given transfer rows carry a counterparty address', () => {
        // Hardhat accounts #1 and #2; the backend sends addresses lowercase.
        const SAVINGS_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        const ALICE_ADDRESS = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
        const UNKNOWN_ADDRESS = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
        const LOOK_ALIKE_ADDRESS = `0x7099${'0'.repeat(32)}79c8`

        const SAVINGS_ACCOUNT: WalletAccount = {
            id: 'savings-account',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 1, keyIndex: 0 },
            },
            chains: {
                ethereum: { address: SAVINGS_ADDRESS, keyPairId: 'sav-key' },
                base: { address: SAVINGS_ADDRESS, keyPairId: 'sav-key' },
            },
            name: 'Savings',
        } as WalletAccount

        const counterpartyRow = (
            id: string,
            type: string,
            message: string,
            counterpartyAddress: Optional<string>,
        ) => ({
            ...evmRow(id, type, message, RECEIVED_URL),
            counterparty_address: counterpartyAddress?.toLowerCase(),
        })

        beforeEach(() => {
            useAccountsStore
                .getState()
                .setAccounts([
                    ALGORAND_ACCOUNT,
                    ETHEREUM_ACCOUNT,
                    SAVINGS_ACCOUNT,
                ])
            useContactsStore.getState().resetState()
            useContactsStore.getState().addContact({
                name: 'Alice',
                addresses: { evm: ALICE_ADDRESS },
            })
            server.use(
                mockNotificationList({
                    deviceID: DEVICE_ID,
                    response: {
                        next: null,
                        previous: null,
                        results: [
                            counterpartyRow(
                                '401',
                                'evm-transfer-received',
                                '2 ETH received from 0x7099…79c8 on Ethereum',
                                SAVINGS_ADDRESS,
                            ),
                            counterpartyRow(
                                '402',
                                'evm-transfer-sent',
                                'Transaction successful: 5 USDC to 0x3c44…93bc on Ethereum',
                                ALICE_ADDRESS,
                            ),
                            counterpartyRow(
                                '403',
                                'evm-transfer-received',
                                '3 ETH received from 0x90f7…b906 on Ethereum',
                                UNKNOWN_ADDRESS,
                            ),
                            counterpartyRow(
                                '404',
                                'evm-transfer-received',
                                '4 ETH received from 0x7099…79c8 on Ethereum',
                                LOOK_ALIKE_ADDRESS,
                            ),
                            counterpartyRow(
                                '405',
                                'evm-transfer-received',
                                '5 ETH received from 0x7099…79c8 on Ethereum',
                                undefined,
                            ),
                            {
                                ...evmRow(
                                    '406',
                                    'transaction-received',
                                    '6 ALGO received from 0x7099…79c8',
                                    ALGORAND_LEGACY_URL,
                                ),
                                counterparty_address:
                                    ALGO25_TEST_ADDRESS.toLowerCase(),
                            },
                        ],
                    },
                }),
            )
        })

        it('When the counterparty is one of the accounts, then the account name replaces the address', async () => {
            renderWithNavigation(NotificationsScreen, 'Notifications')

            expect(
                await screen.findByText(
                    '2 ETH received from Savings on Ethereum',
                ),
            ).toBeTruthy()
        })

        it('When the counterparty is a contact, then the contact name replaces the address', async () => {
            renderWithNavigation(NotificationsScreen, 'Notifications')

            expect(
                await screen.findByText(
                    'Transaction successful: 5 USDC to Alice on Ethereum',
                ),
            ).toBeTruthy()
        })

        it.each([
            [
                'an unknown counterparty',
                '3 ETH received from 0x90f7…b906 on Ethereum',
            ],
            [
                'a look-alike of an own account',
                '4 ETH received from 0x7099…79c8 on Ethereum',
            ],
            [
                'a row with no counterparty address',
                '5 ETH received from 0x7099…79c8 on Ethereum',
            ],
            ['an Algorand row', '6 ALGO received from 0x7099…79c8'],
        ])(
            'When the row is %s, then the backend text stays',
            async (_case, message) => {
                renderWithNavigation(NotificationsScreen, 'Notifications')

                expect(await screen.findByText(message)).toBeTruthy()
            },
        )
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

            await tapPush(RECEIVED_URL, onError)

            expect(navigate).toHaveBeenCalledWith(
                'TabBar',
                assetDetailsRoute('native'),
            )
            expect(onError).not.toHaveBeenCalled()
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                ETHEREUM_ACCOUNT.id,
            )
        })

        it('When its link carries a transaction hash, then that transaction is pushed on top of the open screen', async () => {
            const navigate = vi
                .spyOn(navigationRef, 'navigate')
                .mockImplementation(() => undefined)
            const dispatch = vi
                .spyOn(navigationRef, 'dispatch')
                .mockImplementation(() => undefined)
            const onError = vi.fn()

            await tapPush(RECEIVED_TX_URL, onError)

            expect(dispatch).toHaveBeenCalledWith(
                StackActions.push('TransactionDetails', {
                    scope: { chainId: 'ethereum', networkId: 'mainnet' },
                    transactionId: RECEIVED_HASH,
                    accountAddress: ETHEREUM_ADDRESS,
                }),
            )
            expect(navigate).not.toHaveBeenCalled()
            expect(onError).not.toHaveBeenCalled()
        })

        it("When it is Algorand's legacy transaction link, then the asset screen opens as before", async () => {
            const navigate = vi
                .spyOn(navigationRef, 'navigate')
                .mockImplementation(() => undefined)

            await tapPush(ALGORAND_LEGACY_URL)

            expect(navigate).toHaveBeenCalledWith(
                'TabBar',
                assetDetailsRoute('31566704', 'algorand'),
            )
            expect(navigate).not.toHaveBeenCalledWith(
                'TransactionDetails',
                expect.anything(),
            )
        })

        it.each([
            { url: SEPOLIA_URL, type: 'ASSET_DETAIL' },
            { url: SEPOLIA_TX_URL, type: 'TRANSACTION_DETAIL' },
        ])(
            'When a $type link names another network, then it is refused without opening anything',
            async ({ url, type }) => {
                const navigate = vi
                    .spyOn(navigationRef, 'navigate')
                    .mockImplementation(() => undefined)
                const dispatch = vi
                    .spyOn(navigationRef, 'dispatch')
                    .mockImplementation(() => undefined)
                const onError = vi.fn()
                expect(captured.parseDeeplink!(url)).toMatchObject({
                    type,
                    target: { chainId: 'ethereum', networkId: 'sepolia' },
                })

                await tapPush(url, onError)

                expect(onError).toHaveBeenCalledTimes(1)
                expect(navigate).not.toHaveBeenCalled()
                expect(dispatch).not.toHaveBeenCalled()
                expect(Notifier.showNotification).not.toHaveBeenCalled()
                expect(useAccountsStore.getState().selectedAccountId).toBe(
                    ALGORAND_ACCOUNT.id,
                )
            },
        )
    })
})
