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

export const name = '@perawallet/wallet-core-kms'

export * from './hooks/useKMS'
export { useKMSService } from './hooks/useKMSServices'
export * from './models'
export * from './errors'
export { WORDLIST as MNEMONIC_WORDLIST } from './crypto/wordlist'
export {
    mnemonicIndexToWord,
    mnemonicWordsToIndices,
} from './crypto/mnemonic-indices'
export { uniformIntBelow, pickDistinctIndexes } from './crypto/random'
export { zeroBytes } from './crypto/secure-memory'
export {
    prepareHDMasterKey,
    type PreparedHDMasterKey,
} from './crypto/prepare-hd-master-key'
export {
    entropyToMnemonic,
    deriveLiquidAuthMainKey,
} from './crypto/hdwallet-utils'
export { algo25SecretKeyToMnemonic } from './crypto/algo25-utils'
// Re-exported so consumers that need to derive a real Falcon keypair outside
// the hook (e.g. quantum test fixtures) use the same PQ provider `useQuantum`
// and `useKMS` do, rather than hand-rolling their own derivation.
export { getPQProvider, type PQSignatureProvider } from './crypto/pq'
export {
    resolvePQSigningInfo,
    resolveSeedKeyFrom,
    type PQSigningInfo,
} from './crypto/pq/resolvePQSigningInfo'
export {
    quantumAddressCandidates,
    type QuantumAddressCandidate,
} from './crypto/quantumAddressCandidates'
export {
    SeedScheme,
    ALGO25_SEED_LENGTH,
    QUANTUM_SEED_LENGTH,
    SIGNING_ACCESS_DOMAIN,
    BACKUP_ACCESS_DOMAIN,
} from './constants'
export {
    aclOf,
    algo25AddressOf,
    createdAtOf,
    entropyChildIdOf,
    entropyChildMetadata,
    expiresAtOf,
    hexToBytes,
    algo25SeedToAddress,
    isSeedKey,
    seedSchemeOf,
} from './utils'
export { hdDerivedKeyId } from './hooks/useHDWallet'
export {
    findPasskeyMainKey,
    passkeyMainKeyId,
    usePasskeyMainKey,
    PASSKEY_MAIN_KEY_SCHEME,
    type UsePasskeyMainKeyResult,
} from './hooks/usePasskeyMainKey'
export {
    commitSecret,
    hasSecret,
    removeSecret,
    withSecret,
} from './storage/secrets'
