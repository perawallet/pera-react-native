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

import { vi } from 'vitest'

// Mock @perawallet/wallet-core-projects
vi.mock('@perawallet/wallet-core-projects', () => ({
    useProjectByUrlQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
    useApplicationQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

vi.mock('@perawallet/wallet-core-walletconnect', async () => {
    // The deep-link parser is a pure leaf the app needs for real. Loaded by path:
    // the package barrel registers stores at module-eval, which every spec's
    // minimal shared mock would then have to satisfy.
    const {
        isWalletConnectFocusHint,
        isWalletConnectScheme,
        parseWalletConnectUri,
    } = await vi.importActual<
        typeof import('@packages/walletconnect/src/shared/deeplink')
    >('@packages/walletconnect/src/shared/deeplink')
    return {
        isWalletConnectFocusHint,
        isWalletConnectScheme,
        parseWalletConnectUri,
        AlgorandWalletConnectChainId: {
            MainNet: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
            TestNet: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
        },
        AlgorandPermission: {
            TX_PERMISSION: 'algo_signTxn',
            DATA_PERMISSION: 'algo_signData',
        },
    }
})

vi.mock('@perawallet/wallet-core-swaps', async () => {
    const { Decimal } = await import('decimal.js')
    return {
        useSwaps: vi.fn(),
        isSwappableAsset: vi.fn(() => true),
        apiSlippageToPercent: (slippage: InstanceType<typeof Decimal>) =>
            slippage.mul(100).toString(),
        useProvidersQuery: vi.fn(() => ({ data: [] })),
        useSwapHistoryInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
    }
})

vi.mock('@perawallet/wallet-core-background', () => ({
    createSyncStorePorts: vi.fn(() => ({})),
    initializeSyncService: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(() => false),
    })),
    getSyncService: vi.fn(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        isRunning: vi.fn(() => false),
    })),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    // Default useKMS stub: provides every shape consumers destructure
    // (seedIdOf, sign helpers, etc.) so tests that don't care about the
    // KMS layer can render without rewiring. Suite-specific tests
    // override via their own vi.mock call.
    useKMS: vi.fn(() => ({
        keys: new Map(),
        seedIdOf: vi.fn(() => undefined),
        deleteKey: vi.fn(async () => {}),
        getKey: vi.fn(() => null),
        getKeyOrThrow: vi.fn(() => {
            throw new Error('Key not found (default mock)')
        }),
        createAlgo25Key: vi.fn(),
        createHDWalletKey: vi.fn(),
        persistHDMasterKey: vi.fn(),
        generateDerivedKey: vi.fn(),
        getDerivedPublicKey: vi.fn(),
        removeKeyAndChildren: vi.fn(async () => {}),
        keyStore: {},
        withExportedKey: vi.fn(),
        signTransactionsWithKey: vi.fn(async () => []),
        signDataWithKey: vi.fn(async () => []),
        executeWithMnemonic: vi.fn(),
    })),
    useKMSService: vi.fn(() => ({
        commitSecret: vi.fn(async () => {}),
        withSecret: vi.fn(async () => null),
        hasSecret: vi.fn(() => false),
        removeSecret: vi.fn(async () => {}),
    })),
    commitSecret: vi.fn(async () => {}),
    withSecret: vi.fn(async () => null),
    hasSecret: vi.fn(() => false),
    removeSecret: vi.fn(async () => {}),
    uniformIntBelow: (max: number) =>
        max <= 0 ? 0 : Math.floor(Math.random() * max),
    pickDistinctIndexes: (count: number, poolSize: number) => {
        const effective = Math.min(Math.max(count, 0), poolSize)
        const pool = Array.from({ length: poolSize }, (_, i) => i)
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[pool[i], pool[j]] = [pool[j], pool[i]]
        }
        return pool.slice(0, effective)
    },
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) {
            if (buf) buf.fill(0)
        }
    },
    // ASB key entry needs the BIP-39 wordlist to validate user input. Tests
    // don't exercise the full 2048-word list — a small placeholder is enough
    // to satisfy `new Set(MNEMONIC_WORDLIST)` at import time without dragging
    // the real wordlist into the test bundle.
    MNEMONIC_WORDLIST: ['abandon', 'ability', 'able', 'about'],
    // The real helpers map against the 2048-word list. Tests only need a
    // stable, injective index <-> word pair, so synthesize one rather than
    // pulling the full wordlist in alongside the placeholder above.
    mnemonicIndexToWord: (index: number) => `word-${index}`,
    // Mirrors the real contract: null when a token isn't a wordlist word.
    mnemonicWordsToIndices: (words: string[]) => {
        const indices = new Uint16Array(words.length)
        for (let i = 0; i < words.length; i++) {
            const synthesized = /^word-(\d+)$/.exec(words[i])
            const index = synthesized
                ? Number(synthesized[1])
                : ['abandon', 'ability', 'able', 'about'].indexOf(words[i])
            if (index < 0) return null
            indices[i] = index
        }
        return indices
    },
    // Seed-access origins consumed at import time by the signing pipeline and
    // the backup flow (SIGNING_KEY_DOMAIN, useMnemonicForAddress). kms is fully
    // stubbed here, so both the constant and its consumers read these values —
    // they stay self-consistent without the real module.
    SIGNING_ACCESS_DOMAIN: 'pera.accounts',
    BACKUP_ACCESS_DOMAIN: 'backup-flow',
}))

