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
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeepLink } from '../useDeepLink'
import {
    useDeeplinkListener,
    resetDeeplinkListenerStateForTesting,
} from '../useDeeplinkListener'
import { StackActions } from '@react-navigation/native'
import { parseDeeplink } from '../deeplink/parser'
import { DeeplinkType } from '../deeplink/types'
import { Linking } from 'react-native'
import {
    useImportAccount,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'

const { mockNavigate, mockDispatch } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockDispatch: vi.fn(),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: {
        navigate: mockNavigate,
        dispatch: mockDispatch,
        isReady: vi.fn(() => true),
    },
}))

vi.mock('@react-navigation/native', () => ({
    createNavigationContainerRef: () => ({
        navigate: vi.fn(),
        dispatch: vi.fn(),
        reset: vi.fn(),
        goBack: vi.fn(),
        isReady: vi.fn(() => true),
        current: null,
    }),
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
    },
}))

vi.mock('../deeplink/parser', () => ({
    parseDeeplink: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    ALGO_ASSET_ID: '0',
    isAlgoAssetId: (assetId: string | number | bigint) =>
        String(assetId) === '0',
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    generateOrderedUniqueId: vi.fn(() => 'test-id'),
    decodeFromBase64: vi.fn((b64: string) =>
        Uint8Array.from(Buffer.from(b64, 'base64')),
    ),
}))

// useDeepLink reads the device's biometric level to gate passkey deeplinks.
// Stub the package so the real security store (with its module-load
// registerStore call) isn't pulled into this unit test's import graph.
vi.mock('@perawallet/wallet-core-security', () => ({
    getBiometricSecurityLevel: vi.fn(async () => 'strong'),
    hasStrongBiometricOrCredential: vi.fn(() => true),
}))

const { mockAddSignRequest } = vi.hoisted(() => ({
    mockAddSignRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    UserRejectedSigningError: class UserRejectedSigningError extends Error {},
    // Non-quantum sender in every fixture here — the calculator's real fast
    // path is a passthrough no-op. Real fee behavior is covered by
    // packages/signing/src/hooks/__tests__/useMinimumFeeCalculator.spec.ts
    // and apps/mobile/src/hooks/deeplink/handlers/__tests__/useKeyregDeeplink.test.ts.
    useMinimumFeeCalculator: () => ({
        assignFeeToGroup: async ({
            transactions,
        }: {
            transactions: unknown[]
        }) => ({ transactions, adjustments: [] }),
    }),
}))

// The asset-opt-in deeplink handler pulls in useAssetOptInMutation; mock it so
// the real transactions package (whose api/history schema imports from the
// mocked shared package) isn't loaded into this unit test's import graph.
vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({ optIn: vi.fn() }),
}))

const { mockOnlineKeyRegistration, mockOfflineKeyRegistration } = vi.hoisted(
    () => ({
        mockOnlineKeyRegistration: vi.fn(async () => ({
            type: 'keyreg',
            mock: 'tx',
        })),
        mockOfflineKeyRegistration: vi.fn(async () => ({
            type: 'keyreg-offline',
            mock: 'tx',
        })),
    }),
)

