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

// SWAP: joe-p WASM Falcon-1024. Replace with the official PQ crypto lib per
// docs/QUANTUM_PQ_INTEGRATION.md (Seam A).
import {
    generateKey,
    signCompressed,
    FALCON_DET1024_PUBKEY_SIZE,
} from 'falcon-1024'
import type { PQSignatureProvider } from './types'

export const createWasmFalconProvider = (): PQSignatureProvider => ({
    scheme: 'falcon1024',
    publicKeyLength: FALCON_DET1024_PUBKEY_SIZE,
    generateKeypairFromSeed(seed) {
        const { publicKey, privateKey } = generateKey(seed)
        return { publicKey, secretKey: privateKey }
    },
    sign(secretKey, message) {
        return signCompressed(secretKey, message)
    },
})
