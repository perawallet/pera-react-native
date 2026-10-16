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
    bytesToHex,
    getTypesForEIP712Domain,
    hexToBytes,
    isHex,
    serializeSignature,
    toHex,
    validateTypedData,
} from 'viem'
import type { Hex, TypedDataDefinition, TypedDataParameter } from 'viem'
import { chainAccountOf, signingKeyOn } from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    type ChainScope,
    type MessageRequest,
    type MessageSummary,
    type MessageTreeNode,
    type Signature,
    type SignedMessage,
    type SigningRequest,
} from '@perawallet/wallet-core-chain-contract'
import { decodePrintableUtf8 } from '@perawallet/wallet-core-shared'
import {
    CannotSignError,
    type MessagePlanContext,
    type MessageSignKind,
    type MessageSignerChainAdapter,
} from '@perawallet/wallet-core-signing'
import { ethereumAddressCodec } from '../accounts/address-codec'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import { ETHEREUM_CHAIN_ID } from '../chain-id'
import { ETHEREUM_WC_V2_METHOD } from '../connect/walletConnect'
import { isRecord } from './adapter'
import {
    personalMessageDigest,
    typedDataDigest,
    type TaggedDigest,
} from './digests'
import { spendApprovalOf } from './permits'
import { toViemSignature } from './sign'

/** The `MessageRequest.payload` for `personal_sign`. */
export type EthereumPersonalSignPayload = {
    /** The exact bytes signed, before the EIP-191 prefix. */
    message: Hex
}

/** The `MessageRequest.payload` for `eth_signTypedData_v4`. */
export type EthereumTypedDataPayload = {
    /** The EIP-712 v4 object as the dApp sent it, JSON-parsed. */
    typedData: TypedDataDefinition
}

const PERSONAL_SIGN = ETHEREUM_WC_V2_METHOD.personalSign
const SIGN_TYPED_DATA_V4 = ETHEREUM_WC_V2_METHOD.signTypedDataV4
const TITLE_KEY = i18nKey('signing.arbitrary_data_view.body')

export const personalSignMessageRequest = (
    scope: ChainScope,
    signer: string,
    message: Hex,
): MessageRequest => ({
    scope,
    method: PERSONAL_SIGN,
    signer,
    payload: { message } satisfies EthereumPersonalSignPayload,
})

export const typedDataMessageRequest = (
    scope: ChainScope,
    signer: string,
    typedData: unknown,
): MessageRequest => ({
    scope,
    method: SIGN_TYPED_DATA_V4,
    signer,
    payload: { typedData },
})

const supports = (method: string): boolean =>
    method === PERSONAL_SIGN || method === SIGN_TYPED_DATA_V4

const isSignableKind = (kind: MessageSignKind): boolean =>
    kind === 'message' || kind === 'typedData'

// `payload` is `unknown` and may come from a dApp, so these readers are the
// trust boundary for `describe`, `plan` and `assemble`.
const readPersonalSign = (payload: unknown): EthereumPersonalSignPayload => {
    if (
        !isRecord(payload) ||
        typeof payload.message !== 'string' ||
        !isHex(payload.message, { strict: true }) ||
        payload.message.length % 2 !== 0
    ) {
        throw new Error('The personal_sign message payload is malformed')
    }
    return { message: payload.message }
}

const MALFORMED_TYPED_DATA = 'The typed-data message payload is malformed'