// Re-mocks only what useDeepLink consumes. Keeps `microAlgosToAlgos` /
// `isValidAlgorandAddress` / `useNetwork` consistent with the global
// vitest.setup.ts contract while overlaying useAlgorandClient with keyreg
// builder mocks the keyreg deeplink test asserts against.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (address: string) => {
        if (!address) return false
        return /^[0-9a-zA-Z]{58}$/.test(address)
    },
    microAlgosToAlgos: (microAlgos: bigint | number | string) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Decimal } = require('decimal.js')
        return new Decimal(microAlgos.toString()).dividedBy(1_000_000)
    },
    useNetwork: () => ({ network: 'mainnet' }),
    useAlgorandClient: () => ({
        createTransaction: {
            onlineKeyRegistration: mockOnlineKeyRegistration,
            offlineKeyRegistration: mockOfflineKeyRegistration,
        },
    }),
    // Identity encode/decode pair for the keyreg shape-normalization
    // step. Real impl encodes to msgpack bytes then decodes back to a
    // string-sender txn; the tests don't care about byte representation.
    useTransactionEncoder: () => ({
        encodeTransaction: (tx: unknown) => tx,
        decodeTransaction: (tx: unknown) => tx,
    }),
}))

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'addr1' }),
    useSelectedAccountAddress: () => ({ setSelectedAccountAddress: vi.fn() }),
    useAllAccounts: () => [
        { address: 'A'.repeat(58), id: 'mock', type: 'algo25' },
    ],
    resolveAuthAccount: (account: unknown) => account,
    resolveImportAccountType: (mnemonic: string) => {
        const wordCount = mnemonic.trim().split(/\s+/).length
        if (wordCount === 24) return { success: true, accountType: 'hdWallet' }
        if (wordCount === 25) return { success: true, accountType: 'algo25' }
        return { success: false, wordCount }
    },
    useImportAccount: vi.fn(),
    // The recover-address handler stashes the scanned mnemonic here before
    // navigating to the pre-filled Import screen (kept out of route params).
    setPendingImportMnemonic: vi.fn(),
    DuplicateAccountError: class DuplicateAccountError extends Error {},
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: vi.fn(),
    // parser.ts imports these to detect Pera Web "Transfer Accounts" QR
    // payloads — stub so the parser doesn't crash on JSON-shaped URLs.
    PeraWebImportError: class PeraWebImportError extends Error {},
    parsePeraWebQrPayload: vi.fn(() => {
        throw new Error('not a pera web qr')
    }),
}))

// Forward to the real store so the dispatcher's `setQr` lands on the same
// instance the tests below assert against (imported via the deep path).
vi.mock('@modules/onboarding/hooks', async () => {
    const actual = (await vi.importActual(
        '@modules/onboarding/hooks/peraWebImportFlowStore',
    )) as typeof import('@modules/onboarding/hooks/peraWebImportFlowStore')
    return { usePeraWebImportFlowStore: actual.usePeraWebImportFlowStore }
})

const { mockPushWebView } = vi.hoisted(() => ({
    mockPushWebView: vi.fn(),
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

// The pairing outcome wait lives in the walletconnect package (its store
// subscription is covered by the package's own sessionOutcome spec) — the
// deeplink tests only pin which outcome drives which callback.
const { mockWcConnect, mockWaitForSessionOutcome } = vi.hoisted(() => ({
    mockWcConnect: vi.fn(async () => 'pairing-client'),
    mockWaitForSessionOutcome: vi.fn(
        async (): Promise<{ type: string; error?: Error }> => ({
            type: 'session',
        }),
    ),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: mockWcConnect }),
    waitForSessionOutcome: mockWaitForSessionOutcome,
}))

const {
    mockRequestByType,
    mockRequestBottomSheet,
    mockSetDestination,
    mockSetSelectedAssetId,
    mockSetCanSelectAsset,
    mockSetNote,
    mockSetAmount,
    mockSendFundsReset,
    SendFundsContentMock,
} = vi.hoisted(() => ({
    mockRequestByType: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockSetDestination: vi.fn(),
    mockSetSelectedAssetId: vi.fn(),
    mockSetCanSelectAsset: vi.fn(),
    mockSetNote: vi.fn(),
    mockSetAmount: vi.fn(),
    mockSendFundsReset: vi.fn(),
    SendFundsContentMock: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: () => ({
        requestByType: mockRequestByType,
    }),
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: mockRequestByType,
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

const { mockShowSignRequest, mockIsPeraCardEnabled } = vi.hoisted(() => ({
    mockShowSignRequest: vi.fn(),
    mockIsPeraCardEnabled: vi.fn(() => true),
}))

vi.mock('@modules/multisig/hooks/usePendingSignaturesSheet', () => ({
    usePendingSignaturesSheet: () => ({
        showSignRequest: mockShowSignRequest,
    }),
}))

vi.mock('../useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: mockIsPeraCardEnabled,
}))

// Mock SendFundsContent / BidaliContent so the deeplink test doesn't pull in
// their full navigator trees (heavy imports not needed for these assertions).
vi.mock('@modules/transactions/components/send-funds/SendFundsContent', () => ({
    SendFundsContent: SendFundsContentMock,
}))

vi.mock('@modules/gift-card/components/BidaliContent', () => ({
    BidaliContent: vi.fn(),
}))

const { mockSetPendingAmountBaseUnits } = vi.hoisted(() => ({
    mockSetPendingAmountBaseUnits: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFundsStore: {
        getState: () => ({
            reset: mockSendFundsReset,
            setDestination: mockSetDestination,
            setSelectedAssetId: mockSetSelectedAssetId,
            setCanSelectAsset: mockSetCanSelectAsset,
            setNote: mockSetNote,
            setAmount: mockSetAmount,
            setPendingAmountBaseUnits: mockSetPendingAmountBaseUnits,
        }),
    },
}))

const { mockInfoToast, mockErrorToast } = vi.hoisted(() => ({
    mockInfoToast: vi.fn(),
    mockErrorToast: vi.fn(),
}))

vi.mock('../useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
    })),
}))

vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: vi.fn(),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

describe('useDeepLink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // The listener's cold-start guard is module-level (shared across all
        // layout-mounted instances); reset it so one test's initial-URL
        // handling doesn't suppress the next test's.
        resetDeeplinkListenerStateForTesting()
        mockWaitForSessionOutcome.mockResolvedValue({ type: 'session' })
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
    })

    it('should validate deeplink', () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const { result } = renderHook(() => useDeepLink())

        expect(result.current.isValidDeepLink('perawallet://app')).toBe(true)
        expect(parseDeeplink).toHaveBeenCalledWith('perawallet://app')
    })

    it('should handle invalid deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink('invalid', false, 'deeplink')
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle ADD_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact?address=addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'AddContact',
            params: {
                address: 'addr1',
                label: 'Label1',
            },
        })
    })

    it('should handle EDIT_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.EDIT_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/edit-contact?address=addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'EditContact',
            params: {
                address: 'addr1',
                label: 'Label1',
            },
        })
    })

    it('should handle replaceCurrentScreen in navigateToScreen', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact?address=addr1',
                true,
                'deeplink',
            )
        })

        expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
            'Contacts',
            {
                screen: 'AddContact',
                params: {
                    address: 'addr1',
                    label: 'Label1',
                },
            },
        )
        expect(mockDispatch).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('treats a new WalletConnect session_request as success', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        mockWaitForSessionOutcome.mockResolvedValueOnce({ type: 'session' })
        const { result } = renderHook(() => useDeepLink())
        const onError = vi.fn()
        const onSuccess = vi.fn()
        const onConnectionError = vi.fn()

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:123',
                false,
                'qr',
                onError,
                onSuccess,
                onConnectionError,
            )
        })

        expect(mockWcConnect).toHaveBeenCalled()
        // The outcome wait is scoped to the connector this pairing created —
        // an unrelated session's error must never read as this rejection
        // (scoping itself is pinned by the package's sessionOutcome spec).
        expect(mockWaitForSessionOutcome).toHaveBeenCalledWith(
            'pairing-client',
            expect.any(Number),
        )
        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(onConnectionError).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })

    it('keeps the scanner open via onConnectionError when the handshake is rejected (e.g. wrong network)', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        mockWaitForSessionOutcome.mockResolvedValueOnce({
            type: 'error',
            error: Object.assign(new Error('wrong network'), {
                clientId: 'pairing-client',
            }),
        })
        const { result } = renderHook(() => useDeepLink())
        const onError = vi.fn()
        const onSuccess = vi.fn()
        const onConnectionError = vi.fn()

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:123',
                false,
                'qr',
                onError,
                onSuccess,
                onConnectionError,
            )
        })

        // The scanner is told to stay open + re-armed: neither the close
        // path (onError) nor the success/close path (onSuccess) fires, and
        // the misleading "no response" timeout branch is skipped.
        expect(onConnectionError).toHaveBeenCalledTimes(1)
        expect(onError).not.toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('reports a dead bridge via onError when the outcome wait times out', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        mockWaitForSessionOutcome.mockResolvedValueOnce({ type: 'timeout' })
        const { result } = renderHook(() => useDeepLink())
        const onError = vi.fn()
        const onSuccess = vi.fn()
        const onConnectionError = vi.fn()

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:123',
                false,
                'qr',
                onError,
                onSuccess,
                onConnectionError,
            )
        })

        expect(onError).toHaveBeenCalledTimes(1)
        expect(onSuccess).not.toHaveBeenCalled()
        expect(onConnectionError).not.toHaveBeenCalled()
    })

    it('should open send-funds bottom sheet for ALGO_TRANSFER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ALGO_TRANSFER,
            receiverAddress: 'receiver1',
            amount: '1000000',
            note: 'test note',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/algo-transfer',
                false,
                'deeplink',
            )
        })

        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { assetId: '0' },
            expect.objectContaining({ size: 'modal' }),
        )
        expect(mockSetDestination).toHaveBeenCalledWith('receiver1')
        expect(mockSetSelectedAssetId).toHaveBeenCalledWith('0')
        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetNote).toHaveBeenCalledWith('test note')
        // 1_000_000 microAlgos == 1 ALGO in display units.
        expect(mockSetAmount).toHaveBeenCalled()
        expect(mockSetAmount.mock.calls[0][0].toString()).toBe('1')
    })

    it('should open send-funds bottom sheet for ASSET_TRANSFER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_TRANSFER,
            assetId: '123',
            receiverAddress: 'receiver1',
            amount: '100',
            note: 'test note',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-transfer',
                false,
                'deeplink',
            )
        })

        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { assetId: '123' },
            expect.objectContaining({ size: 'modal' }),
        )
        expect(mockSetDestination).toHaveBeenCalledWith('receiver1')
        expect(mockSetSelectedAssetId).toHaveBeenCalledWith('123')
        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetNote).toHaveBeenCalledWith('test note')
        // Asset amount is in base units; conversion is deferred to the input
        // screen because it depends on asset decimals — but we stash the raw
        // base-unit string so InputScreen can convert + populate once the
        // asset query resolves.
        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockSetPendingAmountBaseUnits).toHaveBeenCalledWith('100')
    })

    it('should handle ASSET_OPT_IN deeplink by prompting account selection', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_OPT_IN,
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-opt-in',
                false,
                'deeplink',
            )
        })

        // Bare assetId (no address) → the handler opens the account-selection
        // sheet first.
        expect(mockRequestByType).toHaveBeenCalledWith(
            'asset-opt-in-account-selection',
            {},
            expect.anything(),
        )
    })

    it('should handle ASSET_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_DETAIL,
            address: 'addr1',
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-detail',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '123' },
            },
        })
    })

    it('should handle INTERNAL_BROWSER deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.INTERNAL_BROWSER,
            url: 'https://example.com',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/browser',
                false,
                'deeplink',
            )
        })

        // Success case, pushWebView should have been called
    })

    it('should handle DISCOVER_PATH deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_PATH,
            path: '/test',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover?path=/test',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Discover',
            params: { path: '/test' },
        })
    })

    it('navigates DISCOVER_PATH deeplink with no path when path is omitted', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_PATH,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Discover',
            params: { path: undefined },
        })
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it.each([
        ['absolute-https', 'https://evil.com/phish'],
        ['protocol-relative', '//evil.com/phish'],
        ['javascript:', 'javascript:alert(1)'],
        ['data:', 'data:text/html,<script>x</script>'],
        ['empty', ''],
    ])(
        'blocks DISCOVER_PATH deeplink with %s path',
        async (_label, unsafePath) => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.DISCOVER_PATH,
                path: unsafePath,
                sourceUrl: 'perawallet://app/discover-path/?path=...',
            })
            const mockOnError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/discover-path/?path=...',
                    false,
                    'deeplink',
                    mockOnError,
                )
            })

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalled()
            expect(mockOnError).toHaveBeenCalled()
        },
    )

    it('should handle STAKING deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.STAKING,
            path: '/staking',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/staking',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Staking', {
            path: '/staking',
        })
    })

    it('should handle SWAP deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            address: 'addr1',
            assetInId: '0',
            assetOutId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '123' },
        })
    })

    it('should handle BUY deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.BUY,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/buy',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Fund',
        })
    })

    it('should handle ACCOUNT_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ACCOUNT_DETAIL,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/account-detail',
                false,
                'deeplink',
            )
        })

        // Navigates into the Home stack to the AccountDetails screen — the
        // top-level TabBar has no screen named 'AccountDetail'.
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AccountDetails',
            },
        })
    })

    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['data:', 'data:text/html,<script>alert(1)</script>'],
        ['file:', 'file:///etc/passwd'],
        ['http:', 'http://example.com/'],
        ['non-URL', 'not a url'],
    ])(
        'blocks DISCOVER_BROWSER deeplink with %s scheme',
        async (_label, adversarialUrl) => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.DISCOVER_BROWSER,
                url: adversarialUrl,
                sourceUrl: 'perawallet://app/discover-browser/?url=...',
            })
            const mockOnError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/discover-browser/?url=...',
                    false,
                    'deeplink',
                    mockOnError,
                )
            })

            expect(mockPushWebView).not.toHaveBeenCalled()
            expect(mockErrorToast).toHaveBeenCalled()
            expect(mockOnError).toHaveBeenCalled()
        },
    )

    it('allows DISCOVER_BROWSER deeplink for a well-formed HTTPS URL', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_BROWSER,
            url: 'https://tinyman.org/',
            sourceUrl: 'perawallet://app/discover-browser/?url=...',
        })
        const mockOnSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover-browser/?url=...',
                false,
                'deeplink',
                undefined,
                mockOnSuccess,
            )
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://tinyman.org/' }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
        expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('blocks INTERNAL_BROWSER deeplink with an unsafe URL', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.INTERNAL_BROWSER,
            url: 'javascript:alert(1)',
            sourceUrl: 'perawallet://app/internal-browser/?url=...',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/internal-browser/?url=...',
                false,
                'deeplink',
            )
        })

        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('should handle HOME deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
            )
        })

        // HOME should return to the Home tab's stack ROOT (AccountDetails), so
        // it actually "goes home" even when the user is deep in the Home stack.
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
    })

    it('should handle ASSET_TRANSACTIONS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_TRANSACTIONS,
            address: 'addr1',
            assetId: '123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-transactions',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AssetDetails',
                params: { assetId: '123' },
            },
        })
    })

    it('should handle ASSET_INBOX deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_INBOX,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-inbox',
                false,
                'deeplink',
            )
        })

        // Success case (infoPost called)
    })

    it('navigates to Pera Card for a CARDS deeplink when enabled', async () => {
        mockIsPeraCardEnabled.mockReturnValue(true)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CARDS,
            path: '/cards',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cards',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
            screen: 'PeraCardIntro',
        })
    })

    it('ignores a CARDS deeplink when Pera Card is disabled', async () => {
        mockIsPeraCardEnabled.mockReturnValue(false)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CARDS,
            path: '/cards',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cards',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('opens the pending-signatures sheet for a SIGN_REQUEST deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SIGN_REQUEST,
            signRequestId: 'req-123',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/sign-request/?signRequestId=req-123',
                false,
                'deeplink',
            )
        })

        expect(mockShowSignRequest).toHaveBeenCalledWith('req-123')
    })

    it('should open Bidali bottom sheet for SELL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SELL,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/sell',
                false,
                'deeplink',
            )
        })

        expect(mockInfoToast).not.toHaveBeenCalled()
        // Routes to the existing Menu → Buy Gift Card sheet (Bidali) via
        // requestByType so the sell flow inherits the bidaliProvider bridge
        // wiring instead of running through a thin webview redirect.
        expect(mockRequestByType).toHaveBeenCalledWith(
            'bidali',
            {},
            expect.objectContaining({ size: 'modal' }),
        )
    })

    it('should handle RECOVER_ADDRESS deeplink and open the pre-filled Import screen (HD) from QR', async () => {
        const mnemonic =
            'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24'
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'qr',
            )
        })

        // Mnemonic is handed off via the in-memory store, never imported
        // straight or carried in route params.
        expect(vi.mocked(setPendingImportMnemonic)).toHaveBeenCalledWith(
            mnemonic,
        )
        expect(mockImportAccount).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'ImportAccount',
            params: { accountType: 'hdWallet' },
        })
    })

    it('should handle RECOVER_ADDRESS deeplink and open the pre-filled Import screen (algo25) from QR', async () => {
        const mnemonic =
            'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24 word25'
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'qr',
            )
        })

        expect(vi.mocked(setPendingImportMnemonic)).toHaveBeenCalledWith(
            mnemonic,
        )
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'ImportAccount',
            params: { accountType: 'algo25' },
        })
    })

    it('should ignore RECOVER_ADDRESS deeplink from non-QR source', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECOVER_ADDRESS,
            mnemonic:
                'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/recover',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('should handle ADD_WATCH_ACCOUNT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_WATCH_ACCOUNT,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-watch',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should handle RECEIVER_ACCOUNT_SELECTION deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/receiver-selection',
                false,
                'deeplink',
            )
        })

        // Success case
    })

    it('should open account-actions bottom sheet for ADDRESS_ACTIONS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADDRESS_ACTIONS,
            address: 'recipient1',
            label: 'Friend',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/address-actions',
                false,
                'deeplink',
            )
        })

        expect(mockInfoToast).not.toHaveBeenCalled()
        // Routes to the account-actions bottom sheet (Send / Watch / Add
        // Contact menu); the in-sheet handlers themselves prefill send-funds
        // when the user picks "Send".
        expect(mockRequestByType).toHaveBeenCalledWith(
            'account-actions',
            {
                address: 'recipient1',
                label: 'Friend',
            },
            { enablePanDownToClose: true },
        )
    })

    it('should open send-funds bottom sheet for RECEIVER_ACCOUNT_SELECTION deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            address: 'recipient1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/receiver-account-selection',
                false,
                'deeplink',
            )
        })

        expect(mockInfoToast).not.toHaveBeenCalled()
        expect(mockSetDestination).toHaveBeenCalledWith('recipient1')
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { assetId: undefined },
            expect.objectContaining({ size: 'modal' }),
        )
    })

    it('should navigate to WatchAccount with prefill for ADD_WATCH_ACCOUNT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_WATCH_ACCOUNT,
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/register-watch-account',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: 'addr1' },
        })
    })

    it('should reject KEYREG deeplink with invalid sender address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.KEYREG,
            senderAddress: 'not-an-algorand-address',
            keyregType: 'offline',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/keyreg',
                false,
                'deeplink',
            )
        })

        // Deeplink errors surface via the in-app toast notifier,
        // deferred by ~400ms to let the QR Modal close first.
        await vi.waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('should submit offline KEYREG deeplink to signing pipeline', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.KEYREG,
            senderAddress: 'A'.repeat(58),
            keyregType: 'offline',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/keyreg?type=offline',
                false,
                'deeplink',
            )
        })

        expect(mockOfflineKeyRegistration).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'A'.repeat(58),
            }),
        )
        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'transactions',
                transport: 'algod',
            }),
        )
    })

    it('should rejects online KEYREG deeplink missing required fields', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.KEYREG,
            senderAddress: 'A'.repeat(58),
            keyregType: 'keyreg',
            voteKey: 'AAAA',
            // missing selkey, sprfkey, votefst, votelst, votekd
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/keyreg',
                false,
                'deeplink',
            )
        })

        await vi.waitFor(() => expect(mockErrorToast).toHaveBeenCalled())
        expect(mockOnlineKeyRegistration).not.toHaveBeenCalled()
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('should submit online KEYREG deeplink to signing pipeline', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.KEYREG,
            senderAddress: 'A'.repeat(58),
            keyregType: 'keyreg',
            voteKey: 'AAAA',
            selkey: 'BBBB',
            sprfkey: 'CCCC',
            votefst: '1',
            votelst: '1000',
            votekd: '10',
            fee: '1000',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/keyreg',
                false,
                'deeplink',
            )
        })

        expect(mockOnlineKeyRegistration).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'A'.repeat(58),
                voteFirst: 1n,
                voteLast: 1000n,
                voteKeyDilution: 10n,
                // staticFee is wrapped in algokit's AlgoAmount; just assert it
                // was passed through (AlgoAmount.microAlgos === 1000n).
                staticFee: expect.objectContaining({ microAlgos: 1000n }),
            }),
        )
        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'transactions',
                transport: 'algod',
            }),
        )
    })

    it('should handle navigation error', async () => {
        ;(parseDeeplink as Mock).mockImplementation(() => {
            return { type: DeeplinkType.HOME }
        })
        mockNavigate.mockImplementationOnce(() => {
            throw new Error('Test error')
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
            )
        })

        // Success case (logger.error called)
    })

    it('should handle SWAP deeplink without address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            assetInId: '0',
            assetOutId: '123',
            // no address
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '123' },
        })
    })

    it('should handle BUY deeplink without address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.BUY,
            // no address
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/buy',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Fund',
        })
    })

    it('should call onError callback when deeplink is invalid', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const mockOnError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'invalid',
                false,
                'deeplink',
                mockOnError,
            )
        })

        expect(mockOnError).toHaveBeenCalled()
    })

    it('should call onSuccess callback when deeplink is handled', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const mockOnSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
                undefined,
                mockOnSuccess,
            )
        })

        expect(mockOnSuccess).toHaveBeenCalled()
    })

    it('should call onError callback when navigation throws', async () => {
        ;(parseDeeplink as Mock).mockImplementation(() => {
            return { type: DeeplinkType.HOME }
        })
        mockNavigate.mockImplementationOnce(() => {
            throw new Error('Test error')
        })
        const mockOnError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
                mockOnError,
            )
        })

        expect(mockOnError).toHaveBeenCalled()
    })
})

