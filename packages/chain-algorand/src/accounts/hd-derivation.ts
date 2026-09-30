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

import {
    BIP32DerivationType,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import type { KeyDerivationRequest } from '@perawallet/wallet-core-chain-contract'

// BIP44 Algorand address path (coin type 283). The rn-keystore's `parsePath`
// adds the hardened bit (0x80000000) to apostrophe-suffixed components, so
// the raw numbers are passed through here.
const buildAddressPath = (account: number, keyIndex: number): string =>
    `m/44'/283'/${account}'/0/${keyIndex}`

export const algorandHdDerivationRequest = (
    seedKeyId: string,
    account: number,
    keyIndex: number,
    derivationType: BIP32DerivationType,
): KeyDerivationRequest => {
    const path = buildAddressPath(account, keyIndex)
    return {
        scheme: 'ed25519',
        path,
        id: hdDerivedKeyId(seedKeyId, account, keyIndex, derivationType),
        params: {
            mode:
                derivationType === BIP32DerivationType.Khovratovich
                    ? 'standard'
                    : 'peikert',
            // Stamp the full metadata `signXHDEd25519` reads. rn-keystore sets
            // `keyIndex` (NOT `index`) and never sets `derivation`, so without
            // this the signing path silently builds a BIP44 path with
            // undefined segments and the signature fails dApp verification.
            metadata: {
                path,
                context: KeyContext.Address,
                account,
                index: keyIndex,
                derivation: derivationType,
            },
        },
    }
}

/**
 * Deterministic keystore id for an `hd-derived-ed25519` child of a bip39
 * seed at the given XHD coords. Exported so consumers can compute the id
 * up-front (e.g. account-discovery wants to stamp `account.keyPairId`
 * before the child is actually committed).
 */
export const hdDerivedKeyId = (
    seedKeyId: string,
    account: number,
    keyIndex: number,
    derivationType: BIP32DerivationType,
): string => `${seedKeyId}-acc${account}-idx${keyIndex}-dt${derivationType}`
