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
    isNativeAsset,
    type AssetRef,
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
import {
    eip155ChainIdOfNetwork,
    networkIdOfEip155ChainId,
} from '../blockchain/utils/caip19'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ethereumDescriptor } from '../descriptor'

const SCHEME = 'ethereum:'
const PATH_PATTERN = /^(?:pay-)?([^@/]*)(?:@([^/]*))?(?:\/(.*))?$/
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
const ENS_NAME_PATTERN = /^[^.]+(?:\.[^.]+)+$/
const AMOUNT_PATTERN = /^\d+(\.\d+)?([eE]\d+)?$/
const MAX_UINT256 = new Decimal(maxUint256.toString())
const SINGLE_PARAMS = ['value', 'address', 'uint256']

// Base units are whole numbers; a fraction means display units leaked in.
const parseBaseUnits = (raw: string): Decimal | undefined => {
    if (!AMOUNT_PATTERN.test(raw)) return undefined
    const amount = new Decimal(raw)
    return amount.isFinite() && amount.isInteger() && amount.lte(MAX_UINT256)
        ? amount
        : undefined
}

const fail = (reason: DeeplinkParseFailure): DeeplinkParseResult => ({
    ok: false,
    reason,
})

// viem's strict isAddress is what the codec's isValid is; the codec imports
// this module, so it cannot be called from here.
const checkAddress = (raw: string): DeeplinkParseFailure | undefined => {
    if (ADDRESS_PATTERN.test(raw)) {
        return isAddress(raw) ? undefined : 'malformed'
    }
    return ENS_NAME_PATTERN.test(raw) ? 'unsupported-action' : 'malformed'
}

const canParse = (input: string): boolean =>
    ethereumDescriptor.uriSchemes.includes(uriSchemeOf(input) ?? '')

const parse = (input: string): DeeplinkParseResult => {
    if (!canParse(input)) return fail('malformed')

    const rest = input.slice(input.indexOf(':') + 1)
    const queryStart = rest.indexOf('?')
    const path = queryStart === -1 ? rest : rest.slice(0, queryStart)
    const query = queryStart === -1 ? '' : rest.slice(queryStart + 1)
    const match = PATH_PATTERN.exec(path)
    if (!match) return fail('malformed')
    const [, target, rawChainId, functionName] = match

    const targetFailure = checkAddress(target)
    if (targetFailure) return fail(targetFailure)

    let networkId: NetworkId | undefined
    if (rawChainId !== undefined) {
        if (!/^\d+$/.test(rawChainId)) return fail('malformed')
        networkId = networkIdOfEip155ChainId(Number(rawChainId))
        if (!networkId) return fail('unsupported-network')
    }

    // A link-initiated approval is a drain vector and the wallet decodes no
    // calldata, so only transfer is understood.
    if (functionName === '') return fail('malformed')
    if (functionName !== undefined && functionName !== 'transfer') {
        return fail('unsupported-action')
    }

    const params = new URLSearchParams(query)
    if (SINGLE_PARAMS.some(key => params.getAll(key).length > 1)) {
        return fail('malformed')
    }

    const linkTarget: ChainLinkTarget = {
        chainId: ETHEREUM_CHAIN_ID,
        ...(networkId && { networkId }),
    }
    const value = params.get('value')

    if (functionName === undefined) {
        const amount = value === null ? undefined : parseBaseUnits(value)
        if (value !== null && !amount) return fail('malformed')
        return {
            ok: true,
            intent: {
                kind: 'payment',
                target: linkTarget,
                recipient: getAddress(target),
                assetRef: ethereumDescriptor.nativeAsset.ref,
                ...(amount && { amount }),
            },
        }
    }

    // Ether sent with the call would be silently dropped by a token transfer.
    if (value !== null) return fail('unsupported-action')
    const recipient = params.get('address')
    if (recipient === null) return fail('malformed')
    const recipientFailure = checkAddress(recipient)
    if (recipientFailure) return fail(recipientFailure)
    const rawAmount = params.get('uint256')
    const amount = rawAmount === null ? undefined : parseBaseUnits(rawAmount)
    if (rawAmount !== null && !amount) return fail('malformed')
    return {
        ok: true,
        intent: {
            kind: 'payment',
            target: linkTarget,
            recipient: getAddress(recipient),
            assetRef: {
                chainId: ETHEREUM_CHAIN_ID,
                assetId: getAddress(target),
            },
            ...(amount && { amount }),
        },
    }
}

export const ethereumDeeplinkAdapter: DeeplinkChainAdapter = {
    chainId: ETHEREUM_CHAIN_ID,
    schemes: ethereumDescriptor.uriSchemes,
    canParse,
    parse,
    toAssetRef: (raw): AssetRef | undefined =>
        isAddress(raw)
            ? { chainId: ETHEREUM_CHAIN_ID, assetId: getAddress(raw) }
            : undefined,
}

export const toEip681Uri = (address: string, opts?: PaymentUriOpts): string => {
    if (
        opts?.amount &&
        (opts.amount.isNegative() || !opts.amount.isInteger())
    ) {
        throw new Error('Payment amount must be a whole number of base units')
    }
    // toFixed: Decimal#toString gives "1e+21", which EIP-681 cannot parse.
    const amount = opts?.amount?.toFixed()
    const eip155ChainId = eip155ChainIdOfNetwork(opts?.networkId)
    const chain = eip155ChainId === undefined ? '' : `@${eip155ChainId}`
    const assetRef = opts?.assetRef

    if (!assetRef || isNativeAsset(assetRef, ethereumDescriptor)) {
        return `${SCHEME}${getAddress(address)}${chain}${amount ? `?value=${amount}` : ''}`
    }
    return `${SCHEME}${getAddress(assetRef.assetId)}${chain}/transfer?address=${getAddress(address)}${amount ? `&uint256=${amount}` : ''}`
}