// Mock @perawallet/wallet-core-assets
vi.mock('@perawallet/wallet-core-assets', () => ({
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        Number(value) / Math.pow(10, asset.decimals),
    isCollectible: (asset: { peraMetadata?: { type?: string } }) =>
        asset.peraMetadata?.type === 'collectible',
    KNOWN_ASSET_IDS: {
        USDC: { mainnet: '31566704', testnet: '10458941' },
    },
    // `null`, not `''`, off the Pera-backed lane — mirroring the real
    // getKnownAssetId. An empty string is falsy but not null, so it routes
    // straight PAST every `=== null` guard the consumers now carry instead of
    // exercising it.
    getKnownAssetId: vi.fn((key: string, network: string) => {
        const ids: Record<string, Record<string, string>> = {
            USDC: { mainnet: '31566704', testnet: '10458941' },
        }
        return ids[key]?.[network] ?? null
    }),
    ALGO_ASSET: {
        assetId: '0',
        name: 'Algo',
        unitName: 'ALGO',
        decimals: 6,
        totalSupply: '10000000000000000',
        creator: { address: '' },
        peraMetadata: {
            isDeleted: false,
            verificationTier: 'verified',
            type: 'algo',
        },
    },
    PeraAssetType: {
        algo: 'algo',
        standard_asset: 'standard_asset',
        dapp_asset: 'dapp_asset',
        collectible: 'collectible',
    },
    PeraAssetVerificationTier: {
        verified: 'verified',
        unverified: 'unverified',
        suspicious: 'suspicious',
    },
    DEFAULT_ASSET_METADATA: {
        isDeleted: false,
        verificationTier: 'unverified',
        isFavorited: false,
        isPriceAlertEnabled: false,
    },
    useAssetPriceHistoryQuery: vi.fn(() => ({ data: [], isPending: false })),
    // The real hook resolves to a Map keyed by asset id, not an array.
    useAssetsQuery: vi.fn(() => ({ data: new Map(), isPending: false })),
    useAssetPricesQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
    useSingleAssetDetailsQuery: vi.fn(() => ({ data: null, isPending: false })),
    useInvalidateAssetPrices: vi.fn(() => ({ invalidate: vi.fn() })),
    useToggleAssetFavoriteMutation: vi.fn(() => ({
        toggleAssetFavorite: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: false,
    })),
    useToggleAssetPriceAlertMutation: vi.fn(() => ({
        toggleAssetPriceAlert: vi.fn(),
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: false,
    })),
    useAssetSearchQuery: vi.fn(() => ({
        results: [],
        isLoading: false,
        isError: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
    })),
    AssetSortModes: {
        balanceDesc: 'balanceDesc',
        balanceAsc: 'balanceAsc',
        alphabeticalAsc: 'alphabeticalAsc',
        alphabeticalDesc: 'alphabeticalDesc',
    },
    useAssetPreferencesStore: vi.fn((selector: (s: any) => any) =>
        selector({
            assetSortMode: 'balanceDesc',
            hideZeroBalance: false,
            displayNfts: true,
            displayOptedInNfts: true,
            setAssetSortMode: vi.fn(),
            setHideZeroBalance: vi.fn(),
            setDisplayNfts: vi.fn(),
            setDisplayOptedInNfts: vi.fn(),
            resetState: vi.fn(),
        }),
    ),
    useCollectiblePreferencesStore: vi.fn((selector: (s: any) => any) =>
        selector({
            collectibleSortMode: 'newestFirst',
            showOptedIn: false,
            showWatchAccounts: false,
            setCollectibleSortMode: vi.fn(),
            setShowOptedIn: vi.fn(),
            setShowWatchAccounts: vi.fn(),
            resetState: vi.fn(),
        }),
    ),
}))