const parseDomainChainId = (chainId: unknown): bigint | undefined => {
    if (chainId === undefined) return undefined
    if (
        typeof chainId !== 'number' &&
        typeof chainId !== 'bigint' &&
        typeof chainId !== 'string'
    ) {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    try {
        return BigInt(chainId)
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
}

// When the dApp declares no `EIP712Domain`, viem derives the domain's types
// from its values and silently drops a string `chainId`, which would sign a
// domain bound to no chain. As a bigint it is typed as the uint256 the dApp
// meant. A declared `EIP712Domain` is hashed as declared, so it is left alone.
const readTypedData = (payload: unknown): TypedDataDefinition => {
    const typedData = isRecord(payload) ? payload.typedData : undefined
    if (
        !isRecord(typedData) ||
        !isRecord(typedData.types) ||
        typeof typedData.primaryType !== 'string' ||
        !isRecord(typedData.message) ||
        (typedData.domain !== undefined && !isRecord(typedData.domain))
    ) {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    // A domain-only signature hashes no message, so a review of `message`
    // would show content the signature never binds.
    if (typedData.primaryType === 'EIP712Domain') {
        throw new Error(MALFORMED_TYPED_DATA)
    }
    const { domain, types } = typedData
    const chainId = parseDomainChainId(domain?.chainId)
    const definition = (domain &&
    chainId !== undefined &&
    types.EIP712Domain === undefined
        ? { ...typedData, domain: { ...domain, chainId } }
        : typedData) as unknown as TypedDataDefinition
    try {
        validateTypedData(definition)
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
    return definition
}

const ARRAY_TYPE = /^(.+)\[\d*\]$/

// Labels and string leaves are the dApp's text: shown as hex unless printable,
// so bidi or zero-width characters can't disguise a field in the review.
const screened = (text: string): string =>
    text === ''
        ? text
        : (decodePrintableUtf8(new TextEncoder().encode(text)) ?? toHex(text))

const leafOf = (value: unknown): string => {
    if (typeof value === 'string') return screened(value)
    if (value instanceof Uint8Array) return bytesToHex(value)
    return String(value)
}

// Walked by the schema rather than the object, so the tree shows exactly the
// fields that are hashed: a key the dApp adds outside `types` is never signed.
const fieldNode = (
    types: Record<string, readonly TypedDataParameter[]>,
    name: string,
    type: string,
    value: unknown,
): MessageTreeNode => {
    const label = screened(name)
    const element = ARRAY_TYPE.exec(type)?.[1]
    if (element !== undefined) {
        const items = Array.isArray(value) ? value : []
        return {
            label,
            children: items.map((item, index) =>
                fieldNode(types, String(index), element, item),
            ),
        }
    }
    if (types[type]) {
        return { label, children: structFields(types, type, value) }
    }
    return { label, value: leafOf(value) }
}

const structFields = (
    types: Record<string, readonly TypedDataParameter[]>,
    type: string,
    value: unknown,
): MessageTreeNode[] => {
    const record = isRecord(value) ? value : {}
    return (types[type] ?? []).map(field =>
        fieldNode(types, field.name, field.type, record[field.name]),
    )
}

const typedDataTree = (typedData: TypedDataDefinition): MessageTreeNode[] => {
    const domain = typedData.domain ?? {}
    // A dApp-supplied `EIP712Domain` wins, as it does in viem's `hashTypedData`.
    const types = {
        EIP712Domain: getTypesForEIP712Domain({ domain }),
        ...(typedData.types as Record<string, readonly TypedDataParameter[]>),
    }
    return [
        {
            label: 'domain',
            children: structFields(types, 'EIP712Domain', domain),
        },
        {
            label: 'message',
            children: structFields(
                types,
                typedData.primaryType as string,
                typedData.message,
            ),
        },
    ]
}

const describePersonalSign = (payload: unknown): MessageSummary => {
    const title = { key: TITLE_KEY }
    let message: Hex
    try {
        ;({ message } = readPersonalSign(payload))
    } catch {
        return { kind: 'raw', title }
    }
    const text = decodePrintableUtf8(hexToBytes(message))
    return text === undefined
        ? { kind: 'raw', title, preview: message }
        : { kind: 'text', title, preview: text }
}

const describeTypedData = (payload: unknown): MessageSummary => {
    const title = { key: TITLE_KEY }
    let typedData: TypedDataDefinition
    let tree: MessageTreeNode[]
    try {
        typedData = readTypedData(payload)
        tree = typedDataTree(typedData)
    } catch {
        return { kind: 'raw', title }
    }
    const spendApproval = spendApprovalOf(typedData, Date.now())
    return {
        kind: 'typed-data',
        title,
        preview: typedData.primaryType as string,
        tree,
        ...(spendApproval && { spendApproval }),
    }
}

const describe = (request: MessageRequest): MessageSummary => {
    if (request.method === PERSONAL_SIGN) {
        return describePersonalSign(request.payload)
    }
    if (request.method === SIGN_TYPED_DATA_V4) {
        return describeTypedData(request.payload)
    }
    throw new Error(`Unsupported message method ${request.method}`)
}

const typedDataDigestFor = (request: MessageRequest): TaggedDigest => {
    const typedData = readTypedData(request.payload)
    const domainChainId = typedData.domain?.chainId
    // A signature over another chain's domain would be valid there.
    if (
        domainChainId !== undefined &&
        BigInt(domainChainId) !== BigInt(eip155ChainIdOf(request.scope))
    ) {
        throw new Error(
            `The typed data is for EIP-155 chain ${domainChainId}, not ${request.scope.networkId}`,
        )
    }
    try {
        return typedDataDigest(typedData)
    } catch (error) {
        throw new Error(MALFORMED_TYPED_DATA, { cause: error })
    }
}

const plan = (
    request: MessageRequest,
    { account }: MessagePlanContext,
): SigningRequest[] => {
    const ownAddress = chainAccountOf(account, ETHEREUM_CHAIN_ID)?.address
    const refuse = (reason: string) =>
        new CannotSignError(ownAddress ?? request.signer, reason)
    if (request.scope.chainId !== ETHEREUM_CHAIN_ID) {
        throw refuse(
            `not an Ethereum message request: ${request.scope.chainId}`,
        )
    }
    if (!supports(request.method)) {
        throw refuse(`unsupported message method ${request.method}`)
    }
    if (!ownAddress) {
        throw refuse('the account has no Ethereum address')
    }
    if (!ethereumAddressCodec.areEqual(request.signer, ownAddress)) {
        throw refuse(`the request names ${request.signer} as its signer`)
    }
    const digest =
        request.method === PERSONAL_SIGN
            ? personalMessageDigest({
                  raw: readPersonalSign(request.payload).message,
              })
            : typedDataDigestFor(request)
    return [
        {
            requestIndex: 0,
            signer: ownAddress,
            scheme: 'secp256k1',
            payload: digest.digest,
        },
    ]
}

const assemble = (
    request: MessageRequest,
    signatures: Signature[],
): SignedMessage => {
    const [signature] = signatures
    if (
        !supports(request.method) ||
        signatures.length !== 1 ||
        signature.requestIndex !== 0 ||
        signature.scheme !== 'secp256k1' ||
        !ethereumAddressCodec.areEqual(signature.signer, request.signer)
    ) {
        throw new Error(
            'An Ethereum message takes exactly one secp256k1 signature, from its signer',
        )
    }
    const tag = request.method === PERSONAL_SIGN ? 'eip191-message' : 'eip712'
    return {
        scope: request.scope,
        signature: {
            ...signature,
            bytes: hexToBytes(
                serializeSignature(toViemSignature(signature.bytes, tag)),
            ),
        },
    }
}

export const ethereumMessageSignerAdapter: MessageSignerChainAdapter = {
    chainId: ETHEREUM_CHAIN_ID,
    // Local keys only.
    canSign: (account, kind) =>
        isSignableKind(kind) &&
        signingKeyOn(account, ETHEREUM_CHAIN_ID) !== undefined,
    // Every EVM verifier recovers a secp256k1 signature.
    signsVerifiably: (_account, kind) => isSignableKind(kind),
    supports,
    describe,
    plan,
    assemble,
}
