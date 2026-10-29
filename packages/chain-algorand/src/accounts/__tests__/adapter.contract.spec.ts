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

import '../../__tests__/registerAlgorandAccounts'
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
    mockAccountAssetBalanceHistory,
    mockAccountsBalanceHistory,
    mockAlgodAccountInformation,
    mockIndexerSearchForAccounts,
} from '../../test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import {
    accountPresentationContractTests,
    accountsContractTests,
} from '@perawallet/wallet-core-accounts/testing'
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import {
    standaloneAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandDescriptor } from '../../descriptor'
import { algorandAccountsAdapter } from '../adapter'
import { algorandAccountPresentation } from '../presentation'
import { seedAuthority } from './seedAuthority'
import { algorandAddressCodec } from '../address-codec'

const FUNDED = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'
const EMPTY = 'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const SIGNER = 'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
const REKEYED = 'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
// Pinned vector shared with the kms quantum candidate specs: both derivations'
// addresses are known, so the on-chain probe can be stubbed.
const QUANTUM_MNEMONIC =
    'evoke unique jaguar rapid silent sister kingdom farm anger brother begin fluid brave sister mixture wedding suffer spin spatial combine ginger neutral lunch absorb upset'
const QUANTUM_CANONICAL =
    'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'
const QUANTUM_LEGACY =
    'TQLMWJPC7FZQ2EE7HWCWODSGZPCCESJHQIH3VEGKKJ23YFSFCD4Y662IOU'

const keyed = (id: string, address: string) =>
    standaloneAccount(address, { id, keyPairId: `${id}-key` })

accountsContractTests(() => algorandAccountsAdapter, {
    scope: { chainId: ALGORAND_CHAIN_ID, networkId: 'mainnet' },
    codec: algorandAddressCodec,
    funded: {
        address: FUNDED,
        handlers: [
            mockAlgodAccountInformation({
                address: FUNDED,
                response: {
                    amount: 2_500_000,
                    assets: [
                        { 'asset-id': 31566704, amount: 5, 'is-frozen': false },
                    ],
                },
            }),
            mockAccountFastLookup({
                address: FUNDED,
                response: { account_exists: true },
            }),
        ],
        nativeAssetId: '0',
        nativeBalanceBaseUnits: new Decimal(2_500_000),
        heldAssetId: '31566704',
    },
    empty: {
        address: EMPTY,
        handlers: [
            mockAlgodAccountInformation({ address: EMPTY, response: {} }),
            mockAccountFastLookup({
                address: EMPTY,
                response: { account_exists: false },
            }),
        ],
    },
    activity: {
        active: FUNDED,
        inactive: EMPTY,
        handlers: [
            mockAccountFastLookup({
                address: FUNDED,
                response: { account_exists: true },
            }),
            mockAccountFastLookup({
                address: EMPTY,
                response: { account_exists: false },
            }),
        ],
    },
    activityFailure: [
        http.get('*/v1/accounts/fast-lookup/*', () =>
            HttpResponse.json({}, { status: 503 }),
        ),
    ],
    changeSignal: {
        addresses: [FUNDED, EMPTY],
        cursor: 1000,
        changed: {
            handlers: [
                http.post('*/v1/accounts/should-refresh/', () =>
                    HttpResponse.json({ refresh: true, round: 1010 }),
                ),
            ],
            nextCursor: 1010,
        },
        unchanged: {
            handlers: [
                http.post('*/v1/accounts/should-refresh/', () =>
                    HttpResponse.json({ refresh: false, round: 1005 }),
                ),
            ],
            nextCursor: 1005,
        },
    },
    history: {
        addresses: [FUNDED],
        assetId: '31566704',
        period: 'one-week',
        currency: 'USD',
        handlers: [
            mockAccountsBalanceHistory({
                response: {
                    results: [
                        {
                            datetime: '2024-01-01T00:00:00Z',
                            usd_value: '100.5',
                            algo_value: '500',
                            round: 1,
                        },
                    ],
                },
            }),
            mockAccountAssetBalanceHistory({
                address: FUNDED,
                assetId: '31566704',
                response: {
                    results: [
                        {
                            datetime: '2024-01-01T00:00:00Z',
                            amount: '10.5',
                            usd_value: '25',
                            round: 1,
                        },
                    ],
                },
            }),
        ],
        portfolio: [
            {
                timestamp: Date.parse('2024-01-01T00:00:00Z'),
                usdValue: new Decimal('100.5'),
                nativeValue: new Decimal('500'),
            },
        ],
        balance: [
            {
                timestamp: Date.parse('2024-01-01T00:00:00Z'),
                amount: new Decimal('10.5'),
                usdValue: new Decimal('25'),
            },
        ],
    },
    acquisitionOrder: {
        address: FUNDED,
        handlers: [
            http.get(`*/v2/accounts/${FUNDED}/assets`, () =>
                HttpResponse.json({
                    'current-round': 1000,
                    assets: [
                        {
                            'asset-id': 10,
                            amount: 1,
                            'is-frozen': false,
                            'opted-in-at-round': 100,
                        },
                        {
                            'asset-id': 20,
                            amount: 1,
                            'is-frozen': false,
                            'opted-in-at-round': 200,
                        },
                    ],
                }),
            ),
        ],
        expected: [
            ['10', 100],
            ['20', 200],
        ],
    },
    holdingNative: {
        restricted: { family: 'algorand', isFrozen: true },
        unrestricted: { family: 'algorand', isFrozen: false },
    },
    rootKey: fromSeed(new Uint8Array(64).fill(1)),
    hdPath: {
        details: { account: 1, keyIndex: 3 },
        matching: "m/44'/283'/1'/0/3",
        mismatched: "m/44'/283'/1'/0/4",
        malformed: "m/44'/60'/1'/0/3",
    },
    singleKey: {
        mnemonicIndices: mnemonicWordsToIndices(QUANTUM_MNEMONIC.split(' '))!,
        handlers: [QUANTUM_CANONICAL, QUANTUM_LEGACY].map(address =>
            mockAlgodAccountInformation({
                address,
                response: { amount: 1_000_000 },
            }),
        ),
    },
    signers: {
        signing: keyed('signing', SIGNER),
        watch: watchAccount(EMPTY, { id: 'watch' }),
    },
    delegated: {
        accounts: {
            account: watchAccount(REKEYED, { id: 'delegated' }),
            auth: keyed('auth', FUNDED),
            next: keyed('next', EMPTY),
        },
        seedAuthority: (address, authAddress) =>
            seedAuthority(address, authAddress),
        authAddress: FUNDED,
        delegatedAddresses: [REKEYED],
        handlers: [
            mockIndexerSearchForAccounts({
                response: { accounts: [{ address: REKEYED }] },
            }),
        ],
    },
})

accountPresentationContractTests(
    () => algorandAccountPresentation,
    () => algorandAccountsAdapter,
    {
        signers: {
            signing: keyed('signing', SIGNER),
            watch: watchAccount(EMPTY, { id: 'watch' }),
        },
    },
)

describe('Algorand authority delegation', () => {
    it('is declared exactly when the descriptor supports rekey', () => {
        expect(!!algorandAccountsAdapter.authority).toBe(
            algorandDescriptor.protocol.supportsRekey,
        )
    })

    it('is switched by the rekey capability', () => {
        expect(algorandAccountsAdapter.authority?.capability).toBe('rekey')
    })
})

describe('Algorand account-state reads', () => {
    it('caps a sync at six concurrent reads, since each one is its own algod request', () => {
        expect(algorandAccountsAdapter.maxConcurrentStateReads).toBe(6)
    })
})
