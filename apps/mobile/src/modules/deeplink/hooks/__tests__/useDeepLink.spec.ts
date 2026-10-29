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
import { Decimal } from 'decimal.js'
import { useDeepLink } from '../useDeepLink'
import {
    useDeeplinkListener,
    resetDeeplinkListenerStateForTesting,
} from '../useDeeplinkListener'
import { StackActions } from '@react-navigation/native'
import { parseDeeplink } from '../../parser'
import {
    ChainActionBuildError,
    DeeplinkType,
    deeplinkAdapters,
    type DeeplinkChainAdapter,
} from '@perawallet/wallet-core-deeplinks'
import { useScannerRequestStore } from '@hooks/useScannerRequest'
import { useAccountDrawerRequestStore } from '@hooks/useAccountDrawerRequest'
import { useAccountTabRequestStore } from '@hooks/useAccountTabRequest'
import { Linking, Platform } from 'react-native'
import { usePairingProgressStore } from '@modules/walletconnect/stores/usePairingProgressStore'
import {
    useImportAccount,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { capabilityState } from '@test-utils/capability-mock'
import { registerLegacyAddressCodec } from '@test-utils/chain-fixtures'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'

const { mockNavigate, mockDispatch, mockGetCurrentRoute } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockDispatch: vi.fn(),
    mockGetCurrentRoute: vi.fn(),
}))

const sendAccount = vi.hoisted(() => ({
    resolution: {
        kind: 'selected',
        account: { id: 'selected' },
    } as unknown,
    pick: vi.fn(),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: {
        navigate: mockNavigate,
        dispatch: mockDispatch,
        getCurrentRoute: mockGetCurrentRoute,
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

vi.mock('../../parser', () => ({
    parseDeeplink: vi.fn(),
}))

// The cards deeplink reads only where this device's card onboarding stands.
// Stub the package so the real persisted card store stays out of this graph.
const mockCardOnboarding = vi.hoisted(() => ({
    onboardingId: null as string | null,
    onboardingStep: 'EMAIL_SEND',
    escrowCardAddress: null as string | null,
    escrowCardApproved: false,
}))
vi.mock('@perawallet/wallet-core-card', () => ({
    OnboardingStep: { Completed: 'COMPLETED' },
    getCardOnboardingProgress: () => mockCardOnboarding,
    isEscrowCardApproved: () =>
        mockCardOnboarding.escrowCardAddress !== null &&
        mockCardOnboarding.escrowCardApproved,
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const { toBigInt } = await vi.importActual<
        typeof import('@packages/shared/src/utils/unit-conversion')
    >('@packages/shared/src/utils/unit-conversion')
    const { withTimeout } = await vi.importActual<
        typeof import('@packages/shared/src/utils/async')
    >('@packages/shared/src/utils/async')

    // Real error classes and enums rather than hand-copied literals: the
    // deeplinks package extends AppError at load. base.ts has no runtime
    // imports.
    const errors = await vi.importActual<
        typeof import('../../../../../../../packages/shared/src/errors/base')
    >('../../../../../../../packages/shared/src/errors/base')

    return {
        logger: {
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        generateOrderedUniqueId: vi.fn(() => 'test-id'),
        decodeFromBase64: vi.fn((b64: string) =>
            Uint8Array.from(Buffer.from(b64, 'base64')),
        ),
        ...errors,
        toBigInt,
        withTimeout,
    }
})

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
    // The chain's planner keeps the facts its own way; this one keeps them as given.
    plannerChainAdapters: {
        get: () => ({ signRequestChainData: (facts: unknown) => facts }),
    },
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    UserRejectedSigningError: class UserRejectedSigningError extends Error {},
    // Non-quantum sender in every fixture here — the calculator's real fast
    // path is a passthrough no-op. Real fee behavior is covered by
    // packages/chain-algorand/src/signing/__tests__/useAssignFeeToGroup.spec.ts
    // and apps/mobile/src/modules/deeplink/handlers/__tests__/useChainActionDeeplink.spec.ts.
    useMinimumFeeCalculatorFor:
        () =>
        () =>
        async ({ transactions }: { transactions: unknown[] }) => ({
            transactions,
            adjustments: [],
        }),
}))

const { mockBuildChainAction } = vi.hoisted(() => ({
    mockBuildChainAction: vi.fn(),
}))

// The asset-opt-in deeplink handler pulls in useAssetOptInMutation; mock it so
// the real transactions package isn't loaded into this unit test's import
// graph.
vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({ optIn: vi.fn() }),
}))

vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'algorand',
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        displayName: chainId === 'algorand' ? 'Algorand' : 'Ethereum',
        networks: [
            { id: 'mainnet', displayName: 'MainNet' },
            { id: 'testnet', displayName: 'TestNet' },
        ],
        protocol: { requiresAssetOptIn: chainId === 'algorand' },
        nativeAsset: {
            ref: { chainId, assetId: chainId === 'algorand' ? '0' : 'native' },
        },
    }),
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
    getSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

type StoredAccount = {
    id: string
    chains: Record<string, { address: string }>
}

const SELECTED_ACCOUNT = {
    id: 'selected',
    custody: { kind: 'watch' },
    chains: { algorand: { address: 'addr1' } },
}

const accountsState = vi.hoisted(() => ({
    accounts: [] as unknown[],
    selected: null as unknown,
    setSelectedAccountId: vi.fn(),
    resolveAssetHolderAddress: vi.fn(),
}))

