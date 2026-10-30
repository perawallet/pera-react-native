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

import { getAddress, isAddress, isHex, maxUint256, size } from 'viem'
import type { AccessList, Address, Hex } from 'viem'
import type {
    ChainContext,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { DappRequestValidation } from '@perawallet/wallet-core-connections'
import type { Optional } from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { toEvmError } from '../blockchain/errors'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { ethereumCallSummary } from '../signing/review'
import type { EthereumTransactionPayload } from '../signing/adapter'
import { readEvmFeePresets } from '../transfer/fees'
import { allocateEthereumNonce } from '../transfer/nonce-pool'

/** What a dApp's `eth_sendTransaction` asks for once validated; the wallet picks the nonce and the fees. */
export type EthereumSendTransactionRequest = {
    from: Address
    to: Address
    /** Wei. */
    value: bigint
    data: Hex
    /** Gas units; estimated when absent. */
    gas?: bigint
    accessList?: AccessList
}

export type EthereumSendTransactionSession = {
    authorizedAccounts: readonly string[]
    /** The active network's EIP-155 id, or undefined when it has none. */
    eip155ChainId: Optional<number>
}

type Validation = DappRequestValidation<EthereumSendTransactionRequest>

const invalid = (message: string): Validation => ({
    ok: false,
    failure: 'invalid-params',
    message,
})

const REBUILT_AS_EIP1559_TYPES: readonly bigint[] = [0n, 1n, 2n]

// EIP-4844 blobs are for rollups posting data, and a signed EIP-7702
// authorization hands the account to the delegate's code.
const REFUSED_FIELDS = [
    'blobVersionedHashes',
    'maxFeePerBlobGas',
    'blobs',
    'authorizationList',
] as const

const QUANTITY = /^0x[0-9a-f]+$/i
const STORAGE_KEY_BYTES = 32

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const readQuantity = (value: unknown): Optional<bigint> =>
    typeof value === 'string' && QUANTITY.test(value)
        ? BigInt(value)
        : undefined

const isEvenHex = (value: unknown): value is Hex =>
    typeof value === 'string' &&
    isHex(value, { strict: true }) &&
    value.length % 2 === 0

const isAccessList = (value: unknown): value is AccessList =>
    Array.isArray(value) &&
    value.every(
        (entry: unknown) =>
            isRecord(entry) &&
            typeof entry.address === 'string' &&
            isAddress(entry.address) &&
            Array.isArray(entry.storageKeys) &&
            entry.storageKeys.every(
                (key: unknown) =>
                    isEvenHex(key) && size(key) === STORAGE_KEY_BYTES,
            ),
    )

const isHeldBy = (
    from: unknown,
    authorizedAccounts: readonly string[],
): boolean =>
    typeof from === 'string' &&
    isAddress(from) &&
    authorizedAccounts.some(account => areEvmAddressesEqual(account, from))

/**
 * Applies the field rules to a dApp's `eth_sendTransaction` object. Fee fields
 * and `nonce` are ignored: the wallet always picks both.
 */
export const validateEthereumSendTransaction = (
    params: unknown,
    session: EthereumSendTransactionSession,
): Validation => {
    if (!isRecord(params)) {
        return invalid('The transaction must be an object')
    }
    if (!isHeldBy(params.from, session.authorizedAccounts)) {
        return {
            ok: false,
            failure: 'unauthorized-account',
            message: 'The from address is not an account of this session',
        }
    }
    const from = getAddress(params.from as string)

    if (params.type !== undefined) {
        const type = readQuantity(params.type)
        if (type === undefined || !REBUILT_AS_EIP1559_TYPES.includes(type)) {
            return invalid(
                'Only legacy, EIP-2930 and EIP-1559 transactions are supported',
            )
        }
    }
    if (REFUSED_FIELDS.some(field => params[field] !== undefined)) {
        return invalid(
            'Blob and authorization list transactions are not supported',
        )
    }
    if (
        params.chainId !== undefined &&
        (session.eip155ChainId === undefined ||
            readQuantity(params.chainId) !== BigInt(session.eip155ChainId))
    ) {
        return invalid('The chainId is not the active chain')
    }
    if (typeof params.to !== 'string' || !isAddress(params.to)) {
        return invalid(
            'A transaction needs a to address; contract creation is not supported',
        )
    }

    const value = params.value === undefined ? 0n : readQuantity(params.value)
    if (value === undefined || value > maxUint256) {
        return invalid('The value is not a valid quantity')
    }

    // Both spellings are in the wild; calldata is never silently dropped.
    const calldata = [params.data, params.input].filter(
        field => field !== undefined,
    )
    if (!calldata.every(isEvenHex)) {
        return invalid('The data is not valid hex')
    }
    if (new Set(calldata.map(field => field.toLowerCase())).size > 1) {
        return invalid('The data and input fields disagree')
    }
    const data: Hex = calldata[0] ?? '0x'

    let gas: Optional<bigint>
    if (params.gas !== undefined) {
        gas = readQuantity(params.gas)
        if (gas === undefined || gas === 0n) {
            return invalid('The gas is not a valid quantity')
        }
    }
    if (
        params.gasPrice !== undefined &&
        (params.maxFeePerGas !== undefined ||
            params.maxPriorityFeePerGas !== undefined)
    ) {
        return invalid('gasPrice cannot be combined with EIP-1559 fee fields')
    }
    if (params.accessList !== undefined && !isAccessList(params.accessList)) {
        return invalid('The accessList is malformed')
    }

    return {
        ok: true,
        request: {
            from,
            to: getAddress(params.to),
            value,
            data,
            ...(gas !== undefined && { gas }),
            ...(params.accessList !== undefined && {
                accessList: params.accessList,
            }),
        },
    }
}

/**
 * Builds the transaction the wallet will sign on the context's network: its
 * own nonce and normal-preset fees, and the dApp's gas when it gave one.
 */
export const buildEthereumSendTransaction = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: EthereumSendTransactionRequest,
): Promise<UnsignedTransaction> => {
    const scope = ctx.getScope()
    const client = createEvmClient(scope, ctx, chain)
    const { from, to, value, data, accessList } = request
    const [nonce, gas, fees] = await Promise.all([
        allocateEthereumNonce({ client, scope, sender: from }),
        request.gas ??
            client.estimateGas({
                account: from,
                to,
                value,
                data,
                ...(accessList && { accessList }),
            }),
        readEvmFeePresets(client, chain, scope.networkId),
    ]).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    const { maxFeePerGas, maxPriorityFeePerGas } = fees.presets.normal
    const payload: EthereumTransactionPayload = {
        from,
        transaction: {
            type: 'eip1559',
            chainId: eip155ChainIdOf(scope, chain),
            nonce,
            to,
            value,
            data,
            gas,
            maxFeePerGas,
            maxPriorityFeePerGas,
            ...(accessList && { accessList }),
        },
    }
    return {
        scope,
        payload,
        summary: ethereumCallSummary({ from, to, value, data }, chain),
        chainData: { family: 'evm' },
    }
}
