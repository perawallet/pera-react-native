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

import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { linkTargetOf, type AnyParsedDeeplink } from './links'
import type { ChainDeeplinkIntent, ChainLinkTarget } from './models'
import { peraLinkChainFailure } from './pera-link-chain'
import { resolveChainDeeplink } from './resolve'

/**
 * A switched-off chain, or a Pera link's unknown `chain=`, claimed the link: the
 * caller refuses it with a reason rather than calling it "not a link".
 */
export const isUnsupportedChainLink = (url: string): boolean => {
    if (peraLinkChainFailure(url)) return true
    const resolution = resolveChainDeeplink(url)
    return (
        resolution.status === 'failed' &&
        resolution.reason === 'chain-unavailable'
    )
}

/**
 * The chain that recognised the link but refuses what it asks for (an EIP-681
 * `approve`), so the caller can say so instead of calling it "not a link".
 */
export const unsupportedActionChainOf = (url: string): Optional<ChainId> => {
    const resolution = resolveChainDeeplink(url)
    return resolution.status === 'failed' &&
        resolution.reason === 'unsupported-action'
        ? resolution.chainId
        : undefined
}

type AddressIntent = Extract<ChainDeeplinkIntent, { kind: 'address' }>

export type AddressCandidates = { address: string; chainIds: ChainId[] }

/**
 * The chains a raw address could be on, when more than one codec accepts it.
 * `parseDeeplink` returns null for such text: the chain is the user's call,
 * never a guess from the address's shape.
 */
export const addressCandidatesOf = (
    url: string,
): Optional<AddressCandidates> => {
    const resolution = resolveChainDeeplink(url)
    if (resolution.status !== 'resolved') return undefined
    const intents = resolution.intents.filter(
        (intent): intent is AddressIntent => intent.kind === 'address',
    )
    const [first] = intents
    if (!first || intents.length < 2) return undefined
    if (intents.length !== resolution.intents.length) return undefined
    return {
        address: first.address,
        chainIds: intents.map(intent => intent.target.chainId),
    }
}

/**
 * The link's target when it names a network other than its chain's selected
 * one. A link never switches network, so the caller refuses it; a link naming
 * no network runs on the selected one.
 */
export const linkNetworkMismatchOf = (
    link: AnyParsedDeeplink,
    selectedNetworkOf: (chainId: ChainId) => NetworkId,
): Optional<ChainLinkTarget> => {
    const target = linkTargetOf(link)
    if (!target?.networkId) return undefined
    return target.networkId === selectedNetworkOf(target.chainId)
        ? undefined
        : target
}
