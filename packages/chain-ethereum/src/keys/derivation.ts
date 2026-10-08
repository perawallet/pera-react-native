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

import { keccak256 } from 'viem'
import type {
    DeriveOpts,
    KeyDerivation,
    SeedRef,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'
import { ethereumAddressCodec } from '../addresses'
import { ETHEREUM_CHAIN_ID } from '../chain-id'

const SCHEME = 'secp256k1'

const assertSecp256k1 = (opts: DeriveOpts): void => {
    if (opts.scheme !== SCHEME) {
        throw new Error(`Ethereum keys are secp256k1 only, got ${opts.scheme}`)
    }
}

/** BIP-44 coin type 60, the path MetaMask and Ledger Live derive. */
export const ethereumHdPath = (account: number, keyIndex: number): string =>
    `m/44'/60'/${account}'/0/${keyIndex}`

/**
 * Stored accounts reference this id, so its format never changes, and the
 * accounts adapter's `hdKeyPairId` must return the same. It names the chain
 * because another secp256k1 chain at the same coordinates is a different key.
 */
export const ethereumHdKeyId = (
    seedRef: SeedRef,
    account: number,
    keyIndex: number,
): string => `${seedRef}-eth-acc${account}-idx${keyIndex}`

/** Stable per key so re-imports resolve to one entry, and never carries key bytes. */
export const ethereumRawKeyId = (privateKey: Uint8Array): string =>
    `ethereum-raw-${keccak256(privateKey).slice(2, 34)}`

export const ethereumKeyDerivation: KeyDerivation = {
    chainId: ETHEREUM_CHAIN_ID,
    deriveAccount: async (kms, seedRef, account, keyIndex, opts) => {
        assertSecp256k1(opts)
        const key = await kms.deriveFromSeed(
            seedRef,
            {
                scheme: SCHEME,
                path: ethereumHdPath(account, keyIndex),
                id: ethereumHdKeyId(seedRef, account, keyIndex),
            },
            SIGNING_ACCESS_DOMAIN,
        )
        return {
            ...key,
            address: ethereumAddressCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    importRawKey: async (kms, bytes, opts) => {
        assertSecp256k1(opts)
        const key = await kms.importRawKey(
            bytes,
            { scheme: SCHEME, id: ethereumRawKeyId(bytes) },
            SIGNING_ACCESS_DOMAIN,
        )
        return {
            keyPairId: key.keyPairId,
            address: ethereumAddressCodec.fromPublicKey(key.publicKey, opts),
        }
    },
    // Only the first address: wallets that share this path hand out index 0
    // first, so it is the one a restored seed has activity on.
    discover: async (kms, seedRef, probe, opts) => {
        const { address, keyPairId } =
            await ethereumKeyDerivation.deriveAccount(kms, seedRef, 0, 0, opts)
        return (await probe(address))
            ? [{ account: 0, keyIndex: 0, address, keyPairId }]
            : []
    },
}