// Mock @perawallet/wallet-core-settings
vi.mock('@perawallet/wallet-core-settings', () => {
    return {
        useSettings: vi.fn(() => ({
            theme: 'light',
            privacyMode: false,
            confirmationMode: 'slide',
            setPrivacyMode: vi.fn(),
            setTheme: vi.fn(),
            setConfirmationMode: vi.fn(),
        })),
        usePreferences: vi.fn(() => ({
            getPreference: vi.fn(),
            setPreference: vi.fn(),
        })),
        useNotificationPreferences: vi.fn(() => ({
            disabledAccounts: [],
            setAccountEnabled: vi.fn(),
            isAccountEnabled: vi.fn(() => true),
        })),
    }
})

// Mock @perawallet/wallet-core-accounts
vi.mock('@perawallet/wallet-core-accounts', () => {
    return {
        useAllAccounts: vi.fn(() => []),
        useAccountDiscovery: vi.fn(() => ({
            discoverRekeyedAccounts: vi.fn(),
        })),
        useAccountBalancesQuery: vi.fn(() => ({ data: [], isPending: false })),
        useAccountOptInRoundsQuery: vi.fn(() => ({
            optInRounds: new Map(),
            isPending: false,
        })),
        useSelectedAccount: vi.fn(() => null),
        useSelectedAccountAddress: vi.fn(() => ({
            selectedAccountAddress: null,
            setSelectedAccountAddress: vi.fn(),
        })),
        useSetAccounts: vi.fn(() => ({
            setAccounts: vi.fn(),
        })),
        useAccountBalancesHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
        })),
        useAccountsAssetsBalanceHistoryQuery: vi.fn(() => ({
            data: [],
            isPending: false,
        })),
        getAccountDisplayName: vi.fn(a => a?.name || ''),
        // Account type functions with actual implementations
        isHardwareWalletAccount: vi.fn(
            (account: any) => account?.type === 'hardware',
        ),
        isLedgerAccount: vi.fn(
            (account: any) =>
                account?.type === 'hardware' &&
                account?.hardwareDetails?.manufacturer === 'ledger',
        ),
        isRekeyedAccount: vi.fn((account: any) => !!account?.rekeyAddress),
        isHDWalletAccount: vi.fn((account: any) => !!account?.hdWalletDetails),
        isAlgo25Account: vi.fn((account: any) => account?.type === 'algo25'),
        isWatchAccount: vi.fn((account: any) => account?.type === 'watch'),
        isMultisigAccount: vi.fn(
            (account: any) => account?.type === 'multisig',
        ),
        hasSigningKeys: vi.fn((account: any) => !!account?.keyPairId),
        canSignWith: vi.fn((account: any) => !!account?.keyPairId),
        canSignArbitraryData: vi.fn(
            (account: any) =>
                !!account?.keyPairId && account?.type !== 'hardware',
        ),
        // Mirrors the real predicate: account-local (no rekey hop), non-multisig
        // with a local key, or hardware.
        canSignArc60: vi.fn(
            (account: any) =>
                !!account &&
                account.type !== 'multisig' &&
                (!!account.keyPairId || account.type === 'hardware'),
        ),
        canSignProgram: vi.fn(
            (account: any) =>
                account?.type !== 'hardware' &&
                !account?.rekeyAddress &&
                !!account?.keyPairId,
        ),
        isRekeyedUnsignable: vi.fn(() => false),
        isMultisigUnsignable: vi.fn(() => false),
        canInitiateRekey: vi.fn((account: any) => !!account?.keyPairId),
        getRekeyAccount: vi.fn(() => null),
        getSignerFor: vi.fn(
            (address: string, accs: any[] = []) =>
                accs.find((a: any) => a.address === address) ?? null,
        ),
        resolveSignerFor: vi.fn((address: string, accs: any[] = []) => {
            const signer = accs.find((a: any) => a.address === address)
            return signer ? { kind: 'ok', signer } : { kind: 'accountNotFound' }
        }),
        resolveSignerForAccount: vi.fn((account: any) =>
            account?.keyPairId
                ? { kind: 'ok', signer: account }
                : { kind: 'watch', account },
        ),
        useCanSignWith: vi.fn((account: any) => !!account?.keyPairId),
        useRekeyAccount: vi.fn(() => null),
        useSignerFor: vi.fn(() => null),
        useAccountAssetBalanceQuery: vi.fn(() => ({
            data: null,
            isPending: false,
        })),
        useOnChainAccountInformationQuery: vi.fn(() => ({
            data: undefined,
            isPending: false,
        })),
        getOnChainAccountInformationQueryKey: vi.fn(
            (address: string, network: string) => [
                'accounts',
                'on-chain-account-information',
                { address, network },
            ],
        ),
        invalidateAccountQueriesForAddresses: vi.fn(),
        useFindAccountByAddress: vi.fn(() => null),
        useLocalKeyTransactionSigner: vi.fn(() => ({
            signTransactions: vi.fn().mockResolvedValue([]),
        })),
        useArbitraryDataSigner: vi.fn(() => ({
            signArbitraryData: vi.fn().mockResolvedValue([]),
        })),
        ALGO_ASSET_ID: '0',
        AccountTypes: {
            algo25: 'algo25',
            hdWallet: 'hdWallet',
            hardware: 'hardware',
            multisig: 'multisig',
            watch: 'watch',
        },
        AccountSortModes: {
            alphabeticalAsc: 'alphabeticalAsc',
            alphabeticalDesc: 'alphabeticalDesc',
            balanceAsc: 'balanceAsc',
            balanceDesc: 'balanceDesc',
            manual: 'manual',
        },
        useAccountsStore: vi.fn((selector: (s: any) => any) =>
            selector({
                accounts: [],
                addAccount: vi.fn(),
                removeAccount: vi.fn(),
                resetState: vi.fn(),
            }),
        ),
        useOwnedAssets: vi.fn(() => ({
            assets: [],
            isLoading: false,
        })),
    }
})

