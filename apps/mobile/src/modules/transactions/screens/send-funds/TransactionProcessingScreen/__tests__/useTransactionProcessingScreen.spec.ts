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

import { act, renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    registerAlgorandAccountsAdapter,
    seedAuthority,
} from '@test-utils/algorandAccountsAdapter'
import { useTransactionProcessingScreen } from '../useTransactionProcessingScreen'
import {
    UserRejectedSigningError,
    signingEventBus,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import {
    useAccountChainStateStore,
    useAllAccounts,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { BackHandler } from 'react-native'
import { AnalyticsMetadataKey, TransactionsEvent } from '@analytics'

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@react-navigation/stack', () => ({}))
vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    ledgerAppNameFor: (chainId: string) =>
        chainId === 'ethereum' ? 'Ethereum' : 'Algorand',
}))

const {
    mockExecute,
    mockOnFinished,
    mockRegisterTabResume,
    mockClearTabResume,
    mockCompleteTabResume,
    mockTrackEvent,
    sendFundsState,
    sendScope,
} = vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockOnFinished: vi.fn(),
    mockRegisterTabResume: vi.fn(),
    mockClearTabResume: vi.fn(),
    mockCompleteTabResume: vi.fn(),
    mockTrackEvent: vi.fn(),
    sendFundsState: {
        selectedAssetId: '0' as string | undefined,
        amount: undefined as unknown,
        destination: 'dest-address' as string | undefined,
        note: undefined as string | undefined,
        sendMode: 'normal' as string,
        assetInboxQuote: undefined as unknown,
        isCloseAccount: false,
    },
    sendScope: { chainId: 'algorand', networkId: 'mainnet' },
}))

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: mockTrackEvent,
}))

vi.mock('@utils/tabResumeIntent', () => ({
    registerTabResumeIntent: mockRegisterTabResume,
    clearTabResumeIntent: mockClearTabResume,
    completeTabResume: mockCompleteTabResume,
}))

vi.mock('@hooks/useLanguage')

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: () => ({
        execute: mockExecute,
    }),
}))

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useNodeErrorMessage', () => ({
    useNodeErrorMessage: () => ({
        getMessage: (_err: unknown) => ({ title: 'Error', body: 'error body' }),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useSelectedAccount: vi.fn(() => ({
            chains: { algorand: { address: 'test-address' } },
            name: 'Test',
            custody: { kind: 'local', seed: null },
        })),
        useAllAccounts: vi.fn(() => []),
        accountKindIdOf: vi.fn(() => 'standalone'),
        useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
        useAccountAssetBalanceQuery: vi.fn(() => ({ data: null })),
    }
})

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useAssetsQuery: vi.fn(() => ({ data: new Map() })),
    }
})

