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

// Barrel replacing the externalised @algorandfoundation/keystore meta package —
// re-exports the vendored surface consumed by store.ts, extension.ts, types.ts,
// storage/state.ts and webauthn/keystore-signer.ts.

export * from './types'
export * from './errors'
export {
    clearKeyData,
    decryptWithKeyData,
    encryptWithKeyData,
    getBIP44PathFromContext,
    harden,
    requiresParentKey,
} from './crypto'
export {
    addKey,
    clearKeyStore,
    decrypt,
    encrypt,
    getKey,
    initializeKeyStore,
    removeKey,
    setStatus,
    sign,
    verify,
} from './state'
export { encodeAddress } from './encoding'
export {
    generateEd25519FromSeed,
    generateKey,
    generateSecretKey,
    generateSeedData,
    generateXHDFromParent,
    generateXHDRootKeyFromSeed,
} from './generate'
export type {
    BIP39GenerationOptions,
    SecretKeyGenerationOptions,
} from './generate'
export {
    signWithKeyData,
    signWithSubtle,
    signXHDDomainP256KeyData,
    signXHDEd25519,
} from './sign'
export { verifyWithKeyData } from './verify'
