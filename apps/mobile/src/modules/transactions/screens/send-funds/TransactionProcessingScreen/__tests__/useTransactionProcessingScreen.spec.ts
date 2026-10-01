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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useTransactionProcessingScreen } from '../useTransactionProcessingScreen'
import {
    UserRejectedSigningError,
    signingEventBus,
    type TransportResult,
} from '@perawallet/wallet-core-signing'
import {
    useAllAccounts,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@react-navigation/stack', () => ({}))

const {
    mockExecute,
    mockOnFinished,
    mockRegisterTabResume,
    mockClearTabResume,
    mockCompleteTabResume,
    sendFundsState,
} = vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockOnFinished: vi.fn(),
    mockRegisterTabResume: vi.fn(),
    mockClearTabResume: vi.fn(),
    mockCompleteTabResume: vi.fn(),
    sendFundsState: {
        amount: undefined as unknown,
        note: undefined as string | undefined,
        isCloseAccount: false,
    },
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

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
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
            address: 'test-address',
            name: 'Test',
        })),
        useAllAccounts: vi.fn(() => []),
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
    useSendFunds: () => ({
        selectedAssetId: '0',
        amount: sendFundsState.amount,
        destination: 'dest-address',
        note: sendFundsState.note,
        sendMode: 'normal' as const,
        arc59Summary: undefined,
        isCloseAccount: sendFundsState.isCloseAccount,
        onFinished: mockOnFinished,
    }),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: { error: vi.fn() },
    }
})

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

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
        vi.clearAllMocks()
        signingEventBus.__resetForTests()
        sendFundsState.amount = undefined
        sendFundsState.note = undefined
        sendFundsState.isCloseAccount = false
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
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(mockClearTabResume).toHaveBeenCalledOnce()
    })

    it('hands a sent transaction back to the popup with its success copy', async () => {
        mockExecute.mockResolvedValueOnce('TXID')

        renderHook(() => useTransactionProcessingScreen())
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockReplace).toHaveBeenCalledWith('TransactionSuccess', {
            transactionId: 'TXID',
        })
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

        // Allow microtasks to flush
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockGoBack).toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast and navigates back when execution fails with a non-cancel error', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Network error'))

        renderHook(() => useTransactionProcessingScreen())

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockGoBack).toHaveBeenCalled()
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
            address: 'SRC',
            type: 'watch',
            rekeyAddress: 'LEDGER_AUTH',
        }
        const ledgerAuth = {
            address: 'LEDGER_AUTH',
            type: 'hardware',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'dev-1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        }
        vi.mocked(useSelectedAccount).mockReturnValue(sender as never)
        vi.mocked(useAllAccounts).mockReturnValue([sender, ledgerAuth] as never)

        const { result } = renderHook(() => useTransactionProcessingScreen())

        expect(result.current.isHardwareSender).toBe(true)
        expect(result.current.hardwareDeviceName).toBe('Nano X')
    })

    it('keeps non-hardware copy for a plain local-key sender', () => {
        mockExecute.mockReturnValue(new Promise(() => {}))
        const sender = { address: 'SRC', type: 'algo25', keyPairId: 'kp' }
        vi.mocked(useSelectedAccount).mockReturnValue(sender as never)
        vi.mocked(useAllAccounts).mockReturnValue([sender] as never)

        const { result } = renderHook(() => useTransactionProcessingScreen())

        expect(result.current.isHardwareSender).toBe(false)
        expect(result.current.hardwareDeviceName).toBeNull()
    })
})