// Mock @perawallet/wallet-core-contacts
vi.mock('@perawallet/wallet-core-contacts', () => {
    const state = {
        contacts: [] as unknown[],
        addContact: vi.fn(),
        editContact: vi.fn(),
        deleteContact: vi.fn(),
        selectedContact: null,
        setSelectedContact: vi.fn(),
        resetState: vi.fn(),
    }
    // Shaped like the zustand store, not just its hook call: the backup sync
    // manager reads it through `getState`/`subscribe`.
    const useContactsStore = Object.assign(
        vi.fn((selector?: (s: any) => any) =>
            selector ? selector(state) : state,
        ),
        {
            getState: () => state,
            setState: vi.fn(),
            subscribe: vi.fn(() => () => undefined),
        },
    )

    return {
        useContacts: vi.fn(() => ({
            ...state,
            findContacts: vi.fn(() => []),
        })),
        useContactsStore,
        DuplicateAddressError: class DuplicateAddressError extends Error {},
        ContactNotFoundError: class ContactNotFoundError extends Error {},
    }
})

// Mock @perawallet/wallet-core-staking (dist schema.d.ts uses z.infer<typeof ...> which
// cannot be parsed as JS; mock the whole package to avoid the SyntaxError)
vi.mock('@perawallet/wallet-core-staking', () => ({
    useStakingProjectsQuery: vi.fn(() => ({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
    })),
}))

// Mock @perawallet/wallet-core-currencies
vi.mock('@perawallet/wallet-core-currencies', async () => {
    const { Decimal } = await import('decimal.js')
    return {
        USD_CURRENCY_ID: 'USD',
        FIAT_DECIMAL_PLACES: 2,
        useCurrency: vi.fn(() => ({
            preferredCurrency: 'USD',
            fallbackCurrency: 'USD',
            portfolioPreferredValue: '0',
            usdToPreferred: (usd: InstanceType<typeof Decimal>) => usd,
        })),
        usePreferredCurrencyPriceQuery: vi.fn(() => ({
            data: { usdPrice: new Decimal(1) },
            isPending: false,
        })),
    }
})