const { mockEnableChain } = vi.hoisted(() => ({ mockEnableChain: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    accountsChainAdapters: { has: () => true },
    // A fixture without chain entries stands for an account already on the
    // link's chain, so send opens without enabling one.
    chainAccountOf: (
        account: { chains?: Record<string, unknown> },
        chainId: string,
    ) => (account.chains === undefined ? {} : account.chains[chainId]),
    useEnableChain: () => mockEnableChain,
    // Such a fixture's first chain is the first registered one.
    accountChainIdOf: (
        account: { chains?: Record<string, unknown> },
        registered: readonly string[],
    ) =>
        account.chains === undefined
            ? registered[0]
            : registered.find(id => account.chains?.[id] !== undefined),
    useSelectedAccount: () => ({
        id: 'selected',
        custody: { kind: 'watch' },
        chains: { algorand: { address: 'addr1' } },
    }),
    useSelectedAccountId: () => ({
        setSelectedAccountId: accountsState.setSelectedAccountId,
    }),
    getAllAccounts: () => accountsState.accounts,
    getSelectedAccount: () => accountsState.selected,
    findAccountByAnyChainAddress: (
        accounts: StoredAccount[],
        address: string,
    ) =>
        accounts.find(a =>
            Object.values(a.chains).some(entry => entry.address === address),
        ),
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    hdIndexOf: () => undefined,
    useResolveAssetHolderAddress: () => accountsState.resolveAssetHolderAddress,
    useAllAccounts: () => [
        {
            id: 'mock',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: 'A'.repeat(58) } },
        },
    ],
    resolveAuthAccount: (account: unknown) => account,
    // The keyreg preflight resolves the signer through this; the seeded
    // account above is locally signable.
    resolveSignerForAccount: (account: unknown) => ({
        kind: 'ok',
        signer: account,
    }),
    detectImportKind: (_chainId: string, mnemonic: string) => {
        const wordCount = mnemonic.trim().split(/\s+/).length
        if (wordCount === 24) return { success: true, seed: 'bip39' }
        if (wordCount === 25) return { success: true, seed: null }
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
vi.mock('@modules/onboarding', async () => {
    const actual = (await vi.importActual(
        '@modules/onboarding/hooks/peraWebImportFlowStore',
    )) as typeof import('@modules/onboarding/hooks/peraWebImportFlowStore')
    return { usePeraWebImportFlowStore: actual.usePeraWebImportFlowStore }
})

const { mockPushWebView } = vi.hoisted(() => ({
    mockPushWebView: vi.fn(),
}))

vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

// Pairing itself (handing the URI to the registry, scoping the wait to this
// pairing's answer) is covered by `useConnectionPairing`'s own spec — the
// deeplink tests only pin which outcome drives which callback.
const { mockPair, mockDescribeUri } = vi.hoisted(() => ({
    mockPair: vi.fn(
        async (
            _uri: string,
            _options?: {
                origin?: { source: string; browserName?: string }
                outcomeTimeoutMs?: number
            },
        ): Promise<{
            type: string
            error?: Error
            pairingId?: string
            lateOutcome?: Promise<{ type: string }>
        }> => ({ type: 'session' }),
    ),
    // The claiming handler's own redaction, as the registry hands it back.
    mockDescribeUri: vi.fn((_uri: string): Record<string, string | null> => ({
        topic: 'topic',
        bridgeOrigin: 'https://b.example',
    })),
}))

vi.mock('@modules/connections/hooks/useConnectionPairing', () => ({
    useConnectionPairing: () => ({
        pair: mockPair,
        describeUri: mockDescribeUri,
    }),
}))

// The real budgets by module path: the package barrel builds a zod schema
// and an AppError subclass from packages this file mocks by hand.
vi.mock(
    '@perawallet/wallet-core-connections',
    async () =>
        await vi.importActual<
            typeof import('@packages/connections/src/pairingOutcome')
        >('@packages/connections/src/pairingOutcome'),
)

const {
    mockRequestByType,
    mockRequestBottomSheet,
    mockSetDestination,
    mockSetSelectedAsset,
    mockSetCanSelectAsset,
    mockSetChainId,
    mockSetNote,
    mockSetAmount,
    mockSendFundsReset,
} = vi.hoisted(() => ({
    mockRequestByType: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockSetDestination: vi.fn(),
    mockSetSelectedAsset: vi.fn(),
    mockSetCanSelectAsset: vi.fn(),
    mockSetChainId: vi.fn(),
    mockSetNote: vi.fn(),
    mockSetAmount: vi.fn(),
    mockSendFundsReset: vi.fn(),
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

const { mockShowSignRequest, mockIsPeraCardEnabled, mockIsGiftCardsEnabled } =
    vi.hoisted(() => ({
        mockShowSignRequest: vi.fn(),
        mockIsPeraCardEnabled: vi.fn(() => true),
        mockIsGiftCardsEnabled: vi.fn(() => true),
    }))

// Mutable so per-test overrides can exercise the web capability map (vitest
// has no platform resolution, so the real import always lands on the
// all-native capabilities.ts).
const { mockRouteCapabilities } = vi.hoisted(() => ({
    mockRouteCapabilities: {
        giftCards: true,
        inAppWebView: true,
        // Native map has Discover registered; these tests exercise the
        // success path. The gate's own off case is covered separately in
        // useDiscoverPathDeeplink.spec.ts.
        discoverTab: true,
    },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockRouteCapabilities,
}))

vi.mock('@modules/multisig', () => ({
    usePendingSignaturesSheet: () => ({
        showSignRequest: mockShowSignRequest,
    }),
}))

vi.mock('@hooks/useCapability', async () =>
    (await import('@test-utils/capability-mock')).capabilityHookMock(),
)

vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: mockIsPeraCardEnabled,
}))

vi.mock('@hooks/useIsGiftCardsEnabled', () => ({
    useIsGiftCardsEnabled: mockIsGiftCardsEnabled,
}))

const { mockRunTourStep } = vi.hoisted(() => ({
    mockRunTourStep: vi.fn().mockResolvedValue(undefined),
}))

const { mockApplyE2eFixture } = vi.hoisted(() => ({
    mockApplyE2eFixture: vi.fn(),
}))

vi.mock('../../handlers/useE2eFixtureDeeplink', () => ({
    useE2eFixtureDeeplink: () => mockApplyE2eFixture,
}))

const { mockOpenPassphraseBackup, mockIsCloudBackupAvailable } = vi.hoisted(
    () => ({
        mockOpenPassphraseBackup: vi.fn(),
        mockIsCloudBackupAvailable: vi.fn(() => true),
    }),
)

vi.mock('../../handlers/usePassphraseBackupDeeplink', () => ({
    usePassphraseBackupDeeplink: () => mockOpenPassphraseBackup,
}))

vi.mock('@hooks/useIsCloudBackupAvailable', () => ({
    useIsCloudBackupAvailable: mockIsCloudBackupAvailable,
}))

vi.mock('@modules/locale-tour/registry', () => ({
    getLocaleTourRunner: () => ({
        runTourStep: mockRunTourStep,
        runTour: vi.fn().mockResolvedValue(undefined),
    }),
}))

const { mockSetPendingAmountBaseUnits } = vi.hoisted(() => ({
    mockSetPendingAmountBaseUnits: vi.fn(),
}))

vi.mock('@modules/transactions', () => ({
    useSendAccountResolver: () => ({
        resolve: () => sendAccount.resolution,
        pick: sendAccount.pick,
    }),
    useSendFundsStore: {
        getState: () => ({
            reset: mockSendFundsReset,
            setDestination: mockSetDestination,
            setSelectedAsset: mockSetSelectedAsset,
            setCanSelectAsset: mockSetCanSelectAsset,
            setChainId: mockSetChainId,
            setNote: mockSetNote,
            setAmount: mockSetAmount,
            setPendingAmountBaseUnits: mockSetPendingAmountBaseUnits,
        }),
    },
}))

const { mockInfoToast, mockErrorToast, mockHideToast } = vi.hoisted(() => ({
    mockInfoToast: vi.fn(),
    mockErrorToast: vi.fn(),
    mockHideToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
        hideToast: mockHideToast,
    })),
}))

vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: vi.fn(),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
        openURL: vi.fn(async () => undefined),
    },
    Platform: { OS: 'ios' },
}))

beforeEach(() => {
    registerLegacyAddressCodec()
})

afterEach(() => {
    addressCodecs.reset()
})