vi.mock('@modules/transactions/hooks', () => ({
    useSendScope: () => sendScope,
    useSendFunds: () => ({ ...sendFundsState, onFinished: mockOnFinished }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }
})

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

const defaultSender = {
    chains: { algorand: { address: 'test-address' } },
    name: 'Test',
    custody: { kind: 'local', seed: null },
}

const testAsset = { id: '123', name: 'Test Asset' }

const fakeRequest = (id: string = 'req-1') =>
    ({ id, type: 'transactions' }) as never

const proposedResult = (
    overrides: Partial<Extract<TransportResult, { type: 'proposed' }>> = {},
): TransportResult => ({
    type: 'proposed',
    signRequestId: 'sr-1',
    status: 'pending',
    sourceType: 'local',
    ...overrides,
})

const publishProposed = (
    overrides?: Partial<Extract<TransportResult, { type: 'proposed' }>>,
    requestId: string = 'req-1',
) => {
    signingEventBus.publish({
        type: 'transport-result',
        request: fakeRequest(requestId),
        result: proposedResult(overrides),
    })
}

describe('useTransactionProcessingScreen', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        useAccountChainStateStore.getState().resetState()
        vi.clearAllMocks()
        signingEventBus.__resetForTests()
        Object.assign(sendFundsState, {
            selectedAssetId: '0',
            amount: undefined,
            destination: 'dest-address',
            note: undefined,
            sendMode: 'normal',
            assetInboxQuote: undefined,
            isCloseAccount: false,
        })
        Object.assign(sendScope, { chainId: 'algorand', networkId: 'mainnet' })
        vi.mocked(useSelectedAccount).mockReturnValue(defaultSender as never)
        vi.mocked(useAllAccounts).mockReturnValue([])
        vi.mocked(useAssetsQuery).mockReturnValue({ data: new Map() } as never)
        mockExecute.mockResolvedValue('TXID')
    })

    it('registers the send to resume in a tab while it signs, and clears it once settled', async () => {
        sendFundsState.amount = new Decimal('1.25')
        sendFundsState.note = 'rent'
        mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

        renderHook(() => useTransactionProcessingScreen())

        expect(mockRegisterTabResume).toHaveBeenCalledWith({
            flow: 'send',
            accountAddress: 'test-address',
            assetId: '0',
            destination: 'dest-address',
            amount: '1.25',
            note: 'rent',
        })
        await waitFor(() => expect(mockClearTabResume).toHaveBeenCalledOnce())
    })

    it('hands a sent transaction back to the popup with its success copy', async () => {
        mockExecute.mockResolvedValueOnce('TXID')

        renderHook(() => useTransactionProcessingScreen())

        await waitFor(() =>
            expect(mockReplace).toHaveBeenCalledWith('TransactionSuccess', {
                transactionId: 'TXID',
            }),
        )
        expect(mockCompleteTabResume).toHaveBeenCalledWith({
            title: 'send_funds.success.title',
            body: 'send_funds.success.subtitle',
        })
    })

    it('does not offer to resume closing an account', () => {
        sendFundsState.amount = new Decimal('1.25')
        sendFundsState.isCloseAccount = true
        mockExecute.mockReturnValue(new Promise(() => {}))

        renderHook(() => useTransactionProcessingScreen())

        expect(mockRegisterTabResume).not.toHaveBeenCalled()
    })

    it('calls navigation.goBack and does not show an error toast when user cancels the signing overlay', async () => {
        mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

        renderHook(() => useTransactionProcessingScreen())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast and navigates back when execution fails with a non-cancel error', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Network error'))

        renderHook(() => useTransactionProcessingScreen())

        await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
    })

    it('exits the send-funds flow via onFinished when a `proposed` transport-result event is published', () => {
        // execute() never settles for multisig propose; the hook must rely on
        // the signing event bus to know when to leave the screen.
        mockExecute.mockReturnValue(new Promise(() => {}))

        renderHook(() => useTransactionProcessingScreen())

        publishProposed()

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
        expect(mockGoBack).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('does not call onFinished for non-proposed transport results', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))

        renderHook(() => useTransactionProcessingScreen())

        signingEventBus.publish({
            type: 'transport-result',
            request: fakeRequest(),
            result: {
                type: 'submitted',
                txIds: ['tx-1'],
            } as TransportResult,
        })

        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it('only exits once even if multiple propose events arrive', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))

        renderHook(() => useTransactionProcessingScreen())

        publishProposed()
        publishProposed(undefined, 'req-2')
        publishProposed(undefined, 'req-3')

        expect(mockOnFinished).toHaveBeenCalledTimes(1)
    })

    it('does not exit when a prior propose event was published before mount and no replay is requested', () => {
        // Simulates re-entering the send-funds flow with leftover bus state
        // from a prior in-session send.
        mockExecute.mockReturnValue(new Promise(() => {}))
        publishProposed()

        renderHook(() => useTransactionProcessingScreen())

        expect(mockOnFinished).not.toHaveBeenCalled()
    })

    it('derives hardware copy from the auth account for a rekeyed-to-Ledger sender', () => {
        // The device prompt comes from the AUTH account's Ledger — the
        // processing copy must match the machine-driven overlay.
        mockExecute.mockReturnValue(new Promise(() => {}))
        const sender = {
            chains: { algorand: { address: 'SRC' } },
            custody: { kind: 'watch' },
        }
        seedAuthority('SRC', 'LEDGER_AUTH')
        const ledgerAuth = {
            chains: { algorand: { address: 'LEDGER_AUTH' } },
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'dev-1',
                    deviceName: 'Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
        }
        vi.mocked(useSelectedAccount).mockReturnValue(sender as never)
        vi.mocked(useAllAccounts).mockReturnValue([sender, ledgerAuth] as never)

        const { result } = renderHook(() => useTransactionProcessingScreen())

        expect(result.current.isHardwareSender).toBe(true)
        expect(result.current.hardwareDeviceName).toBe('Nano X')
        expect(result.current.ledgerAppName).toBe('Algorand')
    })

    it('keeps non-hardware copy for a plain local-key sender', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))
        const sender = {
            chains: { algorand: { address: 'SRC', keyPairId: 'kp' } },
            custody: { kind: 'local', seed: null },
        }
        vi.mocked(useSelectedAccount).mockReturnValue(sender as never)
        vi.mocked(useAllAccounts).mockReturnValue([sender] as never)

        const { result } = renderHook(() => useTransactionProcessingScreen())

        expect(result.current.isHardwareSender).toBe(false)
        expect(result.current.hardwareDeviceName).toBeNull()
        expect(result.current.ledgerAppName).toBeNull()
    })
    it('passes the send form to the send flow', () => {
        Object.assign(sendFundsState, {
            selectedAssetId: '123',
            amount: new Decimal(5),
            destination: 'DEST_ADDRESS',
            note: 'Test note',
        })
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([['123', testAsset]]),
        } as never)

        renderHook(() => useTransactionProcessingScreen())

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'normal',
                sender: defaultSender,
                receiver: 'DEST_ADDRESS',
                asset: testAsset,
                amount: new Decimal(5),
                note: 'Test note',
                isCloseAccount: false,
                assetInboxQuote: undefined,
            }),
        })
    })

    // The mount-only submit effect is the whole reason this hook uses an empty
    // dependency array — a re-run is a duplicate send.
    it('submits exactly once across re-renders (regression)', async () => {
        const { rerender } = renderHook(() => useTransactionProcessingScreen())
        await act(async () => {
            rerender()
        })

        expect(mockExecute).toHaveBeenCalledTimes(1)
    })

    it('calls execute even when data is missing (delegates validation)', () => {
        vi.mocked(useSelectedAccount).mockReturnValue(null as never)
        Object.assign(sendFundsState, {
            selectedAssetId: undefined,
            destination: undefined,
        })

        renderHook(() => useTransactionProcessingScreen())

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'normal',
                sender: null,
                receiver: undefined,
                asset: undefined,
                amount: undefined,
            }),
        })
    })

    it('carries the inbox quote into an asset inbox send', () => {
        const assetInboxQuote = { opaque: true }
        Object.assign(sendFundsState, {
            sendMode: 'sendAssetInbox',
            assetInboxQuote,
        })

        renderHook(() => useTransactionProcessingScreen())

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                sendMode: 'sendAssetInbox',
                assetInboxQuote,
            }),
        })
    })

    it("reports the sender's account kind with the completed send", async () => {
        Object.assign(sendFundsState, {
            selectedAssetId: '123',
            amount: new Decimal(5),
        })

        renderHook(() => useTransactionProcessingScreen())

        await waitFor(() =>
            expect(mockTrackEvent).toHaveBeenCalledWith(
                TransactionsEvent.Complete,
                {
                    [AnalyticsMetadataKey.AssetId]: '123',
                    [AnalyticsMetadataKey.Amount]: 5,
                    [AnalyticsMetadataKey.TransactionId]: 'TXID',
                    [AnalyticsMetadataKey.AccountType]: 'standalone',
                    [AnalyticsMetadataKey.ChainId]: 'algorand',
                },
            ),
        )
    })

    it('reports a non-Algorand send scope chain with the completed send', async () => {
        sendScope.chainId = 'ethereum'
        vi.mocked(useSelectedAccount).mockReturnValue({
            ...defaultSender,
            chains: { ethereum: { address: '0xTEST' } },
        } as never)

        renderHook(() => useTransactionProcessingScreen())

        await waitFor(() =>
            expect(mockTrackEvent).toHaveBeenCalledWith(
                TransactionsEvent.Complete,
                expect.objectContaining({
                    [AnalyticsMetadataKey.ChainId]: 'ethereum',
                }),
            ),
        )
    })

    it('swallows the hardware back press while sending', () => {
        renderHook(() => useTransactionProcessingScreen())

        expect(BackHandler.addEventListener).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function),
        )
    })
})
