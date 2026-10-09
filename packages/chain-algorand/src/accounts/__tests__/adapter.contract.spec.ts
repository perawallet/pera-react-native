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
// XHD's noble checks reject jsdom's Uint8Array realm.
import { describe, expect, test } from 'vitest'
import '../../__tests__/registerAlgorandAccounts'
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import {
    mockAlgodAccountInformation,
    mockIndexerSearchForAccounts,
} from '../../test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { accountsContractTests } from '@perawallet/wallet-core-accounts/testing'
import {
    DerivationTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAccountsAdapter } from '../adapter'
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

const keyed = (id: string, address: string, extra = {}): WalletAccount => ({
    id,
    address,
    custody: { kind: 'local', seed: null },
    keyPairId: `${id}-key`,
    ...extra,
})

const delegatedWatch = (address: string): WalletAccount => ({
    id: 'rekeyed',
    address,
    custody: { kind: 'watch' },
})

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
        ],
        nativeAssetId: '0',
        nativeBalance: new Decimal('2.5'),
        heldAssetId: '31566704',
    },
    empty: {
        address: EMPTY,
        handlers: [
            mockAlgodAccountInformation({ address: EMPTY, response: {} }),
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
    rootKey: fromSeed(new Uint8Array(64).fill(1)),
    hdPath: {
        details: {
            account: 1,
            change: 0,
            keyIndex: 3,
            derivationType: DerivationTypes.Peikert,
        },
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
        watch: {
            id: 'watch',
            address: EMPTY,
            custody: { kind: 'watch' },
        },
    },
    rekeyed: {
        accounts: {
            account: delegatedWatch(REKEYED),
            auth: keyed('auth', FUNDED),
            next: keyed('next', EMPTY),
        },
        seedAuthority: (address, authAddress) =>
            seedAuthority(address, authAddress),
        authAddress: FUNDED,
        rekeyedAddresses: [REKEYED],
        handlers: [
            mockIndexerSearchForAccounts({
                response: { accounts: [{ address: REKEYED }] },
            }),
        ],
    },
})

describe('algorandAccountsAdapter.toAccountInformationAddress', () => {
    test('builds the address an AccountInformation carries', () => {
        const address =
            algorandAccountsAdapter.toAccountInformationAddress(FUNDED)

        expect(address.toString()).toBe(FUNDED)
        expect(address.publicKey).toHaveLength(32)
    })

    test('throws for an address that is not valid', () => {
        expect(() =>
            algorandAccountsAdapter.toAccountInformationAddress(
                'not-an-address',
            ),
        ).toThrow()
    })
})
