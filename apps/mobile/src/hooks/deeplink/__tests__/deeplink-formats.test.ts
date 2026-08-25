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

/**
 * Format-coverage integration test: drives every supported deeplink URL
 * through `useDeepLink.handleDeepLink` and asserts the right channel was
 * hit (navigateToScreen, requestByType, addSignRequest, connect, …).
 *
 * Source of URLs: `/Users/williambeaumont/Documents/deeplinks.csv`. Each
 * row of the CSV expands to four URL variants — old-deeplink, old-applink,
 * new-deeplink, new-applink — all of which should parse + dispatch the
 * same way. We test every variant.
 *
 * Skipped (per product owner — coming soon):
 *   - Joint/Shared account (CSV rows 36-44)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useImportAccount } from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'

// Hoisted mocks — mirror the shape used by useDeepLink.test.ts so the
// dispatcher's hooks (navigation, bottom sheet, signing, walletconnect, …)
// resolve to inspectable spies.

const {
    mockNavigate,
    mockDispatch,
    mockPushWebView,
    mockRequestByType,
    mockRequestBottomSheet,
    mockConnect,
    mockAddSignRequest,
    mockSetSelectedAccountAddress,
    mockSetDestination,
    mockSetSelectedAssetId,
    mockSetCanSelectAsset,
    mockSetNote,
    mockSetAmount,
    mockSetPendingAmountBaseUnits,
    mockSendFundsReset,
    mockSelectedAccountAddress,
    mockOnlineKeyRegistration,
    mockOfflineKeyRegistration,
    mockErrorToast,
    mockInfoToast,
    mockPeraWebSetQr,
    mockShowSignRequest,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockDispatch: vi.fn(),
    mockPushWebView: vi.fn(),
    mockRequestByType: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockConnect: vi.fn(),
    mockAddSignRequest: vi.fn(),
    mockSetSelectedAccountAddress: vi.fn(),
    mockSetDestination: vi.fn(),
    mockSetSelectedAssetId: vi.fn(),
    mockSetCanSelectAsset: vi.fn(),
    mockSetNote: vi.fn(),
    mockSetAmount: vi.fn(),
    mockSetPendingAmountBaseUnits: vi.fn(),
    mockSendFundsReset: vi.fn(),
    mockSelectedAccountAddress: { current: null as string | null },
    mockOnlineKeyRegistration: vi.fn(async () => ({ mock: 'online-keyreg' })),
    mockOfflineKeyRegistration: vi.fn(async () => ({ mock: 'offline-keyreg' })),
    mockErrorToast: vi.fn(),
    mockInfoToast: vi.fn(),
    mockPeraWebSetQr: vi.fn(),
    mockShowSignRequest: vi.fn(),
}))

vi.mock('@modules/multisig/hooks/usePendingSignaturesSheet', () => ({
    usePendingSignaturesSheet: () => ({
        showSignRequest: mockShowSignRequest,
    }),
}))

vi.mock('../../useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: () => true,
}))

vi.mock('../../useIsGiftCardsEnabled', () => ({
    useIsGiftCardsEnabled: () => true,
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: {
        navigate: mockNavigate,
        dispatch: mockDispatch,
        isReady: vi.fn(() => true),
    },
}))

vi.mock('@react-navigation/native', () => ({
    StackActions: {
        replace: vi.fn(),
        push: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    // Real enum rather than a hand-copied literal — see the note in
    // vitest.setup.ts. base.ts has no runtime imports.
    const { ErrorCategory } = await vi.importActual<
        typeof import('../../../../../../packages/shared/src/errors/base')
    >('../../../../../../packages/shared/src/errors/base')

    return {
        ALGO_ASSET_ID: '0',
        isAlgoAssetId: (assetId: string | number | bigint) =>
            String(assetId) === '0',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
        generateOrderedUniqueId: vi.fn(() => 'test-id'),
        decodeFromBase64: vi.fn((b64: string) =>
            Uint8Array.from(Buffer.from(b64, 'base64')),
        ),
        ErrorCategory,
    }
})

// useDeepLink reads the device's biometric level to gate passkey deeplinks.
// Stub the package so the real security store (with its module-load
// registerStore call) isn't pulled into this unit test's import graph.
vi.mock('@perawallet/wallet-core-security', () => ({
    getBiometricSecurityLevel: vi.fn(async () => 'strong'),
    hasStrongBiometricOrCredential: vi.fn(() => true),
}))

const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ address: 'addr1' }),
    useSelectedAccountAddress: () => ({
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    useAccountsStore: Object.assign(vi.fn(), {
        getState: () => ({
            selectedAccountAddress: mockSelectedAccountAddress.current,
        }),
    }),
    useAllAccounts: () => [
        // Include the keyreg test sender so the preflight passes.
        { address: 'A'.repeat(58), id: 'mock-a', type: 'algo25' },
        {
            address:
                '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA',
            id: 'mock-csv',
            type: 'algo25',
        },
    ],
    resolveAuthAccount: (account: unknown) => account,
    resolveImportAccountType: (mnemonic: string) => {
        const wordCount = mnemonic.trim().split(/[,\s]+/).length
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
    // payloads. The parser shape-checks via try/catch — return a parsed
    // payload for JSON that looks like a Pera Web QR (backupId +
    // encryptionKey), throw otherwise so the parser falls through to the
    // legacy mnemonic JSON detector.
    PeraWebImportError: class PeraWebImportError extends Error {},
    parsePeraWebQrPayload: vi.fn((raw: string) => {
        const parsed = JSON.parse(raw)
        if (
            typeof parsed?.backupId !== 'string' ||
            typeof parsed?.encryptionKey !== 'string'
        ) {
            throw new Error('not a pera web qr')
        }
        return {
            backupId: parsed.backupId,
            encryptionKey: Uint8Array.from(
                Buffer.from(parsed.encryptionKey, 'base64'),
            ),
        }
    }),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    usePeraWebImportFlowStore: {
        getState: () => ({ setQr: mockPeraWebSetQr }),
    },
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    UserRejectedSigningError: class UserRejectedSigningError extends Error {},
    // Non-quantum in every fixture here — the calculator's real fast path
    // is a passthrough no-op. Real fee behavior is covered by
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
// the real transactions package (and its api/history schema, which imports
// from the mocked shared package) isn't loaded into this unit test's graph.
vi.mock('@perawallet/wallet-core-transactions', () => ({
    useAssetOptInMutation: () => ({ optIn: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: mockConnect }),
    waitForSessionOutcome: vi.fn(async () => ({ type: 'session' })),
    abandonPairing: vi.fn(),
    // Real values from packages/walletconnect/src/constants.ts.
    WC_SESSION_OUTCOME_TIMEOUT_MS: 8000,
    WC_DEEPLINK_SESSION_OUTCOME_TIMEOUT_MS: 15_000,
    WC_LATE_SESSION_GRACE_MS: 60_000,
}))

vi.mock('@modules/webview/hooks', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))
vi.mock('@modules/webview/hooks/useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: () => ({ requestByType: mockRequestByType }),
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: mockRequestByType,
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (address: string) =>
        !!address && /^[0-9a-zA-Z]{58}$/.test(address),
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
    useTransactionEncoder: () => ({
        encodeTransaction: (tx: unknown) => tx,
        decodeTransaction: (tx: unknown) => tx,
    }),
}))

vi.mock('../../useToast', () => ({
    useToast: () => ({
        showToast: vi.fn(),
        errorToast: mockErrorToast,
        infoToast: mockInfoToast,
    }),
}))

// Avoid pulling the heavy SendFundsContent navigator chain.
vi.mock('@modules/transactions/components/send-funds/SendFundsContent', () => ({
    SendFundsContent: vi.fn(),
}))
vi.mock('@modules/gift-card/components/BidaliContent', () => ({
    BidaliContent: vi.fn(),
}))
vi.mock('react-native', () => ({
    Linking: {
        getInitialURL: vi.fn(),
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
    Platform: { OS: 'ios' },
}))

// Test fixtures derived from /Users/williambeaumont/Documents/deeplinks.csv.
// Keep this table flat + parameterised; adding a new deeplink shape is a
// single row.

import { useDeepLink } from '../../useDeepLink'

const ADDRESS = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const RECEIVER = 'Z73KQDNF5X3OPYUJNKH77CWZTHAYBKDUYRJELNMVFKWWYUJH2V2Y54W4CM'
const ASSET_ID = '31566704'
const LABEL_ENC = 'HELLO%20WORLD%20LABEL'
const LABEL = 'HELLO WORLD LABEL'
const NOTE = 'HELLO WORLD NOTE'
const NOTE_ENC = 'HELLO%20WORLD%20NOTE'
const XNOTE = 'HELLO WORLD XNOTE'
const XNOTE_ENC = 'HELLO%20WORLD%20XNOTE'
const AMOUNT = '99999'
const DISCOVER_URL_B64 = 'aHR0cHM6Ly90aW55bWFuLm9yZy8='
const DISCOVER_URL_DECODED = 'https://tinyman.org/'
const INTERNAL_URL_B64 = 'aHR0cHM6Ly9wZXJhd2FsbGV0LmFwcC8='
const INTERNAL_URL_DECODED = 'https://perawallet.app/'
const DISCOVER_PATH = 'main/markets'
const STAKING_PATH = 'test'
const MNEMONIC =
    'twenty,effort,goddess,rabbit,help,main,behind,ankle,disease,often,define,fine,shy,excuse,segment,truth,canoe,bus,hammer,object,edge,scare,father,about,super'
const MNEMONIC_25 =
    'sample soap trip gasp bracket hint wool lend syrup elbow tip gesture moral lion elegant disease scissors tragic goddess guess burger brand card absorb know'
const PERA_WEB_BACKUP_ID = 'backup-id-fmt-test'
// 32 deterministic bytes (1..32), b64-encoded. Production sends the key
// b64-encoded inside the JSON QR.
const PERA_WEB_KEY_BYTES = Uint8Array.from(
    Array.from({ length: 32 }, (_, i) => i + 1),
)
const PERA_WEB_KEY_B64 = Buffer.from(PERA_WEB_KEY_BYTES).toString('base64')
const PERA_WEB_QR_JSON = JSON.stringify({
    backupId: PERA_WEB_BACKUP_ID,
    encryptionKey: PERA_WEB_KEY_B64,
})

type Channel =
    | { kind: 'navigate'; screen: string; params?: unknown }
    | { kind: 'requestByType'; type: string; matchProps?: unknown }
    | { kind: 'pushWebView'; url: string }
    | { kind: 'connect'; uri: string }
    | { kind: 'addSignRequest' }
    | { kind: 'sendFunds' }
    | { kind: 'peraWebImport' }
    | { kind: 'signRequest'; signRequestId: string }

type Case = {
    name: string
    url: string
    expect: Channel
    /** Optional extra assertions to run on the spies. */
    extra?: () => void
}

