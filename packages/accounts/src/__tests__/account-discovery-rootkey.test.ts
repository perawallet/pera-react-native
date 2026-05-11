/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
    XHDWalletAPI,
} from '@algorandfoundation/xhd-wallet-api'
import { encodeAddress } from '@algorandfoundation/algokit-utils'

const USER_MNEMONIC =
    'achieve plunge scare have music possible will garden expect kangaroo impulse deny obvious inhale expand process betray voice crash insane electric mean test rude'

const EXPECTED_FUNDED_ADDRESS =
    'CBLWUBRWCWNKZ2Y2Q5HFKN7XISNBVAN47422MZOKH5OGCZ3H5JYLTDPLOA'
const EXPECTED_MASTER_ADDRESS =
    'EV37KES2XMAYPUQ5YT5T62RUC5LHNKERPH5QCAJFQF3735U7SE6BU5UQWM'

describe('HD wallet derivation ground truth (account-discovery test vector)', () => {
    test('derives the funded address at account=1 keyIndex=0 (Peikert)', async () => {
        const seed = await mnemonicToSeed(USER_MNEMONIC)
        const rootKey = fromSeed(seed)
        const api = new XHDWalletAPI()

        const pubKey = await api.keyGen(
            rootKey,
            KeyContext.Address,
            1,
            0,
            BIP32DerivationType.Peikert,
        )
        expect(encodeAddress(pubKey)).toBe(EXPECTED_FUNDED_ADDRESS)
    })

    test('derives the empty master at account=0 keyIndex=0 (Peikert)', async () => {
        const seed = await mnemonicToSeed(USER_MNEMONIC)
        const rootKey = fromSeed(seed)
        const api = new XHDWalletAPI()

        const pubKey = await api.keyGen(
            rootKey,
            KeyContext.Address,
            0,
            0,
            BIP32DerivationType.Peikert,
        )
        expect(encodeAddress(pubKey)).toBe(EXPECTED_MASTER_ADDRESS)
    })
})
