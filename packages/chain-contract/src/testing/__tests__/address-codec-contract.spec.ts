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


import { Decimal } from 'decimal.js'
import { addressCodecContractTests } from '../address-codec-contract'
import { FIXTURE_CHAIN_ID, fixtureCodec } from './fixture-chain'

addressCodecContractTests(() => fixtureCodec, {
    publicKey: new Uint8Array(32).fill(0xab),
    deriveOpts: { scheme: 'ed25519', networkId: 'testnet' },
    equivalentSpellings: [`tfx${'ab'.repeat(20)}`, `TFX${'AB'.repeat(20)}`],
    invalid: [`fx${'ab'.repeat(19)}`, `fx${'zz'.repeat(20)}`, 'not-an-address'],
    foreignUri: `otherchain:fx${'ab'.repeat(20)}`,
    paymentUriOpts: {
        amount: new Decimal('1.5'),
        assetRef: { chainId: FIXTURE_CHAIN_ID, assetId: '7' },
        label: 'rent',
        note: 'march',
    },
})
