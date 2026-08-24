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

export type GoAlgorandPQVector = {
    /** 32 bytes of algo25 mnemonic entropy, NOT a keygen seed. */
    entropy: Uint8Array
    address: string
}

/**
 * Pinned from `packages/blockchain/src/pq/__tests__/derivation.spec.ts:22-24`,
 * which in turn carries go-algorand's `cmd/algokey/pq_test.go` published vector
 * (entropy = bytes 1..32). An external, non-Pera oracle — the whole point of
 * this vector is that it was never computed by this repo's code.
 */
export const GO_ALGORAND_PQ_VECTOR: GoAlgorandPQVector = {
    entropy: Uint8Array.from({ length: 32 }, (_, i) => i + 1),
    address: 'ZEJ4BLG3XWAUUZQGCEDJLYIC6D2NCWHRSX5DJMDPE54PXXR7G3PCQTARXU',
}

export type InRepoHdVector = {
    mnemonic: string
    address: string
}

/**
 * Pinned from `packages/kms/src/crypto/__tests__/hdwallet-integration.test.ts:34-38`
 * — a BIP39 24-word mnemonic at path `m/44'/283'/0'/0/0` (Peikert derivation),
 * documented there as matching the native iOS/Android Pera apps.
 *
 * THROWAWAY TEST VECTOR, published in source: never fund `address`.
 */
export const IN_REPO_HD_VECTOR: InRepoHdVector = {
    mnemonic:
        'champion say kitchen sock defense example mesh body sample artwork warfare canvas item recall cheese total floor cycle such asthma okay immense lake street',
    address: 'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A',
}
