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

import { config } from '@perawallet/wallet-core-config'
import {
    Networks,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * CAIP-2 chain ids, which only WalletConnect v2 speaks — v1 has no concept of
 * them, and keeping them out of `shared/` keeps anything from projecting
 * between the two encodings.
 */

export const ALGORAND_CAIP2_NAMESPACE = 'algorand'

export type AlgorandCaip2ChainId =
    `${typeof ALGORAND_CAIP2_NAMESPACE}:${string}`

const CAIP2_REFERENCE_LENGTH = 32

/**
 * `algorand:` + the first 32 characters of the genesis hash in the *URL-safe*
 * base64 alphabet: the namespace registration replaces `+` with `-` and `/`
 * with `_`, so betanet's plain-base64 hash is not the id a dApp presents.
 * An unset genesis hash (a blanked env override) yields no id rather than a
 * bare `algorand:` prefix that would match nothing real.
 */
export const toCaip2ChainId = (
    genesisHash: string,
): Nullable<AlgorandCaip2ChainId> => {
    if (genesisHash.length < CAIP2_REFERENCE_LENGTH) return null
    const reference = genesisHash
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .slice(0, CAIP2_REFERENCE_LENGTH)
    return `${ALGORAND_CAIP2_NAMESPACE}:${reference}`
}

/**
 * A `Record`, not a fallback ladder, so adding a network to `Network` fails
 * TypeScript here instead of resolving to whatever the last branch returned.
 * Frozen because it is module-level and exported: a caller repointing a
 * network here would silently change which chain every session is checked
 * against, `NETWORK_BY_CAIP2_CHAIN_ID` excepted since it snapshots.
 */
export const CAIP2_CHAIN_ID_BY_NETWORK: Readonly<
    Record<Network, Nullable<AlgorandCaip2ChainId>>
> = Object.freeze({
    [Networks.mainnet]: toCaip2ChainId(config.mainnetGenesisHash),
    [Networks.testnet]: toCaip2ChainId(config.testnetGenesisHash),
    [Networks.betanet]: toCaip2ChainId(config.betanetGenesisHash),
    // `custom` has no CAIP-2 identity at all: its genesis hash is whatever node
    // the developer pointed at and is never baked into config, so no v2 session
    // can claim to be on it.
    [Networks.custom]: null,
})

export const getCaip2ChainId = (
    network: Network,
): Nullable<AlgorandCaip2ChainId> => CAIP2_CHAIN_ID_BY_NETWORK[network]

const NETWORK_BY_CAIP2_CHAIN_ID: ReadonlyMap<string, Network> = new Map(
    Object.values(Networks).flatMap(network => {
        const chainId = CAIP2_CHAIN_ID_BY_NETWORK[network]
        return chainId === null ? [] : [[chainId, network] as [string, Network]]
    }),
)

/** The network a chain id names, or null when it names none of ours. */
export const getNetworkFromCaip2ChainId = (
    chainId: string,
): Nullable<Network> => NETWORK_BY_CAIP2_CHAIN_ID.get(chainId) ?? null

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
 * A CAIP-10 account this wallet may claim authorisation for. A namespace key
 * does not constrain its members, so `namespaces.algorand.accounts` can list
 * an `eip155:1:0x…` — and that address would otherwise land in the approved
 * `accounts` list, which is what gates signing.
 */
export const parseAlgorandCaip10Account = (
    account: string,
): Nullable<Caip10Account> => {
    const parsed = parseCaip10Account(account)
    if (!parsed) return null
    return getNetworkFromCaip2ChainId(parsed.chainId) === null ? null : parsed
}
