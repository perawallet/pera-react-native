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

import { Decimal } from 'decimal.js'
import { getAddress, isAddress, maxUint256 } from 'viem'
import {
    addressCodecs,
    isEvmChainId,
    isNativeAsset,
    type AssetRef,
    type ChainId,
    type ChainScope,
    type NetworkId,
    type PaymentUriOpts,
} from '@perawallet/wallet-core-chain-contract'
import {
    uriSchemeOf,
    type ChainLinkTarget,
    type DeeplinkChainAdapter,
    type DeeplinkParseFailure,
    type DeeplinkParseResult,
} from '@perawallet/wallet-core-deeplinks'
import type { Optional } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import { evmChainOf, evmChainOfEip155Id } from '../chains/table'
import type { EvmChain } from '../chains/types'

const SCHEME = 'ethereum:'
// EIP-681 reads a link without `@<chain id>` as one for chain 1.
const EIP681_DEFAULT_EIP155_CHAIN_ID = 1
const PATH_PATTERN = /^(?:pay-)?([^@/]*)(?:@([^/]*))?(?:\/(.*))?$/
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const ENS_NAME_PATTERN = /^[^.]+(?:\.[^.]+)+$/
const AMOUNT_PATTERN = /^\d+(\.\d+)?([eE]\d+)?$/
const MAX_UINT256 = new Decimal(maxUint256.toString())
const SINGLE_PARAMS = ['value', 'address', 'uint256']

// Base units are whole numbers; a fraction means display units leaked in.
const parseBaseUnits = (raw: string): Optional<Decimal> => {
    if (!AMOUNT_PATTERN.test(raw)) return undefined
    const amount = new Decimal(raw)
    return amount.isFinite() && amount.isInteger() && amount.lte(MAX_UINT256)
        ? amount
        : undefined
}

// Hand-written: React Native's URLSearchParams throws on a malformed escape and
// cuts a value at its second `=`, where Node keeps it. Only the keys the
// grammar uses are decoded; gas, gasLimit and the rest are never read.
const readQuery = (query: string): Optional<Map<string, string>> => {
    const params = new Map<string, string>()
    for (const segment of query.split('&')) {
        const eq = segment.indexOf('=')
        const key = eq < 0 ? segment : segment.slice(0, eq)
        if (!SINGLE_PARAMS.includes(key)) continue
        if (params.has(key)) return undefined
        try {
            params.set(
                key,
                eq < 0 ? '' : decodeURIComponent(segment.slice(eq + 1)),
            )
        } catch {
            return undefined
        }
    }
    return params
}

const fail = (reason: DeeplinkParseFailure): DeeplinkParseResult => ({
    ok: false,
    reason,
})

// viem's strict isAddress is what the codec's isValid is; the codec imports
// this module, so it cannot be called from here.
const checkAddress = (raw: string): Optional<DeeplinkParseFailure> => {
    if (ADDRESS_PATTERN.test(raw)) {
        return isAddress(raw) ? undefined : 'malformed'
    }
    return ENS_NAME_PATTERN.test(raw) ? 'unsupported-action' : 'malformed'
}

const canParseWith =
    (chain: EvmChain) =>
    (input: string): boolean =>
        chain.descriptor.uriSchemes.includes(uriSchemeOf(input) ?? '')

export type Eip681ParseOptions = {
    /** The registered scope that owns an `@<eip155 id>`; undefined rejects the link. */
    resolve: (eip155ChainId: number) => Optional<ChainScope>
    /** The chain a link without `@<eip155 id>` pays on; undefined rejects such a link as unsupported-network. */
    defaultChainId: Optional<ChainId>
    nativeAssetOf: (chainId: ChainId) => AssetRef
}

export const parseEip681Uri = (
    input: string,
    { resolve, defaultChainId, nativeAssetOf }: Eip681ParseOptions,
): DeeplinkParseResult => {
    if (uriSchemeOf(input) !== SCHEME.slice(0, -1)) return fail('malformed')

    const rest = input.slice(input.indexOf(':') + 1)
    const queryStart = rest.indexOf('?')
    const path = queryStart === -1 ? rest : rest.slice(0, queryStart)
    const query = queryStart === -1 ? '' : rest.slice(queryStart + 1)
    const match = PATH_PATTERN.exec(path)
    if (!match) return fail('malformed')
    const [, target, rawChainId, functionName] = match

    const targetFailure = checkAddress(target)
    if (targetFailure) return fail(targetFailure)

    let linkTarget: ChainLinkTarget
    if (rawChainId !== undefined) {
        if (!/^\d+$/.test(rawChainId)) return fail('malformed')
        const scope = resolve(Number(rawChainId))
        if (!scope) return fail('unsupported-network')
        linkTarget = { chainId: scope.chainId, networkId: scope.networkId }
    } else {
        if (defaultChainId === undefined) return fail('unsupported-network')
        linkTarget = { chainId: defaultChainId }
    }

    // A link-initiated approval is a drain vector and the wallet decodes no
    // calldata, so only transfer is understood.
    if (functionName === '') return fail('malformed')
    if (functionName !== undefined && functionName !== 'transfer') {
        return fail('unsupported-action')
    }

    const params = readQuery(query)
    if (!params) return fail('malformed')

    const value = params.get('value') ?? null

    if (functionName === undefined) {
        const amount = value === null ? undefined : parseBaseUnits(value)
        if (value !== null && !amount) return fail('malformed')
        return {
            ok: true,
            intent: {
                kind: 'payment',
                target: linkTarget,
                recipient: getAddress(target),
                assetRef: nativeAssetOf(linkTarget.chainId),
                ...(amount && { amount }),
            },
        }
    }

    // A token transfer cannot carry ether.
    if (value !== null) return fail('unsupported-action')
    const recipient = params.get('address') ?? null
    if (recipient === null) return fail('malformed')
    const recipientFailure = checkAddress(recipient)
    if (recipientFailure) return fail(recipientFailure)
    const rawAmount = params.get('uint256') ?? null
    const amount = rawAmount === null ? undefined : parseBaseUnits(rawAmount)
    if (rawAmount !== null && !amount) return fail('malformed')
    return {
        ok: true,
        intent: {
            kind: 'payment',
            target: linkTarget,
            recipient: getAddress(recipient),
            assetRef: {
                chainId: linkTarget.chainId,
                assetId: getAddress(target),
            },
            ...(amount && { amount }),
        },
    }
}