describe('useDeeplinkListener', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        // Cold-start guard is module-level and shared across instances; reset
        // it between cases so a prior test's initial URL doesn't suppress this
        // one's handling.
        resetDeeplinkListenerStateForTesting()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should handle initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue('perawallet://app')
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve() // Wait for useEffect
        })

        act(() => {
            vi.runAllTimers()
        })

        // Success case
    })

    it('should handle initial URL error', async () => {
        ;(Linking.getInitialURL as Mock).mockRejectedValue(
            new Error('Test error'),
        )

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve() // Wait for useEffect
        })

        // Success case (logger.debug called)
    })

    it('should handle URL events', async () => {
        const mockAddListener = Linking.addEventListener as Mock
        renderHook(() => useDeeplinkListener())

        const callback = mockAddListener.mock.calls[0][1]

        await act(async () => {
            callback({ url: 'perawallet://app' })
        })

        // Success case
    })

    it('should not handle null initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue(null)
        ;(parseDeeplink as Mock).mockReturnValue(null)

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve()
        })

        // Should not attempt to handle deeplink since initial URL is null
        expect(parseDeeplink).not.toHaveBeenCalled()
    })

    it('should not handle invalid initial URL', async () => {
        ;(Linking.getInitialURL as Mock).mockResolvedValue('invalid://url')
        ;(parseDeeplink as Mock).mockReturnValue(null)

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve()
        })

        act(() => {
            vi.runAllTimers()
        })

        // parseDeeplink called but returns null, so no deeplink handled
        expect(parseDeeplink).toHaveBeenCalledWith('invalid://url')
    })

    it('should ignore invalid URL events', async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const mockAddListener = Linking.addEventListener as Mock
        renderHook(() => useDeeplinkListener())

        const callback = mockAddListener.mock.calls[0][1]

        await act(async () => {
            callback({ url: 'invalid://url' })
        })

        // parseDeeplink returns null, so deeplink is not handled
    })

    describe('PERA_WEB_IMPORT', () => {
        // Import inside the describe so the top-of-file mocks don't have to
        // know about the store. The store is a zustand singleton — calling
        // `.getState().setQr(...)` from the dispatcher mutates this exact
        // module instance.
        const importStore = async () =>
            (
                (await import('@modules/onboarding/hooks/peraWebImportFlowStore')) as typeof import('@modules/onboarding/hooks/peraWebImportFlowStore')
            ).usePeraWebImportFlowStore

        const fixtureQr = {
            type: DeeplinkType.PERA_WEB_IMPORT,
            backupId: 'backup-id-1',
            encryptionKey: Uint8Array.from(
                Array.from({ length: 32 }, (_, i) => i + 1),
            ),
            sourceUrl: '{"backupId":"backup-id-1","encryptionKey":"..."}',
        }

        beforeEach(async () => {
            const store = await importStore()
            store.getState().reset()
        })

        it('stashes the QR payload + navigates when source is "qr"', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(fixtureQr)
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    fixtureQr.sourceUrl,
                    true,
                    'qr',
                )
            })

            const store = await importStore()
            const stored = store.getState().qr
            expect(stored).not.toBeNull()
            expect(stored!.backupId).toBe('backup-id-1')
            expect(Array.from(stored!.encryptionKey)).toEqual(
                Array.from(fixtureQr.encryptionKey),
            )
            expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
                'AddAccount',
                expect.objectContaining({ screen: 'PeraWebImportLoading' }),
            )
        })

        it('ignores Pera Web payloads that arrive via a deeplink (QR-only entry point)', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(fixtureQr)
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    fixtureQr.sourceUrl,
                    true,
                    'deeplink',
                )
            })

            const store = await importStore()
            // No setQr fired — a malicious page can't push an inbound URL
            // that auto-triggers an import.
            expect(store.getState().qr).toBeNull()
            expect(vi.mocked(StackActions.replace)).not.toHaveBeenCalledWith(
                'AddAccount',
                expect.objectContaining({ screen: 'PeraWebImportLoading' }),
            )
        })
    })
})
