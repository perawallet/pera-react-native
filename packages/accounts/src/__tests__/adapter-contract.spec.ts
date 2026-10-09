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

// @vitest-environment node
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import type {
    AccountsChainAdapter,
    MintedAccount,
    SingleKeyAccountOps,
} from '../chain-adapter'
import { buildAccount } from '../credentials'
import { InvalidBip44PathError } from '../errors'
import type { WalletAccount } from '../models'
import { canSignDirectly } from '../utils'
import {
    accountsContractTests,
    type AccountsContractFixtures,
} from './adapter-contract'

// A second chain with no rekey or single-key accounts, so the contract's
// refusal branches run in this package rather than only in a chain's. Its key
// kind, copy and wire values are its own.
const ORIGIN = 'https://fixturehex.test'
const NATIVE_ASSET_ID = 'fx'
const HELD_ASSET_ID = 'token-1'

const FUNDED = `fx${'a'.repeat(40)}`
const EMPTY = `fx${'b'.repeat(40)}`

type FixtureAccount = { balance: string; assets: Record<string, string> }

const getAccount = async (address: string): Promise<FixtureAccount | null> => {
    const response = await fetch(`${ORIGIN}/accounts/${address}`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`fixturehex ${response.status}`)
    return response.json() as Promise<FixtureAccount>
}

const HD_PATH = /^m\/44'\/9999'\/(\d+)'\/0\/(\d+)$/

const fixtureAdapter: AccountsChainAdapter = {
    chainId: FIXTURE_CHAIN_ID,
    fetchAccountState: async address => {
        const account = await getAccount(address)
        if (!account) throw new Error('no such account')
        return {
            nativeBalance: new Decimal(account.balance),
            nativeBalanceBaseUnits: new Decimal(account.balance),
            minBalance: new Decimal(0),
            authAddress: null,
            chainState: { family: 'evm', nonce: { latest: 0, pending: 0 } },
            holdings: [
                {
                    assetId: NATIVE_ASSET_ID,
                    amount: new Decimal(account.balance),
                    isFrozen: false,
                },
                ...Object.entries(account.assets).map(([assetId, amount]) => ({
                    assetId,
                    amount: new Decimal(amount),
                    isFrozen: false,
                })),
            ],
            observedRound: null,
        }
    },
    toChainState: () => ({ family: 'evm', nonce: { latest: 0, pending: 0 } }),
    accountExists: async address => (await getAccount(address)) !== null,
    checkActivity: async addresses =>
        new Map(
            await Promise.all(
                addresses.map(
                    async address =>
                        [
                            address,
                            await getAccount(address).then(
                                account => account !== null,
                                () => false,
                            ),
                        ] as const,
                ),
            ),
        ),
    createPublicKeyGetter:
        rootKey =>
        async ({ account, keyIndex }) =>
            Uint8Array.from([account, keyIndex, ...rootKey.subarray(0, 30)]),
    hdKeyPairId: (seedKeyId, { account, keyIndex }) =>
        `${seedKeyId}-fx-${account}-${keyIndex}`,
    localKeyKinds: [
        {
            seed: 'bip39',
            signingScheme: 'secp256k1',
            isHd: true,
            mnemonicWordCounts: [12, 24],
            isAutoDetected: true,
        },
    ],
    duplicateRank: account => (account.custody.kind === 'watch' ? 0 : 1),
    presentation: {
        describe: account => ({
            kindId: `fx-${account.custody.kind}`,
            labelKey: `fixturehex.${account.custody.kind}`,
            infoTitleKey: `fixturehex.${account.custody.kind}.title`,
            infoBodyKey: `fixturehex.${account.custody.kind}.body`,
            glyph: `fx/${account.custody.kind}`,
            analyticsKind: `fx_${account.custody.kind}`,
        }),
        kindGlyph: kindId =>
            kindId.startsWith('fx-') ? `fx/${kindId.slice(3)}` : undefined,
        transitionLabel: () => ({
            labelKey: 'fixturehex.transition',
            signerKey: 'fixturehex.transition.signer',
            descriptionKey: 'fixturehex.transition.body',
        }),
    },
    deviceAccountType: account =>
        account.custody.kind === 'watch' ? null : 'fx-account',
    decodeLegacyRecord: raw => {
        if (typeof raw !== 'object' || raw === null) return undefined
        const { fxAddress } = raw as { fxAddress?: unknown }
        return typeof fxAddress === 'string'
            ? {
                  custody: { kind: 'watch' },
                  chains: { [FIXTURE_CHAIN_ID]: { address: fxAddress } },
              }
            : undefined
    },
    resolveSigner: (account, _accounts) =>
        canSignDirectly(account)
            ? { kind: 'ok', signer: account }
            : { kind: 'watch', account },
    getAuthAccount: account => account,
    assertHdPathMatches: (hdPath, details) => {
        const match = HD_PATH.exec(hdPath)
        if (!match) {
            throw new InvalidBip44PathError(
                hdPath,
                'malformed',
                'not a fixturehex path',
            )
        }
        if (
            Number(match[1]) !== details.account ||
            Number(match[2]) !== details.keyIndex
        ) {
            throw new InvalidBip44PathError(
                hdPath,
                'mismatch',
                'other coordinates',
            )
        }
    },
}