const nativeAssetOfEvmChain = (chainId: ChainId): AssetRef => {
    if (!isEvmChainId(chainId)) {
        throw new Error(`${chainId} is not an EVM chain`)
    }
    return evmChainOf(chainId).descriptor.nativeAsset.ref
}

/** Resolves an `@<eip155 id>` against every chain in the EVM table. */
export const resolveEvmScope = (
    eip155ChainId: number,
): Optional<ChainScope> => {
    const owner = evmChainOfEip155Id(eip155ChainId)
    return owner && { chainId: owner.chain.row.id, networkId: owner.networkId }
}

/**
 * Only one adapter may claim `ethereum:`, so the first EVM chain registered
 * serves the links of every registered EVM chain.
 */
export const createEvmDeeplinkAdapter = (
    owner: EvmChain,
): DeeplinkChainAdapter => {
    const isRegistered = (chainId: ChainId): boolean =>
        addressCodecs.has(chainId)
    const resolve = (eip155ChainId: number): Optional<ChainScope> => {
        const scope = resolveEvmScope(eip155ChainId)
        return scope && isRegistered(scope.chainId) ? scope : undefined
    }
    return {
        chainId: owner.row.id,
        schemes: owner.descriptor.uriSchemes,
        canParse: canParseWith(owner),
        parse: input =>
            parseEip681Uri(input, {
                resolve,
                // No fallback to the owner: paying a chain-1 link on another EVM chain
                // sends to the same address there.
                defaultChainId: resolve(EIP681_DEFAULT_EIP155_CHAIN_ID)
                    ?.chainId,
                nativeAssetOf: nativeAssetOfEvmChain,
            }),
        toAssetRef: (raw): Optional<AssetRef> =>
            isAddress(raw)
                ? { chainId: owner.row.id, assetId: getAddress(raw) }
                : undefined,
    }
}

export const parseEvmPaymentUri = (input: string): DeeplinkParseResult =>
    parseEip681Uri(input, {
        resolve: resolveEvmScope,
        defaultChainId: resolveEvmScope(EIP681_DEFAULT_EIP155_CHAIN_ID)
            ?.chainId,
        nativeAssetOf: nativeAssetOfEvmChain,
    })

// A link without `@<chain id>` is chain 1's, so every other chain names its
// mainnet when no network is given.
const eip155ChainIdOfLink = (
    chain: EvmChain,
    networkId: Optional<NetworkId>,
): Optional<number> => {
    if (networkId !== undefined) return eip155ChainIdOfNetwork(chain, networkId)
    const mainnet = chain.descriptor.networks.find(n => n.tier === 'mainnet')
    const eip155ChainId = mainnet && eip155ChainIdOfNetwork(chain, mainnet.id)
    return eip155ChainId === EIP681_DEFAULT_EIP155_CHAIN_ID
        ? undefined
        : eip155ChainId
}

export const toEip681Uri = (
    chain: EvmChain,
    address: string,
    opts?: PaymentUriOpts,
): string => {
    if (
        opts?.amount &&
        (opts.amount.isNegative() || !opts.amount.isInteger())
    ) {
        throw new Error('Payment amount must be a whole number of base units')
    }
    // toFixed: Decimal#toString gives "1e+21", which EIP-681 cannot parse.
    const amount = opts?.amount?.toFixed()
    const eip155ChainId = eip155ChainIdOfLink(chain, opts?.networkId)
    const chainSuffix = eip155ChainId === undefined ? '' : `@${eip155ChainId}`
    const assetRef = opts?.assetRef

    if (!assetRef || isNativeAsset(assetRef, chain.descriptor)) {
        return `${SCHEME}${getAddress(address)}${chainSuffix}${amount ? `?value=${amount}` : ''}`
    }
    return `${SCHEME}${getAddress(assetRef.assetId)}${chainSuffix}/transfer?address=${getAddress(address)}${amount ? `&uint256=${amount}` : ''}`
}
