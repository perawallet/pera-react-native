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
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import type { AccountsChainAdapter } from '../chain-adapter'
import { InvalidBip44PathError } from '../errors'
import { DerivationTypes } from '../models'
import { accountsContractTests } from './adapter-contract'

// A second chain with no rekey, quantum or single-key accounts, so the
// contract's refusal branches run in this package rather than only in a chain's.
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
    hdDerivationType: DerivationTypes.Peikert,
    fetchAccountState: async address => {
        const account = await getAccount(address)
        if (!account) throw new Error('no such account')
        return {
            nativeBalance: new Decimal(account.balance),
            minBalance: new Decimal(0),
            authAddress: null,
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
    fetchAccountInformation: () =>
        Promise.reject(new Error('read deferred with the chain state model')),
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
    hdKeyPairId: (seedKeyId, { account, keyIndex, derivationType }) =>
        `${seedKeyId}-fx-${account}-${keyIndex}-${derivationType}`,
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

const account = (address: string, body: FixtureAccount) =>
    http.get(`${ORIGIN}/accounts/${address}`, () => HttpResponse.json(body))
const missing = (address: string) =>
    http.get(`${ORIGIN}/accounts/${address}`, () =>
        HttpResponse.json({}, { status: 404 }),
    )

accountsContractTests(() => fixtureAdapter, {
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
    rootKey: new Uint8Array(64).fill(1),
    hdPath: {
        details: {
            account: 1,
            change: 0,
            keyIndex: 3,
            derivationType: DerivationTypes.Peikert,
        },
        matching: "m/44'/9999'/1'/0/3",
        mismatched: "m/44'/9999'/1'/0/4",
        malformed: "m/44'/60'/1'/0/3",
    },
})