const walletAccount = (
    id: string,
    address: string,
    custody: 'local' | 'watch',
): WalletAccount =>
    custody === 'watch'
        ? {
              id,
              custody: { kind: 'watch' },
              chains: { [FIXTURE_CHAIN_ID]: { address } },
          }
        : {
              id,
              custody: {
                  kind: 'local',
                  seed: 'bip39',
                  hd: { account: 0, keyIndex: 0 },
              },
              chains: {
                  [FIXTURE_CHAIN_ID]: { address, keyPairId: `${id}-key` },
              },
          }

const account = (address: string, body: FixtureAccount) =>
    http.get(`${ORIGIN}/accounts/${address}`, () => HttpResponse.json(body))
const missing = (address: string) =>
    http.get(`${ORIGIN}/accounts/${address}`, () =>
        HttpResponse.json({}, { status: 404 }),
    )

const fixtures: AccountsContractFixtures = {
    scope: { chainId: FIXTURE_CHAIN_ID, networkId: 'mainnet' },
    codec: fixtureCodec,
    funded: {
        address: FUNDED,
        handlers: [
            account(FUNDED, {
                balance: '2.5',
                assets: { [HELD_ASSET_ID]: '5' },
            }),
        ],
        nativeAssetId: NATIVE_ASSET_ID,
        nativeBalance: new Decimal('2.5'),
        heldAssetId: HELD_ASSET_ID,
    },
    empty: { address: EMPTY, handlers: [missing(EMPTY)] },
    activity: {
        active: FUNDED,
        inactive: EMPTY,
        handlers: [
            account(FUNDED, { balance: '1', assets: {} }),
            missing(EMPTY),
        ],
    },
    activityFailure: [
        http.get(`${ORIGIN}/accounts/*`, () =>
            HttpResponse.json({}, { status: 503 }),
        ),
    ],
    signers: {
        signing: walletAccount('signing', FUNDED, 'local'),
        watch: walletAccount('watch', EMPTY, 'watch'),
    },
    rootKey: new Uint8Array(64).fill(1),
    hdPath: {
        details: { account: 1, keyIndex: 3 },
        matching: "m/44'/9999'/1'/0/3",
        mismatched: "m/44'/9999'/1'/0/4",
        malformed: "m/44'/60'/1'/0/3",
    },
}

accountsContractTests(() => fixtureAdapter, fixtures)

// The same chain with a single-key kind, so the contract's creation and import
// cases run here too. Keys come from `kmsCore`, which the suite stubs.
const SINGLE_KEY_CHAIN_ID = 'fixturesk' as ChainId

const mintSingleKey = async (
    request: { seed: SeedScheme; id?: string; mnemonicIndices?: Uint16Array },
    networkId: string,
): Promise<MintedAccount> => {
    const minted = await kmsCore.createAlgo25Key({
        id: request.id,
        mnemonicIndices: request.mnemonicIndices,
    })
    const address = fixtureCodec.fromPublicKey(minted.publicKey, {
        scheme: 'ed25519',
        networkId,
    })
    return {
        account: buildAccount({
            custody: { kind: 'local', seed: SeedScheme.Algo25 },
            chainId: SINGLE_KEY_CHAIN_ID,
            chains: {
                [SINGLE_KEY_CHAIN_ID]: {
                    address,
                    keyPairId: minted.signKeyId,
                },
            },
        }),
        seedKeyId: minted.seedKey.id,
        isNewSeed: true,
    }
}

const singleKeyAccounts: SingleKeyAccountOps = {
    create: (request, scope) => mintSingleKey(request, scope.networkId),
    importMnemonic: async ({ seed, mnemonicIndices }, scope, save) => {
        const minted = await mintSingleKey(
            { seed, mnemonicIndices },
            scope.networkId,
        )
        await save(minted)
        return minted.account
    },
    findAlternateImportKinds: async () => [],
}

const singleKeyFixtureAdapter: AccountsChainAdapter = {
    ...fixtureAdapter,
    chainId: SINGLE_KEY_CHAIN_ID,
    localKeyKinds: [
        ...fixtureAdapter.localKeyKinds,
        {
            seed: SeedScheme.Algo25,
            signingScheme: 'ed25519',
            isHd: false,
            mnemonicWordCounts: [25],
            isAutoDetected: true,
        },
    ],
    singleKeyAccounts,
}

accountsContractTests(() => singleKeyFixtureAdapter, {
    ...fixtures,
    scope: { chainId: SINGLE_KEY_CHAIN_ID, networkId: 'mainnet' },
    singleKey: { mnemonicIndices: new Uint16Array(25), handlers: [] },
})
