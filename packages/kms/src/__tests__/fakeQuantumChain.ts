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

import { sha512_256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import type { QuantumChainDerivation } from '../models'

const FAKE_PREFIX = new TextEncoder().encode('FAKEPQK')

// Deliberately not any real chain's rules: kms specs pin that kms routes the
// seed and public key through the injected derivation, and the Algorand
// vectors live with algorandQuantumDerivation in chain-algorand.
export const fakeQuantumChain: QuantumChainDerivation = {
    deriveKeygenSeed: entropy => {
        const preimage = new Uint8Array(FAKE_PREFIX.length + entropy.length)
        preimage.set(FAKE_PREFIX, 0)
        preimage.set(entropy, FAKE_PREFIX.length)
        return sha512_256(preimage)
    },
    addressFromPublicKey: publicKey =>
        `fake-${bytesToHex(sha512_256(publicKey)).slice(0, 32)}`,
}