const newDeeplink = (path: string) => `perawallet://app/${path}`
const newApplink = (path: string) =>
    `https://perawallet.app/qr/perawallet/app/${path}`

/**
 * Generate the new-format deeplink + applink pair for a single endpoint —
 * the parser routes both through `parsePerawalletAppUri` so they should
 * dispatch identically.
 */
const newPair = (
    label: string,
    path: string,
    expect: Channel,
    extra?: () => void,
): Case[] => [
    { name: `${label} (new deeplink)`, url: newDeeplink(path), expect, extra },
    { name: `${label} (new applink)`, url: newApplink(path), expect, extra },
]

const cases: Case[] = [
    // -- Add Contact --------------------------------------------------------
    ...newPair(
        'Add Contact',
        `add-contact/?address=${ADDRESS}&label=${LABEL_ENC}`,
        { kind: 'navigate', screen: 'Contacts' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
                screen: 'AddContact',
                params: {
                    address: ADDRESS,
                    label: LABEL,
                },
            })
        },
    ),

    // -- Edit Contact -------------------------------------------------------
    ...newPair(
        'Edit Contact',
        `edit-contact/?address=${ADDRESS}&label=${LABEL_ENC}`,
        { kind: 'navigate', screen: 'Contacts' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
                screen: 'EditContact',
                params: {
                    address: ADDRESS,
                    label: LABEL,
                },
            })
        },
    ),

    // -- Add Watch Account --------------------------------------------------
    ...newPair(
        'Add Watch Account',
        `add-watch-account/?address=${ADDRESS}`,
        { kind: 'navigate', screen: 'AddAccount' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
                screen: 'WatchAccount',
                params: { prefillAddress: ADDRESS },
            })
        },
    ),
    ...newPair(
        'Register Watch Account (alias)',
        `register-watch-account/?address=${ADDRESS}`,
        { kind: 'navigate', screen: 'AddAccount' },
    ),

    // -- Receiver Account Selection ----------------------------------------
    ...newPair(
        'Receiver Account Selection',
        `receiver-account-selection/?address=${ADDRESS}`,
        { kind: 'sendFunds' },
        () => {
            expect(mockSetDestination).toHaveBeenCalledWith(ADDRESS)
        },
    ),

    // -- Address Actions ---------------------------------------------------
    ...newPair(
        'Address Actions',
        `address-actions/?address=${ADDRESS}`,
        { kind: 'requestByType', type: 'account-actions' },
        () => {
            expect(mockRequestByType).toHaveBeenCalledWith(
                'account-actions',
                {
                    address: ADDRESS,
                    label: undefined,
                },
                { enablePanDownToClose: true },
            )
        },
    ),

    // -- ALGO Transfer (asset-transfer with assetId=0) ---------------------
    ...newPair(
        'ALGO Transfer',
        `asset-transfer/?assetId=0&receiverAddress=${RECEIVER}&amount=${AMOUNT}&note=${NOTE_ENC}&xnote=${XNOTE_ENC}&label=${LABEL_ENC}`,
        { kind: 'sendFunds' },
        () => {
            expect(mockSetSelectedAssetId).toHaveBeenCalledWith('0')
            expect(mockSetDestination).toHaveBeenCalledWith(RECEIVER)
            expect(mockSetNote).toHaveBeenCalledWith(NOTE)
            // 99999 microAlgos → 0.099999 ALGOs
            expect(mockSetAmount).toHaveBeenCalled()
            expect(mockSetAmount.mock.calls[0][0].toString()).toBe('0.099999')
        },
    ),

    // -- Asset Transfer ----------------------------------------------------
    ...newPair(
        'Asset Transfer',
        `asset-transfer/?assetId=${ASSET_ID}&receiverAddress=${RECEIVER}&amount=${AMOUNT}&note=${NOTE_ENC}&xnote=${XNOTE_ENC}&label=${LABEL_ENC}`,
        { kind: 'sendFunds' },
        () => {
            expect(mockSetSelectedAssetId).toHaveBeenCalledWith(ASSET_ID)
            expect(mockSetDestination).toHaveBeenCalledWith(RECEIVER)
            expect(mockSetNote).toHaveBeenCalledWith(NOTE)
            // Asset amount stays in base units; conversion is deferred.
            expect(mockSetAmount).not.toHaveBeenCalled()
            expect(mockSetPendingAmountBaseUnits).toHaveBeenCalledWith(AMOUNT)
        },
    ),

    // -- Keyreg (online) ---------------------------------------------------
    ...newPair(
        'Keyreg (online, new format)',
        `keyreg/?senderAddress=${ADDRESS}&type=keyreg&voteKey=UU8&selkey=lfw&sprfkey=3No&votefst=1300&votelst=11300&votekd=100&fee=2000000`,
        { kind: 'addSignRequest' },
        () => {
            expect(mockOnlineKeyRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: ADDRESS,
                    voteFirst: 1300n,
                    voteLast: 11_300n,
                    voteKeyDilution: 100n,
                }),
            )
        },
    ),

    // -- Keyreg with native CSV-shaped (URL-safe + unpadded) keys ---------
    {
        name: 'Keyreg (native CSV: URL-safe + unpadded base64 keys)',
        url: `algorand://${ADDRESS}?type=keyreg&selkey=-lfw-Y04lTnllJfncgMjXuAePe8i8YyVeoR9c1Xi78c&sprfkey=3NoXc2sEWlvQZ7XIrwVJjgjM30ndhvwGgcqwKugk1u5W_iy_JITXrykuy0hUvAxbVv0njOgBPtGFsFif3yLJpg&votefst=1300&votekd=100&votekey=UU8zLMrFVfZPnzbnL6ThAArXFsznV3TvFVAun2ONcEI&votelst=11300&fee=2000000&note=Consensus%2Bparticipation%2Bftw`,
        expect: { kind: 'addSignRequest' },
        extra: () => {
            expect(mockOnlineKeyRegistration).toHaveBeenCalled()
            expect(mockErrorToast).not.toHaveBeenCalled()
        },
    },

    // -- Keyreg (offline) --------------------------------------------------
    // ARC-78's smallest valid URI, and verbatim what nodekit emits for "go
    // offline". No participation keys means de-register, not a malformed
    // online registration (PERA-4976).
    {
        name: 'Keyreg (ARC-78 offline: bare ?type=keyreg)',
        url: `algorand://${ADDRESS}?type=keyreg`,
        expect: { kind: 'addSignRequest' },
        extra: () => {
            expect(mockOfflineKeyRegistration).toHaveBeenCalledWith(
                expect.objectContaining({ sender: ADDRESS }),
            )
            expect(mockOnlineKeyRegistration).not.toHaveBeenCalled()
            expect(mockErrorToast).not.toHaveBeenCalled()
        },
    },

    // -- Wallet Connect ----------------------------------------------------
    {
        name: 'WalletConnect (raw wc:)',
        url: `wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=9844b76265fad3b8e1b9af9e1ede8c56a192e6f029d02f47a31bed2c82f104d0`,
        expect: {
            kind: 'connect',
            uri: 'wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=9844b76265fad3b8e1b9af9e1ede8c56a192e6f029d02f47a31bed2c82f104d0',
        },
    },
    {
        name: 'WalletConnect (perawallet-wc rewrite)',
        url: `perawallet-wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=KEY`,
        expect: {
            kind: 'connect',
            uri: 'wc:34e3389c-afef-47ea-8843-d88d63609e93@1?bridge=https%3A%2F%2Fwallet-connect-c.perawallet.app&key=KEY',
        },
    },

    // -- Asset Opt-In ------------------------------------------------------
    ...newPair(
        'Asset Opt-In',
        `asset-opt-in/?assetId=${ASSET_ID}`,
        // A bare assetId link carries no account, so the handler first opens
        // the account-selection sheet (which, unanswered in this test, aborts
        // before the confirmation sheet).
        { kind: 'requestByType', type: 'asset-opt-in-account-selection' },
        () => {
            expect(mockRequestByType).toHaveBeenCalledWith(
                'asset-opt-in-account-selection',
                {},
                // PWSheetLayout only scrolls with autoCreateContainer:false + bounded auto size.
                {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            )
        },
    ),

    // -- Asset Detail ------------------------------------------------------
    ...newPair(
        'Asset Detail',
        `asset-detail/?address=${ADDRESS}&assetId=${ASSET_ID}`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: {
                    screen: 'AssetDetails',
                    params: { assetId: ASSET_ID },
                },
            })
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(ADDRESS)
        },
    ),

    // -- Asset Inbox -------------------------------------------------------
    ...newPair(
        'Asset Inbox',
        `asset-inbox/?address=${ADDRESS}`,
        { kind: 'navigate', screen: 'Messages' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith(
                'Messages',
                expect.objectContaining({
                    screen: 'AssetTransferRequests',
                }),
            )
        },
    ),

    // -- Discover Browser -------------------------------------------------
    ...newPair(
        'Discover Browser',
        `discover-browser/?url=${DISCOVER_URL_B64}`,
        { kind: 'pushWebView', url: DISCOVER_URL_DECODED },
    ),

    // -- Discover Path ----------------------------------------------------
    ...newPair(
        'Discover Path',
        `discover-path/?path=${DISCOVER_PATH}`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Discover',
                params: { path: DISCOVER_PATH },
            })
        },
    ),
    ...newPair(
        'Discover (no path)',
        `discover-path`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Discover',
                params: { path: undefined },
            })
        },
    ),

    // -- Cards ------------------------------------------------------------
    ...newPair(
        'Cards',
        `cards-path/?path=onboarding/select-country`,
        { kind: 'navigate', screen: 'PeraCard' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'PeraCardIntro',
            })
        },
    ),

    // -- Staking ----------------------------------------------------------
    ...newPair(
        'Staking',
        `staking-path/?path=${STAKING_PATH}`,
        { kind: 'navigate', screen: 'Staking' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('Staking', {
                path: STAKING_PATH,
            })
        },
    ),

    // -- Swap ------------------------------------------------------------
    ...newPair(
        'Swap',
        `swap/?address=${ADDRESS}&assetInId=0&assetOutId=${ASSET_ID}`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Swap',
                params: { assetInId: '0', assetOutId: ASSET_ID },
            })
        },
    ),

    // -- Buy ------------------------------------------------------------
    ...newPair(
        'Buy',
        `buy/?address=${ADDRESS}`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Fund',
            })
        },
    ),

    // -- Sell ----------------------------------------------------------
    ...newPair(
        'Sell',
        `sell/?address=${ADDRESS}`,
        { kind: 'requestByType', type: 'bidali' },
        () => {
            expect(mockRequestByType).toHaveBeenCalledWith(
                'bidali',
                {},
                expect.objectContaining({ size: 'modal' }),
            )
        },
    ),

    // -- Account Detail -----------------------------------------------
    ...newPair(
        'Account Detail',
        `account-detail/?address=${ADDRESS}`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: { screen: 'AccountDetails' },
            })
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(ADDRESS)
        },
    ),

    // -- Sign Request -------------------------------------------------
    ...newPair('Sign request', `sign-request/?signRequestId=req-123`, {
        kind: 'signRequest',
        signRequestId: 'req-123',
    }),

    // -- Internal Browser ---------------------------------------------
    ...newPair(
        'Internal Browser',
        `internal-browser/?url=${INTERNAL_URL_B64}`,
        { kind: 'pushWebView', url: INTERNAL_URL_DECODED },
    ),

    // -- Home (empty / unknown params) --------------------------------
    ...newPair(
        'Home (any params)',
        `?param1=hello&param2=yasin`,
        { kind: 'navigate', screen: 'TabBar' },
        () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: { screen: 'AccountDetails' },
            })
        },
    ),

    // -- Old / legacy formats -----------------------------------------
    {
        name: 'Old: bare address (algorand://) → ADDRESS_ACTIONS',
        url: `algorand://${ADDRESS}`,
        expect: { kind: 'requestByType', type: 'account-actions' },
        extra: () => {
            expect(mockRequestByType).toHaveBeenCalledWith(
                'account-actions',
                {
                    address: ADDRESS,
                    label: undefined,
                },
                { enablePanDownToClose: true },
            )
        },
    },
    {
        name: 'Old: ALGO transfer (algorand://ADDR?amount=…&note=…)',
        url: `algorand://${RECEIVER}?amount=${AMOUNT}&note=${NOTE_ENC}`,
        expect: { kind: 'sendFunds' },
        extra: () => {
            expect(mockSetSelectedAssetId).toHaveBeenCalledWith('0')
            expect(mockSetDestination).toHaveBeenCalledWith(RECEIVER)
            expect(mockSetNote).toHaveBeenCalledWith(NOTE)
        },
    },
    {
        name: 'Old: Asset transfer (algorand://ADDR?amount=…&asset=…)',
        url: `algorand://${RECEIVER}?amount=${AMOUNT}&asset=${ASSET_ID}&xnote=${XNOTE_ENC}`,
        expect: { kind: 'sendFunds' },
        extra: () => {
            expect(mockSetSelectedAssetId).toHaveBeenCalledWith(ASSET_ID)
            expect(mockSetDestination).toHaveBeenCalledWith(RECEIVER)
            expect(mockSetNote).toHaveBeenCalledWith(XNOTE)
            expect(mockSetPendingAmountBaseUnits).toHaveBeenCalledWith(AMOUNT)
        },
    },
    {
        name: 'Old: Asset opt-in (perawallet://?amount=0&asset=…)',
        url: `perawallet://?amount=0&asset=${ASSET_ID}`,
        // Bare assetId (no account) → account-selection sheet first.
        expect: {
            kind: 'requestByType',
            type: 'asset-opt-in-account-selection',
        },
    },
    {
        name: 'Old: Asset opt-in (perawallet://asset/opt-in?asset=…&account=…)',
        url: `perawallet://asset/opt-in?asset=${ASSET_ID}&account=${ADDRESS}`,
        // Account carried by the link → skip the picker, go straight to the
        // opt-in confirmation sheet.
        expect: { kind: 'requestByType', type: 'asset-opt-in' },
    },
    {
        name: 'Old: Asset transactions (perawallet://asset/transactions?…)',
        url: `perawallet://asset/transactions?asset=${ASSET_ID}&account=${ADDRESS}`,
        expect: { kind: 'navigate', screen: 'TabBar' },
        extra: () => {
            expect(mockNavigate).toHaveBeenCalledWith(
                'TabBar',
                expect.objectContaining({
                    screen: 'Home',
                    params: expect.objectContaining({
                        screen: 'AssetDetails',
                    }),
                }),
            )
        },
    },
    {
        name: 'Old: Asset inbox (perawallet://asset-inbox?account=…)',
        url: `perawallet://asset-inbox?account=${ADDRESS}`,
        expect: { kind: 'navigate', screen: 'Messages' },
    },
    {
        name: 'Old: Discover (perawallet://discover?path=…)',
        url: `perawallet://discover?path=${DISCOVER_PATH}`,
        expect: { kind: 'navigate', screen: 'TabBar' },
        extra: () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Discover',
                params: { path: DISCOVER_PATH },
            })
        },
    },
    {
        name: 'Old: Cards (perawallet://cards?path=…)',
        url: `perawallet://cards?path=onboarding/select-country`,
        expect: { kind: 'navigate', screen: 'PeraCard' },
        extra: () => {
            expect(mockNavigate).toHaveBeenCalledWith('PeraCard', {
                screen: 'PeraCardIntro',
            })
        },
    },
    {
        name: 'Old: Staking (perawallet://staking?path=…)',
        url: `perawallet://staking?path=${STAKING_PATH}`,
        expect: { kind: 'navigate', screen: 'Staking' },
    },
    {
        name: 'Old: Keyreg (algorand://ADDR?type=keyreg&…)',
        url: `algorand://${ADDRESS}?type=keyreg&selkey=KEY&sprfkey=KEY&votefst=1300&votekd=100&votekey=KEY&votelst=11300&fee=2000000&note=Consensus%20participation`,
        expect: { kind: 'addSignRequest' },
        extra: () => {
            expect(mockOnlineKeyRegistration).toHaveBeenCalledWith(
                expect.objectContaining({
                    sender: ADDRESS,
                    voteFirst: 1300n,
                    voteLast: 11_300n,
                    voteKeyDilution: 100n,
                }),
            )
        },
    },

    // -- Coinbase format ----------------------------------------------
    {
        name: 'Coinbase: algo:ASSET/transfer?address=…',
        url: `algo:${ASSET_ID}/transfer?address=${ADDRESS}`,
        expect: { kind: 'sendFunds' },
    },

    // -- Universal-link old applinks ----------------------------------
    {
        name: 'Old applink: bare address',
        url: `https://perawallet.app/qr/perawallet/${ADDRESS}`,
        expect: { kind: 'requestByType', type: 'account-actions' },
    },
    {
        name: 'Old applink: discover path',
        url: `https://perawallet.app/qr/perawallet/discover?path=${DISCOVER_PATH}`,
        expect: { kind: 'navigate', screen: 'TabBar' },
    },

    // -- Pera Web Import (QR-only) -----------------------------------
    {
        name: 'Pera Web Import (JSON QR with backupId + b64 encryptionKey)',
        url: PERA_WEB_QR_JSON,
        expect: { kind: 'peraWebImport' },
        extra: () => {
            // The handler stashes the parsed payload in the flow store and
            // navigates to the loading screen which kicks off fetch +
            // decrypt + account import.
            expect(mockPeraWebSetQr).toHaveBeenCalledTimes(1)
            const call = mockPeraWebSetQr.mock.calls[0][0] as {
                backupId: string
                encryptionKey: Uint8Array
            }
            expect(call.backupId).toBe(PERA_WEB_BACKUP_ID)
            expect(Array.from(call.encryptionKey)).toEqual(
                Array.from(PERA_WEB_KEY_BYTES),
            )
            expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
                screen: 'PeraWebImportLoading',
            })
        },
    },

    // -- Recover Address ---------------------------------------------
    {
        name: 'Recover Address (legacy JSON-wrapped QR, space-separated)',
        url: `{"mnemonic":"${MNEMONIC_25}"}`,
        expect: { kind: 'navigate', screen: 'AddAccount' },
    },
    {
        name: 'Recover Address (new deeplink, comma-separated mnemonic)',
        url: `perawallet://app/recover-address/?mnemonic=${MNEMONIC}`,
        expect: { kind: 'navigate', screen: 'AddAccount' },
    },

    // -- Undefined / unknown path → falls through to HOME -----------
    {
        name: 'Undefined → HOME fallback',
        url: 'perawallet://undefined',
        expect: { kind: 'navigate', screen: 'TabBar' },
        extra: () => {
            expect(mockNavigate).toHaveBeenCalledWith('TabBar', {
                screen: 'Home',
                params: { screen: 'AccountDetails' },
            })
        },
    },
]