describe('useDeepLink', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        sendAccount.resolution = {
            kind: 'selected',
            account: { id: 'selected' },
        }
        // The listener's cold-start guard is module-level (shared across all
        // layout-mounted instances); reset it so one test's initial-URL
        // handling doesn't suppress the next test's.
        resetDeeplinkListenerStateForTesting()
        capabilityState.reset()
        accountsState.accounts = []
        accountsState.selected = SELECTED_ACCOUNT
        mockRouteCapabilities.giftCards = true
        mockIsGiftCardsEnabled.mockReturnValue(true)
        mockRouteCapabilities.inAppWebView = true
        mockPair.mockResolvedValue({ type: 'session' })
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
        // Error toasts fire on a 400ms timer; a real one outlives its test and
        // lands in a later test's `mockErrorToast` assertions.
        vi.useFakeTimers({ shouldAdvanceTime: true })
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
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

    it('reports a parser throw as a failed link instead of rejecting', async () => {
        ;(parseDeeplink as Mock).mockImplementationOnce(() => {
            throw new Error('parser defect')
        })
        const onError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app',
                false,
                'deeplink',
                onError,
            )
        })

        expect(onError).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(400)
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('should handle ADD_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
            target: { chainId: 'algorand' },
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
                chainId: 'algorand',
            },
        })
    })

    it('should handle EDIT_CONTACT deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.EDIT_CONTACT,
            address: 'addr1',
            label: 'Label1',
            target: { chainId: 'algorand' },
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
                chainId: 'algorand',
            },
        })
    })

    it('refuses a Pera link whose chain= names a network other than the selected one', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl:
                'perawallet://app/add-contact?chain=algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe&address=addr1',
            address: 'addr1',
            target: { chainId: 'algorand', networkId: 'testnet' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(400)
        expect(mockErrorToast).toHaveBeenCalledWith(
            'deeplink.error.title_network_mismatch',
            'deeplink.error.body_network_mismatch',
        )
    })

    it('refuses a chain URI that names a network other than the selected one', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl: 'algorand://net:testnet/addr1',
            address: 'addr1',
            target: { chainId: 'algorand', networkId: 'testnet' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'algorand://net:testnet/addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(400)
        expect(mockErrorToast).toHaveBeenCalledWith(
            'deeplink.error.title_network_mismatch',
            'deeplink.error.body_network_mismatch',
        )
    })

    it('runs a chain URI that names the selected network', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            sourceUrl: 'algorand://net:mainnet/addr1',
            address: 'addr1',
            target: { chainId: 'algorand', networkId: 'mainnet' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'algorand://net:mainnet/addr1',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'AddContact',
            params: { address: 'addr1', label: undefined, chainId: 'algorand' },
        })
    })

    it("refuses a Pera link whose chain= the app doesn't know", async () => {
        ;(parseDeeplink as Mock).mockReturnValue(null)
        const onError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/add-contact?chain=eip155:999999&address=0xabc',
                false,
                'deeplink',
                onError,
            )
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.network_unavailable.title',
            'common.network_unavailable.generic_body',
        )
        expect(onError).toHaveBeenCalled()
    })

    it('should handle replaceCurrentScreen in navigateToScreen', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADD_CONTACT,
            address: 'addr1',
            label: 'Label1',
            target: { chainId: 'algorand' },
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
                    chainId: 'algorand',
                },
            },
        )
        expect(mockDispatch).toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('returns stable handler identities across rerenders so the Linking subscription never churns', () => {
        const { result, rerender } = renderHook(() => useDeepLink())
        const first = result.current

        rerender()

        expect(result.current.handleDeepLink).toBe(first.handleDeepLink)
        expect(result.current.isValidDeepLink).toBe(first.isValidDeepLink)
    })

    it('hands a wc URI to the registry rather than deciding the protocol itself', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:topic@1',
                false,
                'qr',
                vi.fn(),
                vi.fn(),
                vi.fn(),
            )
        })

        expect(mockPair).toHaveBeenCalledWith(
            'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
            expect.anything(),
        )
    })

    // The URI's `key=` is the pairing secret and error-level context ships to
    // the crash reporter, so the log carries only what the claiming handler
    // says is safe — asked of the registry, not of a protocol package this
    // layer would have to import.
    it('logs a pairing failure by the registry description, never the URI', async () => {
        const uri = 'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef'
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri,
        })
        mockPair.mockResolvedValueOnce({
            type: 'connect-failed',
            error: new Error('unreachable bridge'),
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:topic@1',
                false,
                'qr',
                vi.fn(),
                vi.fn(),
                vi.fn(),
            )
        })

        expect(mockDescribeUri).toHaveBeenCalledWith(uri)
        expect(logger.error).toHaveBeenCalledWith(
            '[deeplink/wc] connect failed',
            {
                error: expect.any(Error),
                topic: 'topic',
                bridgeOrigin: 'https://b.example',
            },
        )
    })

    it('surfaces a pairing failure through showError', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=beef',
        })
        mockPair.mockResolvedValueOnce({
            type: 'connect-failed',
            error: new Error('unreachable bridge'),
        })
        const onError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/wallet-connect?uri=wc:topic@1',
                false,
                'qr',
                onError,
                vi.fn(),
                vi.fn(),
            )
        })

        expect(onError).toHaveBeenCalled()
    })

    it('treats a proposal from the paired dApp as success', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        mockPair.mockResolvedValueOnce({ type: 'session' })
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

        expect(mockPair).toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(onConnectionError).not.toHaveBeenCalled()
        expect(onError).not.toHaveBeenCalled()
    })

    it('keeps the scanner open via onConnectionError when the handshake is rejected (e.g. wrong network)', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
        })
        mockPair.mockResolvedValueOnce({
            type: 'error',
            error: new Error('wrong network'),
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
        mockPair.mockResolvedValueOnce({ type: 'timeout' })
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

    // The origin travels with `pair` and the handler writes it onto the
    // approved connection; what the dispatcher owns — and what these pin —
    // is which origin each link source maps to.
    describe('WalletConnect return-to-dapp gating', () => {
        const wcDeeplink = (browserName?: string) => ({
            type: DeeplinkType.WALLET_CONNECT,
            uri: 'wc:123',
            sourceUrl: 'perawallet-wc://wc?uri=wc%3A123',
            browserName,
        })

        beforeEach(() => {
            usePairingProgressStore.getState().resetState()
            mockPair.mockResolvedValueOnce({ type: 'session' })
        })

        const originOf = (): { source: string; browserName?: string } => {
            const origin = mockPair.mock.calls[0]?.[1]?.origin
            if (!origin) throw new Error('pair() was called without an origin')
            return origin
        }

        it('records a return context for an OS deep link that names the browser (iOS wrapper)', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })

            expect(originOf()).toMatchObject({
                source: 'external-browser',
                browserName: 'chrome',
            })
        })

        it('records an external-browser origin without a browser name when the wrapper named none', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink(undefined))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'wc:123?bridge=x&key=y',
                    false,
                    'deeplink',
                )
            })

            expect(originOf()).toMatchObject({ source: 'external-browser' })
            expect(originOf().browserName).toBeUndefined()
        })

        it('records a context on Android even without a browser name (raw wc: intent)', async () => {
            const platform = Platform as { OS: string }
            const originalOS = platform.OS
            platform.OS = 'android'
            try {
                ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink(undefined))
                const { result } = renderHook(() => useDeepLink())

                await act(async () => {
                    await result.current.handleDeepLink(
                        'wc:123?bridge=x&key=y',
                        false,
                        'deeplink',
                    )
                })

                expect(originOf()).toMatchObject({
                    source: 'external-browser',
                })
            } finally {
                platform.OS = originalOS
            }
        })

        it('records a qr origin for a QR-scanned pairing', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'qr',
                )
            })

            expect(originOf()).toMatchObject({ source: 'qr' })
        })

        it('gives an OS deep-link pairing the extended 15s outcome budget', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })

            expect(mockPair).toHaveBeenCalledWith(
                'wc:123',
                expect.objectContaining({ outcomeTimeoutMs: 15_000 }),
            )
        })

        it('keeps the 8s outcome budget for QR pairings', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink(undefined))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'wc:123?bridge=x&key=y',
                    false,
                    'qr',
                )
            })

            expect(mockPair).toHaveBeenCalledWith(
                'wc:123',
                expect.objectContaining({ outcomeTimeoutMs: undefined }),
            )
        })

        it('shows the pairing overlay for the whole deep-link outcome wait and clears it after', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            mockPair.mockReset()
            // Captured, not asserted inline: a throw inside the mock would be
            // swallowed by handleDeepLink's own catch and the test would pass
            // without the feature.
            let countDuringWait = -1
            mockPair.mockImplementationOnce(async () => {
                countDuringWait =
                    usePairingProgressStore.getState().pendingCount
                return { type: 'session' }
            })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })

            expect(countDuringWait).toBe(1)
            expect(usePairingProgressStore.getState().pendingCount).toBe(0)
        })

        it('clears the pairing overlay even when the pairing times out', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            mockPair.mockReset()
            mockPair.mockResolvedValueOnce({ type: 'timeout' })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })

            expect(usePairingProgressStore.getState().pendingCount).toBe(0)
        })

        it('never shows the pairing overlay for QR pairings (the scanner has its own)', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink(undefined))
            mockPair.mockReset()
            let countDuringWait = -1
            mockPair.mockImplementationOnce(async () => {
                countDuringWait =
                    usePairingProgressStore.getState().pendingCount
                return { type: 'session' }
            })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'wc:123?bridge=x&key=y',
                    false,
                    'qr',
                )
            })

            expect(countDuringWait).toBe(0)
            expect(usePairingProgressStore.getState().pendingCount).toBe(0)
        })

        it('hides the timeout toast when a late session_request lands within the grace window', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            mockPair.mockReset()
            mockPair.mockResolvedValueOnce({
                type: 'timeout',
                pairingId: 'pairing-client',
                lateOutcome: Promise.resolve({ type: 'proposal' }),
            })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })
            // Flush the fire-and-forget grace watcher.
            await act(async () => {
                await Promise.resolve()
            })

            expect(mockHideToast).toHaveBeenCalledTimes(1)
        })

        it('leaves the timeout toast up when the grace window expires with no session', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            mockPair.mockReset()
            mockPair.mockResolvedValueOnce({
                type: 'timeout',
                pairingId: 'pairing-client',
                lateOutcome: Promise.resolve({ type: 'timeout' }),
            })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet-wc://wc?uri=wc%3A123',
                    false,
                    'deeplink',
                )
            })
            await act(async () => {
                await Promise.resolve()
            })

            expect(mockHideToast).not.toHaveBeenCalled()
        })

        it('records an in-app origin for a webview-dispatched pairing', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(wcDeeplink('chrome'))
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'wc:123?bridge=x&key=y',
                    false,
                    'in-app',
                )
            })

            expect(originOf()).toMatchObject({ source: 'in-app' })
        })
    })

    describe('notification source', () => {
        it('refuses a value-bearing type and reports it via onError', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.TRANSFER,
                receiverAddress: 'receiver1',
                amount: new Decimal('1000000'),
            })
            const onError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/algo-transfer',
                    false,
                    'notification',
                    onError,
                )
            })

            expect(mockRequestByType).not.toHaveBeenCalled()
            expect(mockSetDestination).not.toHaveBeenCalled()
            expect(onError).toHaveBeenCalled()
            expect(logger.warn).toHaveBeenCalledWith(
                'Blocked notification deeplink',
                { type: DeeplinkType.TRANSFER },
            )
        })

        it('still routes a navigation-shaped type', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.HOME,
            })
            const onSuccess = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://home',
                    false,
                    'notification',
                    undefined,
                    onSuccess,
                )
            })

            expect(onSuccess).toHaveBeenCalled()
            expect(logger.warn).not.toHaveBeenCalled()
        })
    })

    it('opens the send-funds bottom sheet for a TRANSFER of the native asset', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.TRANSFER,
            target: { chainId: 'algorand' },
            receiverAddress: 'receiver1',
            amount: new Decimal('1000000'),
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
        // No asset on the link: the target chain's native asset.
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { asset: { chainId: 'algorand', assetId: '0' } },
            expect.objectContaining({ size: 'modal' }),
        )
        expect(mockSetDestination).toHaveBeenCalledWith('receiver1')
        expect(mockSetSelectedAsset).toHaveBeenCalledWith({
            chainId: 'algorand',
            assetId: '0',
        })
        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetNote).toHaveBeenCalledWith('test note')
        // Base units for every asset; the input step converts them.
        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockSetPendingAmountBaseUnits).toHaveBeenCalledWith('1000000')
    })

    it('opens the send-funds bottom sheet for a TRANSFER of an asset', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.TRANSFER,
            target: { chainId: 'algorand' },
            assetRef: { chainId: 'algorand', assetId: '123' },
            receiverAddress: 'receiver1',
            amount: new Decimal('100'),
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
            { asset: { chainId: 'algorand', assetId: '123' } },
            expect.objectContaining({ size: 'modal' }),
        )
        expect(mockSetDestination).toHaveBeenCalledWith('receiver1')
        expect(mockSetSelectedAsset).toHaveBeenCalledWith({
            chainId: 'algorand',
            assetId: '123',
        })
        expect(mockSetCanSelectAsset).toHaveBeenCalledWith(false)
        expect(mockSetNote).toHaveBeenCalledWith('test note')
        expect(mockSetAmount).not.toHaveBeenCalled()
        expect(mockSetPendingAmountBaseUnits).toHaveBeenCalledWith('100')
    })

    it('falls back to the locked note of a TRANSFER when no editable note is set', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.TRANSFER,
            target: { chainId: 'algorand' },
            receiverAddress: 'receiver1',
            chainData: { family: 'algorand', xnote: 'locked' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-transfer',
                false,
                'deeplink',
            )
        })

        expect(mockSetNote).toHaveBeenCalledWith('locked')
    })

    it('should handle ASSET_OPT_IN deeplink by prompting account selection', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_OPT_IN,
            target: { chainId: 'algorand' },
            assetRef: { chainId: 'algorand', assetId: '123' },
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
            { chainId: 'algorand' },
            expect.anything(),
        )
    })

    it('dismisses the QR scanner immediately for ASSET_OPT_IN, before the opt-in sheet resolves', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_OPT_IN,
            target: { chainId: 'algorand' },
            assetRef: { chainId: 'algorand', assetId: '123' },
        })
        // Keep the opt-in sheet open forever: its promise never settles, so
        // any assertion that onSuccess fired can only be true if the scanner
        // is dismissed up front rather than after the user closes the sheet.
        // (The native scanner Modal occludes the root-level sheet until it's
        // dismissed — the freeze this guards against.)
        mockRequestByType.mockReturnValue(new Promise<never>(() => {}))

        const { result } = renderHook(() => useDeepLink())
        const onError = vi.fn()
        const onSuccess = vi.fn()
        const onConnectionError = vi.fn()

        await act(async () => {
            // Intentionally NOT awaited — the opt-in sheet never resolves, so
            // awaiting the whole dispatch would hang. Only the synchronous
            // dispatch + scanner dismissal needs to run.
            void result.current.handleDeepLink(
                'perawallet://app/asset-opt-in?assetId=123',
                false,
                'qr',
                onError,
                onSuccess,
                onConnectionError,
            )
            await Promise.resolve()
        })

        // The sheet is open...
        expect(mockRequestByType).toHaveBeenCalledWith(
            'asset-opt-in-account-selection',
            { chainId: 'algorand' },
            expect.anything(),
        )
        // ...and the scanner was already told to close, without waiting for it.
        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(onError).not.toHaveBeenCalled()
        expect(onConnectionError).not.toHaveBeenCalled()
    })

    it('should handle ASSET_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_DETAIL,
            target: { chainId: 'algorand' },
            address: 'addr1',
            assetRef: { chainId: 'algorand', assetId: '123' },
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
                params: { assetId: '123', chainId: 'algorand' },
            },
        })
    })

    // Widgets carry no addresses, so the link resolves the holder itself; the
    // detail screen reads the selected account.
    it('selects the NFT holder and opens the NFT detail', async () => {
        accountsState.accounts = [
            { id: 'holder', chains: { algorand: { address: 'HOLDER' } } },
        ]
        accountsState.resolveAssetHolderAddress.mockResolvedValue('HOLDER')
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.NFT_DETAIL,
            target: { chainId: 'algorand' },
            assetRef: { chainId: 'algorand', assetId: '286018494' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/nft-detail/?assetId=286018494',
                false,
                'deeplink',
            )
        })

        expect(accountsState.resolveAssetHolderAddress).toHaveBeenCalledWith(
            '286018494',
        )
        expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
            'holder',
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'CollectibleDetails',
                params: { assetId: '286018494' },
            },
        })
    })

    it('opens the NFT detail without changing accounts when no account holds it', async () => {
        accountsState.resolveAssetHolderAddress.mockResolvedValue(null)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.NFT_DETAIL,
            target: { chainId: 'algorand' },
            assetRef: { chainId: 'algorand', assetId: '286018494' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/nft-detail/?assetId=286018494',
                false,
                'deeplink',
            )
        })

        expect(accountsState.setSelectedAccountId).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'CollectibleDetails',
                params: { assetId: '286018494' },
            },
        })
    })

    // Control Center, the Action button and the app icon's quick action all
    // land here; the home screen owns the scanner.
    it('opens the home screen and asks it to open the scanner', async () => {
        useScannerRequestStore.setState({
            isRequested: false,
            openScannerCount: 0,
        })
        ;(parseDeeplink as Mock).mockReturnValue({ type: DeeplinkType.SCAN })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/scan/',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
        expect(useScannerRequestStore.getState().isRequested).toBe(true)
    })

    // Navigating home would dismiss the open scanner and a new one would open.
    it('ignores a scan request while a scanner is already open', async () => {
        useScannerRequestStore.setState({
            isRequested: false,
            openScannerCount: 1,
        })
        ;(parseDeeplink as Mock).mockReturnValue({ type: DeeplinkType.SCAN })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/scan/',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(useScannerRequestStore.getState().isRequested).toBe(false)
        useScannerRequestStore.setState({ openScannerCount: 0 })
    })

    // The cloud backup stack picks intro, setup or overview itself.
    it('opens cloud backup in settings', async () => {
        mockIsCloudBackupAvailable.mockReturnValue(true)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CLOUD_BACKUP,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cloud-backup/',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Settings', {
            screen: 'CloudBackupSettings',
        })
    })

    it('refuses cloud backup where it is not offered', async () => {
        mockIsCloudBackupAvailable.mockReturnValue(false)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CLOUD_BACKUP,
        })
        const onError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cloud-backup/',
                false,
                'deeplink',
                onError,
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalled()
        mockIsCloudBackupAvailable.mockReturnValue(true)
    })

    // The Portfolio widgets land here when set to every account.
    it('opens home and asks the account drawer to show the portfolio', async () => {
        useAccountDrawerRequestStore.setState({ isRequested: false })
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.PORTFOLIO,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/portfolio/',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
        expect(useAccountDrawerRequestStore.getState().isRequested).toBe(true)
    })

    it.each([
        [DeeplinkType.INBOX, 'Inbox'],
        [DeeplinkType.NOTIFICATIONS, 'Notifications'],
    ])('opens the matching Messages tab for %s', async (type, initialTab) => {
        ;(parseDeeplink as Mock).mockReturnValue({ type })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/inbox/',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Messages', {
            screen: 'MessagesHome',
            params: { initialTab },
        })
    })

    it('hands the passphrase backup link to its handler', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.PASSPHRASE_BACKUP,
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/passphrase-backup/',
                true,
                'deeplink',
            )
        })

        expect(mockOpenPassphraseBackup).toHaveBeenCalledWith(true)
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

        expect(mockPushWebView).toHaveBeenCalledWith({
            id: 'test-id',
            url: 'https://example.com',
        })
    })

    it('opens INTERNAL_BROWSER deeplink via Linking when inAppWebView is off', async () => {
        mockRouteCapabilities.inAppWebView = false
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.INTERNAL_BROWSER,
            url: 'https://example.com',
        })
        const onSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/browser',
                false,
                'qr',
                undefined,
                onSuccess,
            )
        })

        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(onSuccess).toHaveBeenCalled()
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

    describe('capability gating', () => {
        // The capability each gated type needs, switched off in turn.
        it.each([
            [DeeplinkType.DISCOVER_PATH, 'discover'],
            [DeeplinkType.STAKING, 'staking'],
            [DeeplinkType.SIGN_REQUEST, 'multisig'],
            [DeeplinkType.WALLET_CONNECT, 'dappConnect'],
            [DeeplinkType.LIQUID_AUTH, 'liquidAuth'],
            [DeeplinkType.PERA_WEB_IMPORT, 'peraWebImport'],
        ] as const)(
            'refuses %s without navigating while %s is off',
            async (type, capability) => {
                capabilityState.turnOff(capability)
                ;(parseDeeplink as Mock).mockReturnValue({
                    type,
                    sourceUrl: 'perawallet://app',
                })
                const onError = vi.fn()
                const onSuccess = vi.fn()
                const { result } = renderHook(() => useDeepLink())

                await act(async () => {
                    await result.current.handleDeepLink(
                        'perawallet://app',
                        false,
                        'deeplink',
                        onError,
                        onSuccess,
                    )
                })

                expect(onError).toHaveBeenCalledTimes(1)
                expect(onSuccess).not.toHaveBeenCalled()
                expect(mockNavigate).not.toHaveBeenCalled()
                // A remote switch must not call a valid link invalid.
                expect(mockErrorToast).toHaveBeenCalledWith(
                    'common.network_unavailable.title',
                    'common.network_unavailable.generic_body',
                )
            },
        )

        // A type that names a chain is checked on that chain alone.
        it.each([
            [DeeplinkType.TRANSFER, 'send'],
            [DeeplinkType.RECEIVER_ACCOUNT_SELECTION, 'send'],
            [DeeplinkType.CHAIN_ACTION, 'send'],
            [DeeplinkType.SWAP, 'swap'],
            [DeeplinkType.ADD_WATCH_ACCOUNT, 'watchAccounts'],
            [DeeplinkType.SHARED_ACCOUNT_IMPORT, 'multisig'],
            [DeeplinkType.ASSET_OPT_IN, 'manageAssets'],
            [DeeplinkType.ASSET_INBOX, 'assetInbox'],
        ] as const)(
            'refuses %s as not supported on its chain while %s is off',
            async (type, capability) => {
                capabilityState.turnOff(capability)
                ;(parseDeeplink as Mock).mockReturnValue({
                    type,
                    sourceUrl: 'perawallet://app',
                    target: { chainId: 'algorand' },
                })
                const onError = vi.fn()
                const onSuccess = vi.fn()
                const { result } = renderHook(() => useDeepLink())

                await act(async () => {
                    await result.current.handleDeepLink(
                        'perawallet://app',
                        false,
                        'deeplink',
                        onError,
                        onSuccess,
                    )
                })

                expect(onError).toHaveBeenCalledTimes(1)
                expect(onSuccess).not.toHaveBeenCalled()
                expect(mockNavigate).not.toHaveBeenCalled()
                expect(mockRequestByType).not.toHaveBeenCalled()
                await vi.advanceTimersByTimeAsync(400)
                expect(mockErrorToast).toHaveBeenCalledWith(
                    'deeplink.error.title_unsupported',
                    'deeplink.error.body_unsupported_on_chain',
                )
            },
        )

        it('reports a link as unavailable without dispatching it', () => {
            capabilityState.turnOff('staking')
            ;(parseDeeplink as Mock).mockReturnValueOnce({
                type: DeeplinkType.STAKING,
            })
            const { result } = renderHook(() => useDeepLink())

            expect(
                result.current.isDeepLinkAvailable('perawallet://app/staking'),
            ).toBe(false)
            expect(mockErrorToast).not.toHaveBeenCalled()
        })

        it('treats an unparseable input as available, leaving validation to the caller', () => {
            ;(parseDeeplink as Mock).mockReturnValueOnce(null)
            const { result } = renderHook(() => useDeepLink())

            expect(result.current.isDeepLinkAvailable('ADDRESS')).toBe(true)
        })

        it('refuses a notification-sourced link silently', async () => {
            capabilityState.turnOff('staking')
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.STAKING,
                path: '/staking',
            })
            const onError = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/staking',
                    false,
                    'notification',
                    onError,
                )
            })

            expect(onError).toHaveBeenCalledTimes(1)
            expect(mockNavigate).not.toHaveBeenCalled()
            expect(mockErrorToast).not.toHaveBeenCalled()
        })

        it('leaves an ungated type alone while an unrelated capability is off', async () => {
            capabilityState.turnOff('staking', 'swap', 'multisig')
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.HOME,
            })
            const onSuccess = vi.fn()
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app',
                    false,
                    'deeplink',
                    undefined,
                    onSuccess,
                )
            })

            expect(onSuccess).toHaveBeenCalledTimes(1)
        })
    })

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
            target: { chainId: 'algorand' },
            assetInRef: { chainId: 'algorand', assetId: '0' },
            assetOutRef: { chainId: 'algorand', assetId: '123' },
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

    it("selects the link's account before opening the swap", async () => {
        const linked = {
            id: 'linked',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: 'LINKED' } },
        }
        accountsState.accounts = [linked]
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            address: 'LINKED',
            target: { chainId: 'algorand' },
            assetInRef: { chainId: 'algorand', assetId: '0' },
            assetOutRef: { chainId: 'algorand', assetId: '123' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
            'linked',
        )
        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Swap',
            params: { assetInId: '0', assetOutId: '123' },
        })
    })

    it('refuses a swap link for an account with no address on a swap chain', async () => {
        accountsState.selected = {
            id: 'eth-only',
            custody: { kind: 'local', seed: null },
            chains: { ethereum: { address: '0xabc' } },
        }
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            target: { chainId: 'algorand' },
            assetInRef: { chainId: 'algorand', assetId: '0' },
            assetOutRef: { chainId: 'algorand', assetId: '123' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/swap',
                false,
                'deeplink',
            )
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.network_unavailable.title',
            'common.network_unavailable.generic_body',
        )
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(accountsState.setSelectedAccountId).not.toHaveBeenCalled()
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

    describe('BUY deeplink account selection', () => {
        const heldOnTwoChains: StoredAccount = {
            id: 'two-chains',
            chains: {
                algorand: { address: 'ALGORAND_ADDRESS' },
                ethereum: { address: '0xETHEREUM_ADDRESS' },
            },
        }

        beforeEach(() => {
            accountsState.accounts = [heldOnTwoChains]
        })

        const openBuyLink = async (address: string) => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.BUY,
                address,
            })
            const { result } = renderHook(() => useDeepLink())
            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/buy',
                    false,
                    'deeplink',
                )
            })
        }

        it.each(['ALGORAND_ADDRESS', '0xETHEREUM_ADDRESS'])(
            'opens Fund on the account holding %s',
            async address => {
                await openBuyLink(address)

                expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
                    'two-chains',
                )
                expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                    screen: 'Fund',
                })
            },
        )

        it('keeps the selection for an address the wallet does not hold', async () => {
            await openBuyLink('NOT_HELD')

            expect(accountsState.setSelectedAccountId).not.toHaveBeenCalled()
        })
    })

    // The Transactions widget opens one account straight on its history.
    it('asks the account screen for its history tab when the link names it', async () => {
        useAccountTabRequestStore.setState({ requestedTab: null })
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ACCOUNT_DETAIL,
            target: { chainId: 'algorand' },
            address: 'addr1',
            tab: 'history',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/account-detail/?address=addr1&tab=history',
                false,
                'deeplink',
            )
        })

        expect(useAccountTabRequestStore.getState().requestedTab).toBe(
            'History',
        )
    })

    it('should handle ACCOUNT_DETAIL deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ACCOUNT_DETAIL,
            target: { chainId: 'algorand' },
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

    it('normalizes a bare-domain DISCOVER_BROWSER URL to https before pushing it', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.DISCOVER_BROWSER,
            url: 'tinyman.org',
            sourceUrl: 'perawallet://app/discover-browser/?url=...',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/discover-browser/?url=...',
                false,
                'deeplink',
            )
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://tinyman.org' }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
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
            target: { chainId: 'algorand' },
            address: 'addr1',
            assetRef: { chainId: 'algorand', assetId: '123' },
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
                params: { assetId: '123', chainId: 'algorand' },
            },
        })
    })

    it('should handle ASSET_INBOX deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ASSET_INBOX,
            address: 'addr1',
            target: { chainId: 'algorand' },
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/asset-inbox',
                false,
                'deeplink',
            )
        })

        expect(mockNavigate).toHaveBeenCalledWith('Messages', {
            screen: 'AssetTransferRequests',
            params: {
                item: {
                    address: 'addr1',
                    inboxAddress: 'addr1',
                    requestCount: 1,
                },
                scope: { chainId: 'algorand', networkId: 'mainnet' },
            },
        })
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

    describe('the onboarding-status CARDS path Baanx returns KYC users to', () => {
        const openOnboardingStatus = async () => {
            mockIsPeraCardEnabled.mockReturnValue(true)
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.CARDS,
                path: 'onboarding-status',
            })
            const { result } = renderHook(() => useDeepLink())
            await act(async () => {
                await result.current.handleDeepLink(
                    'https://perawallet.app/qr/perawallet/app/cards?path=onboarding-status',
                    true,
                    'deeplink',
                )
            })
        }

        beforeEach(() => {
            mockCardOnboarding.onboardingId = null
            mockCardOnboarding.onboardingStep = 'EMAIL_SEND'
            mockCardOnboarding.escrowCardAddress = null
            mockCardOnboarding.escrowCardApproved = false
            mockGetCurrentRoute.mockReturnValue(undefined)
        })

        it('opens the setup checklist while onboarding is in progress, without replacing the screen', async () => {
            mockCardOnboarding.onboardingId = 'ob_1'
            mockCardOnboarding.onboardingStep = 'VERIFICATION'

            await openOnboardingStatus()

            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'CardOnboarding',
                params: { screen: 'CardOnboardingStatus', params: {} },
            })
            expect(vi.mocked(StackActions.replace)).not.toHaveBeenCalled()
        })

        it('leaves the checklist alone when it is already open', async () => {
            mockCardOnboarding.onboardingId = 'ob_1'
            mockCardOnboarding.onboardingStep = 'VERIFICATION'
            mockGetCurrentRoute.mockReturnValue({
                name: 'CardOnboardingStatus',
            })

            await openOnboardingStatus()

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(vi.mocked(StackActions.replace)).not.toHaveBeenCalled()
        })

        it('opens the card home once the card exists', async () => {
            mockCardOnboarding.onboardingId = 'ob_1'
            mockCardOnboarding.onboardingStep = 'COMPLETED'
            mockCardOnboarding.escrowCardAddress = 'CARD_ADDRESS'
            mockCardOnboarding.escrowCardApproved = true

            await openOnboardingStatus()

            expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
                'TabBar',
                { screen: 'Home', params: { screen: 'PeraCardAccount' } },
            )
        })

        it('keeps the intro when this device has no onboarding', async () => {
            await openOnboardingStatus()

            expect(vi.mocked(StackActions.replace)).toHaveBeenCalledWith(
                'PeraCard',
                { screen: 'PeraCardIntro' },
            )
        })
    })

    it('ignores a CARDS deeplink when Pera Card is disabled', async () => {
        mockIsPeraCardEnabled.mockReturnValue(false)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.CARDS,
            path: '/cards',
        })
        const onError = vi.fn()
        const onSuccess = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/cards',
                false,
                'deeplink',
                onError,
                onSuccess,
            )
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        // onError must fire so a dispatching QR scanner re-arms instead of
        // staying locked forever on its handlingRef guard.
        expect(onError).toHaveBeenCalled()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.network_unavailable.title',
            'common.network_unavailable.generic_body',
        )
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
            target: { chainId: 'algorand' },
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

    it('ignores a SELL deeplink when the gift-cards flag is off', async () => {
        mockIsGiftCardsEnabled.mockReturnValue(false)
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SELL,
        })
        const onError = vi.fn()
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/sell',
                false,
                'qr',
                onError,
            )
        })

        expect(mockRequestByType).not.toHaveBeenCalled()
        expect(onError).toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalledWith(
            'common.network_unavailable.title',
            'common.network_unavailable.generic_body',
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
            params: { accountType: 'bip39' },
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
            params: { accountType: null },
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

        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: undefined },
        })
    })

    it('should handle RECEIVER_ACCOUNT_SELECTION deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            target: { chainId: 'algorand' },
            address: 'addr1',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/receiver-selection',
                false,
                'deeplink',
            )
        })

        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { asset: undefined },
            {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        )
        // The link names its network, so the send opens that network's picker.
        expect(mockSetChainId).toHaveBeenCalledWith('algorand')
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it("opens the link chain's asset picker when the sender's first chain is another one, so any asset there can be sent", async () => {
        sendAccount.resolution = {
            kind: 'single',
            account: {
                id: 'both-chains',
                chains: {
                    algorand: { address: 'A'.repeat(58) },
                    ethereum: { address: '0xabc' },
                },
            },
        }
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            target: { chainId: 'ethereum' },
            address: '0xreceiver',
        })
        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(
                'perawallet://app/receiver-selection',
                false,
                'deeplink',
            )
        })

        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            { asset: undefined },
            expect.anything(),
        )
        expect(mockSetChainId).toHaveBeenCalledWith('ethereum')
        expect(mockSetSelectedAsset).not.toHaveBeenCalled()
        expect(mockSetCanSelectAsset).not.toHaveBeenCalled()
    })

    it('should open account-actions bottom sheet for ADDRESS_ACTIONS deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.ADDRESS_ACTIONS,
            target: { chainId: 'algorand' },
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
                chainId: 'algorand',
            },
            { enablePanDownToClose: true },
        )
    })

    it('should open send-funds bottom sheet for RECEIVER_ACCOUNT_SELECTION deeplink', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.RECEIVER_ACCOUNT_SELECTION,
            target: { chainId: 'algorand' },
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
            { asset: undefined },
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

    describe('CHAIN_ACTION', () => {
        const builtTx = { kind: 'built-tx' }

        beforeEach(() => {
            mockBuildChainAction.mockReset()
            mockBuildChainAction.mockResolvedValue(builtTx)
            // Only the chain action leg is exercised; the dispatcher never
            // parses here because `parseDeeplink` is mocked.
            deeplinkAdapters.register({
                chainId: 'algorand',
                schemes: ['algorand'],
                canParse: () => false,
                parse: () => ({ kind: 'malformed' }) as never,
                toAssetRef: () => undefined,
                buildChainAction: mockBuildChainAction,
            })
        })

        afterEach(() => {
            deeplinkAdapters.reset()
        })

        const keyregLink = (chainData: Record<string, unknown>) => ({
            type: DeeplinkType.CHAIN_ACTION,
            target: { chainId: 'algorand' },
            chainData: {
                family: 'algorand',
                action: 'keyreg',
                sender: 'A'.repeat(58),
                keyregType: 'offline',
                ...chainData,
            },
        })

        const dispatch = async () => {
            const { result } = renderHook(() => useDeepLink())
            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/keyreg',
                    false,
                    'deeplink',
                )
            })
        }

        it('should reject a CHAIN_ACTION with an invalid sender address', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(
                keyregLink({ sender: 'not-an-algorand-address' }),
            )

            await dispatch()

            // Deeplink errors surface via the in-app toast notifier,
            // deferred by ~400ms to let the QR Modal close first.
            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalled()
            expect(mockBuildChainAction).not.toHaveBeenCalled()
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })

        it("should build a CHAIN_ACTION through the target chain's adapter and submit it to the signing pipeline", async () => {
            const link = keyregLink({})
            ;(parseDeeplink as Mock).mockReturnValue(link)

            await dispatch()

            expect(mockBuildChainAction).toHaveBeenCalledWith(
                link.chainData,
                expect.objectContaining({
                    scope: expect.objectContaining({ chainId: 'algorand' }),
                }),
            )
            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'transactions',
                    transport: 'network',
                    txs: [builtTx],
                }),
            )
        })

        it('should surface a CHAIN_ACTION the chain cannot build as an error toast', async () => {
            ;(parseDeeplink as Mock).mockReturnValue(
                keyregLink({ keyregType: 'online' }),
            )
            mockBuildChainAction.mockRejectedValueOnce(
                new ChainActionBuildError(
                    'missing-fields',
                    'Missing required participation key fields',
                ),
            )

            await dispatch()

            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalledWith(
                'deeplink.error.title_keyreg',
                'deeplink.error.body_keyreg',
            )
            expect(mockAddSignRequest).not.toHaveBeenCalled()
        })
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

        expect(logger.error).toHaveBeenCalledWith(expect.any(Error), {
            type: DeeplinkType.HOME,
        })
    })

    it('should handle SWAP deeplink without address', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.SWAP,
            target: { chainId: 'algorand' },
            assetInRef: { chainId: 'algorand', assetId: '0' },
            assetOutRef: { chainId: 'algorand', assetId: '123' },
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

    describe('the locale-tour deeplink', () => {
        it('dispatches to runTourStep', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: 'DEV_LOCALE_TOUR',
                locale: 'en-XA',
                step: 'scr-home',
            })
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(
                    'perawallet://app/dev/locale-tour?locale=en-XA&step=scr-home',
                    false,
                    'deeplink',
                )
            })

            expect(mockRunTourStep).toHaveBeenCalledWith({
                stepId: 'scr-home',
                locale: 'en-XA',
            })
        })
    })

    describe('the e2e fixture deeplink', () => {
        const url = 'perawallet://app/dev/e2e-fixture?name=contacts-empty'

        beforeEach(() => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: 'DEV_E2E_FIXTURE',
                sourceUrl: url,
                fixture: 'contacts-empty',
            })
        })

        it('applies the fixture from an OS deeplink', async () => {
            const { result } = renderHook(() => useDeepLink())

            await act(async () => {
                await result.current.handleDeepLink(url, false, 'deeplink')
            })

            expect(mockApplyE2eFixture).toHaveBeenCalledWith(
                expect.objectContaining({ fixture: 'contacts-empty' }),
            )
        })

        it.each(['qr', 'in-app', 'notification'] as const)(
            'refuses it from %s',
            async source => {
                const onError = vi.fn()
                const { result } = renderHook(() => useDeepLink())

                await act(async () => {
                    await result.current.handleDeepLink(
                        url,
                        false,
                        source,
                        onError,
                    )
                })

                expect(mockApplyE2eFixture).not.toHaveBeenCalled()
                expect(onError).toHaveBeenCalledTimes(1)
            },
        )
    })

    describe('chain-aware routing', () => {
        const ETHEREUM_ADDRESS = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
        const ETHEREUM_ACCOUNT = { id: 'eth-account' }
        const OTHER_ETHEREUM_ACCOUNT = { id: 'other-eth-account' }

        // Claims `refused:` and refuses it for a reason other than `malformed`.
        const refusingAdapter: DeeplinkChainAdapter = {
            chainId: 'ethereum',
            schemes: ['refused'],
            canParse: input => input.startsWith('refused:'),
            parse: () => ({ ok: false, reason: 'unsupported-network' }),
            toAssetRef: () => undefined,
        }

        afterEach(() => {
            deeplinkAdapters.reset()
        })

        const ethereumTransfer = {
            type: DeeplinkType.TRANSFER,
            sourceUrl: `ethereum:${ETHEREUM_ADDRESS}?value=1`,
            target: { chainId: 'ethereum' },
            receiverAddress: ETHEREUM_ADDRESS,
        }

        const dispatch = async (
            url: string,
            source: 'qr' | 'notification' = 'qr',
        ) => {
            const onError = vi.fn()
            const onSuccess = vi.fn()
            const { result } = renderHook(() => useDeepLink())
            await act(async () => {
                await result.current.handleDeepLink(
                    url,
                    false,
                    source,
                    onError,
                    onSuccess,
                )
            })
            return { onError, onSuccess }
        }

        it('opens a prefilled send from the resolved account on the link chain', async () => {
            sendAccount.resolution = {
                kind: 'single',
                account: ETHEREUM_ACCOUNT,
            }
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            const { onSuccess } = await dispatch(ethereumTransfer.sourceUrl)

            expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
                'eth-account',
            )
            expect(mockSetSelectedAsset).toHaveBeenCalledWith({
                chainId: 'ethereum',
                assetId: 'native',
            })
            expect(mockSetDestination).toHaveBeenCalledWith(ETHEREUM_ADDRESS)
            expect(mockRequestByType).toHaveBeenCalledWith(
                'send-funds',
                expect.anything(),
                expect.anything(),
            )
            expect(onSuccess).toHaveBeenCalledTimes(1)
        })

        it("enables the link's chain on a sender that isn't on it yet, then opens the send", async () => {
            const algorandOnly = {
                id: 'hd-account',
                chains: { algorand: { address: 'A'.repeat(58) } },
            }
            mockEnableChain.mockResolvedValue(algorandOnly)
            sendAccount.resolution = { kind: 'single', account: algorandOnly }
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            await dispatch(ethereumTransfer.sourceUrl)

            expect(mockEnableChain).toHaveBeenCalledWith(
                'hd-account',
                'ethereum',
                'user',
            )
            await vi.waitFor(() =>
                expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
                    'hd-account',
                ),
            )
            expect(mockRequestByType).toHaveBeenCalledWith(
                'send-funds',
                expect.anything(),
                expect.anything(),
            )
        })

        it('opens no send and reports the link when the chain cannot be enabled', async () => {
            mockEnableChain.mockRejectedValue(new Error('derivation failed'))
            sendAccount.resolution = {
                kind: 'single',
                account: { id: 'hd-account', chains: {} },
            }
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            const { onError } = await dispatch(ethereumTransfer.sourceUrl)

            await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
            expect(mockRequestByType).not.toHaveBeenCalledWith(
                'send-funds',
                expect.anything(),
                expect.anything(),
            )
        })

        it('shows the no-account error and opens nothing when the chain has no account that can send', async () => {
            sendAccount.resolution = { kind: 'none' }
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            const { onError, onSuccess } = await dispatch(
                ethereumTransfer.sourceUrl,
            )

            expect(onError).toHaveBeenCalledTimes(1)
            expect(onSuccess).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalledWith(
                'deeplink.error.title_no_account',
                'deeplink.error.body_no_account',
            )
        })

        it('asks which account sends when several can, without holding the scanner open', async () => {
            sendAccount.resolution = {
                kind: 'picker',
                accounts: [ETHEREUM_ACCOUNT, OTHER_ETHEREUM_ACCOUNT],
            }
            sendAccount.pick.mockResolvedValue(OTHER_ETHEREUM_ACCOUNT)
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            const { onSuccess } = await dispatch(ethereumTransfer.sourceUrl)

            expect(onSuccess).toHaveBeenCalledTimes(1)
            expect(sendAccount.pick).toHaveBeenCalledWith('ethereum', [
                ETHEREUM_ACCOUNT,
                OTHER_ETHEREUM_ACCOUNT,
            ])
            await vi.waitFor(() =>
                expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
                    'other-eth-account',
                ),
            )
            expect(mockRequestByType).toHaveBeenCalledWith(
                'send-funds',
                expect.anything(),
                expect.anything(),
            )
        })

        it('opens no send when the account picker is dismissed', async () => {
            sendAccount.resolution = {
                kind: 'picker',
                accounts: [ETHEREUM_ACCOUNT, OTHER_ETHEREUM_ACCOUNT],
            }
            sendAccount.pick.mockResolvedValue(undefined)
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            await dispatch(ethereumTransfer.sourceUrl)
            await act(async () => {})

            expect(accountsState.setSelectedAccountId).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
        })

        it('refuses a link naming a network other than its chain selected one, opening nothing', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                ...ethereumTransfer,
                target: { chainId: 'ethereum', networkId: 'testnet' },
            })

            const { onError } = await dispatch(ethereumTransfer.sourceUrl)

            expect(onError).toHaveBeenCalledTimes(1)
            expect(mockSetDestination).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalledWith(
                'deeplink.error.title_network_mismatch',
                'deeplink.error.body_network_mismatch',
            )
        })

        it('refuses a link whose chain has the capability off as not supported there', async () => {
            capabilityState.turnOff('send')
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)

            const { onError } = await dispatch(ethereumTransfer.sourceUrl)

            expect(onError).toHaveBeenCalledTimes(1)
            expect(mockRequestByType).not.toHaveBeenCalled()
            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalledWith(
                'deeplink.error.title_unsupported',
                'deeplink.error.body_unsupported_on_chain',
            )
        })

        it('refuses an opt-in on a chain whose assets need none as not supported', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.ASSET_OPT_IN,
                sourceUrl: 'ethereum:x',
                target: { chainId: 'ethereum' },
                assetRef: { chainId: 'ethereum', assetId: ETHEREUM_ADDRESS },
            })

            const { onError } = await dispatch('ethereum:x')

            expect(onError).toHaveBeenCalledTimes(1)
            expect(mockRequestByType).not.toHaveBeenCalled()
            await vi.advanceTimersByTimeAsync(400)
            expect(mockErrorToast).toHaveBeenCalledWith(
                'deeplink.error.title_unsupported',
                'deeplink.error.body_unsupported_on_chain',
            )
        })

        it('reports another chain link as valid and available', () => {
            ;(parseDeeplink as Mock).mockReturnValue(ethereumTransfer)
            const { result } = renderHook(() => useDeepLink())

            expect(result.current.isValidDeepLink('ethereum:x')).toBe(true)
            expect(result.current.isDeepLinkAvailable('ethereum:x')).toBe(true)
        })

        it.each(['algorand', 'ethereum'] as const)(
            'calls a link the %s adapter claims but cannot read invalid',
            chainId => {
                ;(parseDeeplink as Mock).mockReturnValue(null)
                deeplinkAdapters.register({ ...refusingAdapter, chainId })
                const { result } = renderHook(() => useDeepLink())

                expect(result.current.isValidDeepLink('refused:abc')).toBe(
                    false,
                )
            },
        )

        describe('when the chain recognises the link but refuses its action', () => {
            const actionRefusingAdapter: DeeplinkChainAdapter = {
                ...refusingAdapter,
                parse: () => ({ ok: false, reason: 'unsupported-action' }),
            }

            beforeEach(() => {
                ;(parseDeeplink as Mock).mockReturnValue(null)
                deeplinkAdapters.register(actionRefusingAdapter)
            })

            it('reports it as valid but unavailable', () => {
                const { result } = renderHook(() => useDeepLink())

                expect(result.current.isValidDeepLink('refused:approve')).toBe(
                    true,
                )
                expect(
                    result.current.isDeepLinkAvailable('refused:approve'),
                ).toBe(false)
            })

            it('refuses it as not supported on that chain', async () => {
                const { onError } = await dispatch('refused:approve')

                expect(onError).toHaveBeenCalledTimes(1)
                expect(mockRequestByType).not.toHaveBeenCalled()
                await vi.advanceTimersByTimeAsync(400)
                expect(mockErrorToast).toHaveBeenCalledWith(
                    'deeplink.error.title_unsupported',
                    'deeplink.error.body_unsupported_on_chain',
                )
            })
        })

        it('keeps calling text no adapter claims invalid', () => {
            ;(parseDeeplink as Mock).mockReturnValue(null)
            deeplinkAdapters.register(refusingAdapter)
            const { result } = renderHook(() => useDeepLink())

            expect(result.current.isValidDeepLink('hello')).toBe(false)
        })

        it('refuses a wrong-network link silently when it came from a notification', async () => {
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.ASSET_DETAIL,
                sourceUrl: 'ethereum:x',
                target: { chainId: 'ethereum', networkId: 'testnet' },
                address: ETHEREUM_ADDRESS,
                assetRef: { chainId: 'ethereum', assetId: 'native' },
            })

            const { onError } = await dispatch('ethereum:x', 'notification')
            await vi.advanceTimersByTimeAsync(450)

            expect(mockErrorToast).not.toHaveBeenCalled()
            expect(onError).toHaveBeenCalledTimes(1)
            expect(mockNavigate).not.toHaveBeenCalled()
        })

        it('matches a detail link to the account on the link chain', async () => {
            accountsState.accounts = [
                {
                    id: 'algo-account',
                    chains: { algorand: { address: 'shared' } },
                },
                {
                    id: 'eth-account',
                    chains: { ethereum: { address: 'shared' } },
                },
            ]
            ;(parseDeeplink as Mock).mockReturnValue({
                type: DeeplinkType.ACCOUNT_DETAIL,
                sourceUrl: 'perawallet://app',
                target: { chainId: 'ethereum' },
                address: 'shared',
            })

            await dispatch('perawallet://app')

            expect(accountsState.setSelectedAccountId).toHaveBeenCalledWith(
                'eth-account',
            )
        })

        describe('with an address more than one chain accepts', () => {
            const ALGORAND_ADDRESS =
                '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

            beforeEach(() => {
                addressCodecs.register({
                    ...addressCodecs.get('algorand'),
                    chainId: 'ethereum',
                })
                ;(parseDeeplink as Mock).mockReturnValue(null)
            })

            it('asks which chain, then offers that chain actions', async () => {
                mockRequestByType.mockResolvedValueOnce('ethereum')

                const { onSuccess } = await dispatch(ALGORAND_ADDRESS)

                expect(onSuccess).toHaveBeenCalledTimes(1)
                expect(mockRequestByType).toHaveBeenCalledWith(
                    'deeplink-chain-selection',
                    { chainIds: ['algorand', 'ethereum'] },
                    expect.anything(),
                )
                await vi.waitFor(() =>
                    expect(mockRequestByType).toHaveBeenCalledWith(
                        'account-actions',
                        {
                            address: ALGORAND_ADDRESS,
                            label: undefined,
                            chainId: 'ethereum',
                        },
                        expect.anything(),
                    ),
                )
            })

            it('offers nothing when the chain picker is dismissed', async () => {
                mockRequestByType.mockResolvedValueOnce(undefined)

                await dispatch(ALGORAND_ADDRESS)
                await act(async () => {})

                expect(mockRequestByType).toHaveBeenCalledTimes(1)
            })

            it('reports the address as a valid link', () => {
                const { result } = renderHook(() => useDeepLink())

                expect(result.current.isValidDeepLink(ALGORAND_ADDRESS)).toBe(
                    true,
                )
            })
        })
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

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
    })

    it('should handle initial URL error', async () => {
        ;(Linking.getInitialURL as Mock).mockRejectedValue(
            new Error('Test error'),
        )

        renderHook(() => useDeeplinkListener())

        await act(async () => {
            await Promise.resolve() // Wait for useEffect
        })

        expect(logger.debug).toHaveBeenCalledWith(
            'Deeplink: Error getting initial URL',
            { error: expect.any(Error) },
        )
    })

    it('should handle URL events', async () => {
        ;(parseDeeplink as Mock).mockReturnValue({
            type: DeeplinkType.HOME,
        })
        const mockAddListener = Linking.addEventListener as Mock
        renderHook(() => useDeeplinkListener())

        const callback = mockAddListener.mock.calls[0][1]

        await act(async () => {
            callback({ url: 'perawallet://app' })
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: { screen: 'AccountDetails' },
        })
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

        expect(mockNavigate).not.toHaveBeenCalled()
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
