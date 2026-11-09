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
import { EvmErrorCode, toEvmError } from '../blockchain/errors'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import type { EvmChain } from '../chains/types'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { ethereumCallSummary } from '../signing/review'
import type {
    EthereumRevertedEstimate,
    EthereumTransactionPayload,
} from '../signing/adapter'
import {
    evmFeePresetOf,
    readEvmFeePresets,
    readEvmGas,
    withRequestedEvmFees,
} from '../transfer/fees'
import { allocateEthereumNonce } from '../transfer/nonce-pool'

/** What a dApp's `eth_sendTransaction` asks for once validated; the wallet picks the nonce, and never signs less gas or fee than its own pricing. */
export type EthereumSendTransactionRequest = {
    from: Address
    to: Address
    /** Wei. */
    value: bigint
    data: Hex
    /** Gas units; the wallet signs the larger of it and its own padded estimate. */
    gas?: bigint
    /** Wei per gas. A legacy `gasPrice` arrives as both fee fields. */
    maxFeePerGas?: bigint
    /** Wei per gas. */
    maxPriorityFeePerGas?: bigint
    accessList?: AccessList
}

// Gas to sign for a call whose estimate reverted: a typical swap or claim
// fits, and a call that does revert burns at most this much. A larger gas
// limit from the dApp wins.
const REVERTED_ESTIMATE_GAS = 500_000n

// A dApp's request is flagged for review when what its gas and fees authorise,
// or would cost at the current base fee, is more than this many times what the
// wallet's own pricing would.
const DAPP_HIGH_FEE_MULTIPLIER = 2n

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
 * Applies the field rules to a dApp's `eth_sendTransaction` object. The
 * `nonce` is ignored: the wallet always picks it.
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
    const fees = [
        params.gasPrice,
        params.maxFeePerGas,
        params.maxPriorityFeePerGas,
    ]
        .filter(field => field !== undefined)
        .map(readQuantity)
    if (fees.some(fee => fee === undefined || fee > maxUint256)) {
        return invalid('The fee fields are not valid quantities')
    }
    const gasPrice = readQuantity(params.gasPrice)
    const maxFeePerGas = gasPrice ?? readQuantity(params.maxFeePerGas)
    const maxPriorityFeePerGas =
        gasPrice ?? readQuantity(params.maxPriorityFeePerGas)
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
            ...(maxFeePerGas !== undefined && { maxFeePerGas }),
            ...(maxPriorityFeePerGas !== undefined && { maxPriorityFeePerGas }),
            ...(params.accessList !== undefined && {
                accessList: params.accessList,
            }),
        },
    }
}

export type EthereumSendTransactionOptions = {
    /**
     * Queues a call whose gas estimate reverts, with a fallback gas limit,
     * instead of refusing it. Only for a caller whose review tells the user
     * the call will likely fail.
     */
    allowRevertedEstimate?: boolean
}

const isRevert = (error: { code: EvmErrorCode }): boolean =>
    error.code === EvmErrorCode.REVERTED ||
    error.code === EvmErrorCode.REVERTED_WITH_REASON

/**
 * Builds the transaction the wallet will sign on the context's network: its
 * own nonce, and the larger of the dApp's gas and fees and the wallet's own
 * estimate and normal preset. A call the node says would revert is refused
 * here, before anything reaches review, unless `allowRevertedEstimate`.
 */
export const buildEthereumSendTransaction = async (
    ctx: ChainContext,
    chain: EvmChain,
    request: EthereumSendTransactionRequest,
    { allowRevertedEstimate = false }: EthereumSendTransactionOptions = {},
): Promise<UnsignedTransaction> => {
    const scope = ctx.getScope()
    const client = createEvmClient(scope, ctx, chain)
    const { from, to, value, data, accessList } = request
    const estimateGas = readEvmGas(client, {
        from,
        to,
        value,
        data,
        accessList,
    }).catch(
        (
            error: unknown,
        ): Awaited<ReturnType<typeof readEvmGas>> & {
            revertedEstimate?: EthereumRevertedEstimate
        } => {
            const failure = toEvmError(error, chain.row.nativeAsset.symbol)
            // A node that runs out of gas is not a revert: that call is refused too.
            if (allowRevertedEstimate && isRevert(failure)) {
                return {
                    gas: REVERTED_ESTIMATE_GAS,
                    gasLimit: REVERTED_ESTIMATE_GAS,
                    // The review warns from this, whatever the simulation says.
                    revertedEstimate: {
                        ...(failure.params.reason !== undefined && {
                            reason: failure.params.reason,
                        }),
                    },
                }
            }
            throw failure
        },
    )
    const [nonce, estimate, fees] = await Promise.all([
        allocateEthereumNonce({ client, scope, sender: from }),
        estimateGas,
        readEvmFeePresets(client, chain, scope.networkId),
    ]).catch((error: unknown) => {
        throw toEvmError(error, chain.row.nativeAsset.symbol)
    })
    const gas =
        request.gas !== undefined && request.gas > estimate.gasLimit
            ? request.gas
            : estimate.gasLimit
    const { maxFeePerGas, maxPriorityFeePerGas } = withRequestedEvmFees(
        fees.baseFeePerGas,
        fees.presets.normal,
        request,
    )
    // The cap and the price actually paid are both checked: a max fee just
    // under the threshold can still charge several times the normal price.
    const normal = fees.presets.normal
    const paidPerGas = (price: bigint, tip: bigint) =>
        price < fees.baseFeePerGas + tip ? price : fees.baseFeePerGas + tip
    const hasHighFee =
        gas * maxFeePerGas >
            DAPP_HIGH_FEE_MULTIPLIER *
                estimate.gasLimit *
                normal.maxFeePerGas ||
        gas * paidPerGas(maxFeePerGas, maxPriorityFeePerGas) >
            DAPP_HIGH_FEE_MULTIPLIER *
                estimate.gasLimit *
                paidPerGas(normal.maxFeePerGas, normal.maxPriorityFeePerGas)
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
        ...(hasHighFee && { hasHighFee: true as const }),
        ...('revertedEstimate' in estimate &&
            estimate.revertedEstimate && {
                revertedEstimate: estimate.revertedEstimate,
            }),
        feeEstimate: {
            preset: evmFeePresetOf(maxPriorityFeePerGas, fees.presets),
            amount:
                estimate.gas * paidPerGas(maxFeePerGas, maxPriorityFeePerGas),
        },
    }
    return {
        scope,
        payload,
        summary: ethereumCallSummary({ from, to, value, data }, chain),
        chainData: { family: 'evm' },
    }
}
