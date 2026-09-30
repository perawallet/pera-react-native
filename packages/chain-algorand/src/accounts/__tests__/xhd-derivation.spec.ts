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
import { describe, test, expect } from 'vitest'
import { mnemonicToSeed } from '@scure/bip39'
import { fromSeed } from '@algorandfoundation/xhd-wallet-api'
import { DerivationTypes } from '@perawallet/wallet-core-accounts'
import { algorandAddressCodec } from '../address-codec'
import { createXHDGetPublicKey } from '../discovery'

const USER_MNEMONIC =
    'achieve plunge scare have music possible will garden expect kangaroo impulse deny obvious inhale expand process betray voice crash insane electric mean test rude'

const EXPECTED_FUNDED_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const EXPECTED_MASTER_ADDRESS =
    'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

// Native-app parity vector, published in source; NEVER fund PARITY_ADDRESS.
const PARITY_MNEMONIC =
    'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street'
const PARITY_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'

describe('XHD public-key getter ground truth', () => {
    test('derives the funded address at account=1 keyIndex=0 (Peikert)', async () => {
        const seed = await mnemonicToSeed(USER_MNEMONIC)
        const rootKey = fromSeed(seed)
        const getPublicKey = createXHDGetPublicKey(rootKey)

        const pubKey = await getPublicKey({
            account: 1,
            keyIndex: 0,
            derivationType: DerivationTypes.Peikert,
        })
        expect(
            algorandAddressCodec.fromPublicKey(pubKey, {
                scheme: 'ed25519',
                networkId: 'mainnet',
            }),
        ).toBe(EXPECTED_FUNDED_ADDRESS)
    })

    test('derives the empty master at account=0 keyIndex=0 (Peikert)', async () => {
        const seed = await mnemonicToSeed(USER_MNEMONIC)
        const rootKey = fromSeed(seed)
        const getPublicKey = createXHDGetPublicKey(rootKey)

        const pubKey = await getPublicKey({
            account: 0,
            keyIndex: 0,
            derivationType: DerivationTypes.Peikert,
        })
        expect(
            algorandAddressCodec.fromPublicKey(pubKey, {
                scheme: 'ed25519',
                networkId: 'mainnet',
            }),
        ).toBe(EXPECTED_MASTER_ADDRESS)
    })

    test('matches the native apps at account=0 keyIndex=0 (Peikert)', async () => {
        const rootKey = fromSeed(await mnemonicToSeed(PARITY_MNEMONIC))
        const getPublicKey = createXHDGetPublicKey(rootKey)

        const pubKey = await getPublicKey({
            account: 0,
            keyIndex: 0,
            derivationType: DerivationTypes.Peikert,
        })
        expect(
            algorandAddressCodec.fromPublicKey(pubKey, {
                scheme: 'ed25519',
                networkId: 'mainnet',
            }),
        ).toBe(PARITY_ADDRESS)
    })
})
