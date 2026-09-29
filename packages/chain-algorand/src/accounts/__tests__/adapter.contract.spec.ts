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
import { Decimal } from 'decimal.js'
import { http, HttpResponse } from 'msw'
import {
    mockAlgodAccountInformation,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'
import { mockAccountFastLookup } from '@perawallet/wallet-core-shared/test-handlers'
import { accountsContractTests } from '@perawallet/wallet-core-accounts/testing'
import { DerivationTypes } from '@perawallet/wallet-core-accounts'
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAccountsAdapter } from '../adapter'
import { algorandAddressCodec } from '../address-codec'

const FUNDED = 'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'
const EMPTY = 'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const REKEYED = 'H325AXRDHRSZU5727LVZKTKYJVRRGD2MNUXVSPUONMSPTRCXQLWIU36CLI'

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
    rekeyed: {
        authAddress: FUNDED,
        rekeyedAddresses: [REKEYED],
        handlers: [
            mockIndexerSearchForAccounts({
                response: { accounts: [{ address: REKEYED }] },
            }),
        ],
    },
})
