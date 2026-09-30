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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { WalletConnectSupport } from '../shared/chainSupport'

export type Caip10Account = {
    chainId: string
    /** The bare address, with the `namespace:reference:` prefix removed. */
    address: string
}

/**
 * Splits a CAIP-10 account id (`namespace:reference:address`), which is the
 * form a session namespace's `accounts` are in. Exactly three non-empty
 * segments: a two-segment value is a chain id, and anything else is not an
 * account this wallet may claim to be authorised for.
 */
export const parseCaip10Account = (
    account: string,
): Nullable<Caip10Account> => {
    const segments = account.split(':')
    if (segments.length !== 3) return null
    const [namespace, reference, address] = segments
    if (!namespace || !reference || !address) return null
    return { chainId: `${namespace}:${reference}`, address }
}

/**
 * A CAIP-10 account this chain's adapter may claim authorisation for. A
 * namespace key does not constrain its members, so `namespaces.<key>.accounts`
 * can list an `eip155:1:0x…` under a namespace keyed by another chain
 * entirely — and that address would otherwise land in the approved `accounts`
 * list, which is what gates signing.
 */
export const parseCaip10AccountIn = (
    support: WalletConnectSupport,
    account: string,
): Nullable<Caip10Account> => {
    const parsed = parseCaip10Account(account)
    if (!parsed) return null
    return support.networkForCaip2ChainId(parsed.chainId) === null
        ? null
        : parsed
}