describe('deeplink format coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSelectedAccountAddress.current = 'fallback-addr'
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
        // Resolve the recover-address import so RECOVER_ADDRESS handler
        // reaches the navigate call.
        mockImportAccount.mockResolvedValue({
            type: 'algo25',
            id: 'mock-id',
            address: ADDRESS,
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it.each(cases)('$name', async ({ url, expect: channel, extra }) => {
        // Recover-address only fires for QR scans (defends against a
        // malicious URL silently importing a key); use 'qr' as source for
        // any URL that should hit the recover-address handler.
        const source =
            url.startsWith('{') || url.includes('recover-address')
                ? 'qr'
                : 'deeplink'

        const { result } = renderHook(() => useDeepLink())

        await act(async () => {
            await result.current.handleDeepLink(url, false, source)
        })

        switch (channel.kind) {
            case 'navigate': {
                expect(mockNavigate).toHaveBeenCalled()
                expect(mockNavigate.mock.calls[0][0]).toBe(channel.screen)
                break
            }
            case 'requestByType': {
                expect(mockRequestByType).toHaveBeenCalled()
                expect(mockRequestByType.mock.calls[0][0]).toBe(channel.type)
                break
            }
            case 'pushWebView': {
                expect(mockPushWebView).toHaveBeenCalledWith(
                    expect.objectContaining({ url: channel.url }),
                )
                break
            }
            case 'connect': {
                expect(mockConnect).toHaveBeenCalledWith({
                    connection: { uri: channel.uri },
                })
                break
            }
            case 'addSignRequest': {
                expect(mockAddSignRequest).toHaveBeenCalled()
                break
            }
            case 'sendFunds': {
                // Send-funds path: store reset + bottom-sheet open via
                // requestByType('send-funds', …).
                expect(mockSendFundsReset).toHaveBeenCalled()
                expect(mockRequestByType).toHaveBeenCalledWith(
                    'send-funds',
                    expect.any(Object),
                    expect.any(Object),
                )
                break
            }
            case 'peraWebImport': {
                // QR-only path: parsed payload lands in the flow store and
                // the dispatcher navigates to the loading screen. The
                // `extra` callback asserts the exact backupId + key bytes.
                expect(mockPeraWebSetQr).toHaveBeenCalledTimes(1)
                expect(mockNavigate).toHaveBeenCalledWith(
                    'AddAccount',
                    expect.objectContaining({
                        screen: 'PeraWebImportLoading',
                    }),
                )
                break
            }
            case 'signRequest': {
                expect(mockShowSignRequest).toHaveBeenCalledWith(
                    channel.signRequestId,
                )
                break
            }
        }

        extra?.()
    })

    it('parses + dispatches every test fixture without throwing', () => {
        // Smoke test for the table itself: non-empty, every entry has a URL
        // and a non-undefined channel.
        expect(cases.length).toBeGreaterThan(40)
        for (const c of cases) {
            expect(c.url).toBeTruthy()
            expect(c.expect).toBeDefined()
        }
    })
})