// Mock @perawallet/wallet-core-blockchain
class MockAlgodError extends Error {
    constructor(
        public readonly code: string,
        public readonly params: Record<string, unknown> = {},
        public readonly originalError?: Error,
    ) {
        super(`[algod:${code}] ${originalError?.message ?? code}`)
        this.name = 'AlgodError'
    }
}

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    // Real store (not hand-mocked): setCustomNetwork/clearCustomNetwork/
    // resetState need genuine zustand reactivity so subscribed hooks
    // re-render on change. Imported by its own module path (not the package
    // barrel/`../store` index) to avoid evaluating utils/algorandClient's
    // module-level side effects, which would run for every test in the
    // suite and reach into the (also-mocked) wallet-core-shared module.
    const {
        useCustomNetworkStore,
        getCustomNetworkConfig,
        isCustomNetworkConfigured,
    } = await vi.importActual<
        typeof import('@packages/blockchain/src/store/custom-network-store')
    >('@packages/blockchain/src/store/custom-network-store')
    // Real ARC-0001 module: `packages/connections` composes its request
    // schema from `arc0001SignTxnRequestSchema` at load, so a hand-written
    // stand-in would silently disarm the resolver's own refusals.
    const arc0001 = await vi.importActual<
        typeof import('@packages/blockchain/src/arc0001')
    >('@packages/blockchain/src/arc0001')

    return {
        ...arc0001,
        useAlgorandClient: vi.fn(),
        useSigningRequest: vi.fn(() => ({ addSignRequest: vi.fn() })),
        useTransactionEncoder: vi.fn(() => ({
            encodeSignedTransaction: vi.fn(),
        })),
        isValidAlgorandAddress: vi.fn(address => {
            if (!address) return false
            return new RegExp('^[0-9a-zA-Z]{58}$').test(address)
        }),
        encodeAlgorandAddress: vi.fn(() => 'MOCKADDRESS'),
        useNetwork: vi.fn(() => ({
            network: 'mainnet',
        })),
        useMinimumFeeConfig: vi.fn(() => ({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
            assetMbr: 100_000n,
            baseAccountMbr: 100_000n,
        })),
        useNetworkStore: Object.assign(
            vi.fn(() => 'mainnet'),
            {
                getState: vi.fn(() => ({
                    network: 'mainnet',
                    setNetwork: vi.fn(),
                    resetState: vi.fn(),
                })),
                // The accounts barrel subscribes at load to mirror per-network
                // rekey state on switches.
                subscribe: vi.fn(() => () => {}),
            },
        ),
        // Error-translation exports. Tests that need the real parser should use
        // `vi.importActual` in their own file (see useAlgodErrorMessage.test.ts).
        AlgodError: MockAlgodError,
        AlgodErrorCode: {
            OVERSPEND: 'overspend',
            BELOW_MIN_BALANCE: 'below_min_balance',
            MISSING_OPT_IN: 'missing_opt_in',
            DUPLICATE_TXN: 'duplicate_txn',
            EXPIRED_TXN: 'expired_txn',
            LOGIC_ERROR: 'logic_error',
            NETWORK_UNAVAILABLE: 'network_unavailable',
            UNKNOWN_NODE_ERROR: 'unknown_node_error',
        },
        toAlgodError: vi.fn(
            (err: unknown) =>
                new MockAlgodError(
                    'unknown_node_error',
                    { raw: err instanceof Error ? err.message : String(err) },
                    err instanceof Error ? err : undefined,
                ),
        ),
        microAlgosToAlgos: vi.fn((microAlgos: bigint | number | string) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Decimal } = require('decimal.js')
            return new Decimal(microAlgos.toString()).dividedBy(1_000_000)
        }),
        toBigInt: vi.fn((decimal: { toFixed: (dp: number) => string }) =>
            BigInt(decimal.toFixed(0)),
        ),
        baseUnitsToDisplayUnits: vi.fn(
            (baseUnits: bigint | number | string, decimals: number) => {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const { Decimal } = require('decimal.js')
                return new Decimal(baseUnits.toString()).dividedBy(
                    new Decimal(10).pow(decimals),
                )
            },
        ),
        percentChange: vi.fn((first: unknown, last: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Decimal } = require('decimal.js')
            const firstDp = new Decimal(String(first))
            const lastDp = new Decimal(String(last))
            if (firstDp.isZero()) return new Decimal(0)
            return lastDp.minus(firstDp).div(firstDp).mul(100)
        }),
        useCustomNetworkStore,
        getCustomNetworkConfig,
        isCustomNetworkConfigured,
    }
})
