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

import { BaseError, ContractFunctionRevertedError, type Address } from 'viem'
import { getEnsAddress, normalize, toCoinType } from 'viem/ens'
import {
    defaultNetworkForTier,
    networkTierOf,
    type ChainContext,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectUsableEndpointOverrides,
    useNetworkStore,
    withEndpointOverrides,
} from '@perawallet/wallet-core-chain-shared'
import { chainEndpointsFor, config } from '@perawallet/wallet-core-config'
import type {
    NameAddressVerification,
    VerifyForwardResolutionParams,
} from '@perawallet/wallet-core-nfd'
import {
    logger,
    toError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import { abortError } from '../blockchain/utils/evmHttpTransport'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { eip155ChainIdOfNetwork } from '../blockchain/utils/caip19'
import { ENS_HOST_CHAIN_ID, evmChainOf } from '../chains/table'
import type { EvmChain } from '../chains/types'

// The same proxy on Ethereum and Sepolia, inlined because viem/chains would
// ship every chain definition to Metro.
export const ENS_UNIVERSAL_RESOLVER: Address =
    '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe'

// ENSIP-19: 0x80000000, the address every EVM chain without a record of its own uses.
const DEFAULT_EVM_COIN_TYPE = 1n << 31n

// Universal Resolver reverts that say the name has no such record. Any other
// revert (an unreachable gateway, a broken verifier) is a failed read.
const NO_RECORD_ERRORS: ReadonlySet<string> = new Set([
    'ResolverNotFound',
    'ResolverNotContract',
    'UnsupportedResolverProfile',
])

// ENS lives on Ethereum, whose record is the chain's own: coin type 60. Every
// other chain reads ENSIP-11's coin type, and never falls back to Ethereum's.
const ensCoinTypeOf = (chain: EvmChain, eip155ChainId: number): bigint =>
    chain.row.id === ENS_HOST_CHAIN_ID ? 60n : toCoinType(eip155ChainId)

// ENS is read on Ethereum with Ethereum's own endpoints, so an account that
// doesn't have Ethereum enabled still reaches it.
const ensHostContext = (): Pick<ChainContext, 'getEndpoints' | 'timeouts'> => ({
    getEndpoints: () =>
        withEndpointOverrides(
            chainEndpointsFor(ENS_HOST_CHAIN_ID),
            selectUsableEndpointOverrides(
                useNetworkStore.getState(),
                ENS_HOST_CHAIN_ID,
            ),
        ),
    timeouts: config.chainRequestTimeouts[ENS_HOST_CHAIN_ID],
})

// viem's CCIP-Read fetch for an offchain name's gateway takes neither a timeout
// nor a signal, so the wait is bounded here: a dead gateway ends as a failed read
// instead of leaving the pick on a spinner.
const withDeadline = <T>(
    work: Promise<T>,
    ms: number,
    signal?: AbortSignal,
): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`ENS read exceeded ${ms}ms`)),
            ms,
        )
        const onAbort = () => reject(abortError())
        signal?.addEventListener('abort', onAbort, { once: true })
        work.then(resolve, reject).finally(() => {
            clearTimeout(timer)
            signal?.removeEventListener('abort', onAbort)
        })
    })

const scopeKey = (scope: ChainScope): string =>
    `${scope.chainId}/${scope.networkId}`

const isNoRecord = (error: unknown): boolean => {
    if (!(error instanceof BaseError)) return false
    const reverted = error.walk(e => e instanceof ContractFunctionRevertedError)
    return (
        reverted instanceof ContractFunctionRevertedError &&
        !!reverted.data &&
        NO_RECORD_ERRORS.has(reverted.data.errorName)
    )
}

/** The ENSIP-15 form of `name`, or `undefined` for a name ENS refuses. */
export const normalizeEnsName = (name: string): Optional<string> => {
    try {
        return normalize(name)
    } catch {
        return undefined
    }
}

/**
 * Checks a name's backend-asserted address against ENS on Ethereum L1: the
 * chain's own address record, else the default one, read only when the chain
 * has none. Mainnet chains read Ethereum mainnet and testnets read Sepolia,
 * so the two never mix. The whole check ends within the host's read ceiling.
 */
export const verifyEnsAddress = async (
    chain: EvmChain,
    { name, address, scope, signal }: VerifyForwardResolutionParams,
): Promise<NameAddressVerification> => {
    if (signal?.aborted) throw abortError()

    const normalized = normalizeEnsName(name)
    // A name ENS refuses can't resolve, so no read can confirm it.
    if (normalized === undefined) return 'mismatch'

    try {
        const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
        const tier = networkTierOf(chain.descriptor, scope.networkId)
        const host = evmChainOf(ENS_HOST_CHAIN_ID)
        const hostNetwork = tier && defaultNetworkForTier(host.descriptor, tier)
        if (eip155ChainId === undefined || !hostNetwork) {
            throw new Error(`No ENS host network for ${scopeKey(scope)}`)
        }

        const hostContext = ensHostContext()
        const client = createEvmClient(
            { chainId: ENS_HOST_CHAIN_ID, networkId: hostNetwork.id },
            hostContext,
            host,
        )
        const read = async (coinType: bigint): Promise<Nullable<string>> => {
            try {
                return await getEnsAddress(client, {
                    name: normalized,
                    coinType,
                    strict: true,
                    universalResolverAddress: ENS_UNIVERSAL_RESOLVER,
                })
            } catch (error) {
                if (isNoRecord(error)) return null
                throw error
            }
        }
        const readRecord = async (): Promise<Nullable<string>> => {
            const own = await read(ensCoinTypeOf(chain, eip155ChainId))
            if (signal?.aborted) throw abortError()
            // A failing default lookup must not block a chain whose own record answered.
            return own ?? (await read(DEFAULT_EVM_COIN_TYPE))
        }
        // One read ceiling for the whole check, as for any node read.
        const record = await withDeadline(
            readRecord(),
            hostContext.timeouts.readMs,
            signal,
        )
        if (signal?.aborted) throw abortError()

        return record && areEvmAddressesEqual(record, address)
            ? 'verified'
            : 'mismatch'
    } catch (error) {
        // A read that failed after the abort must not read as a verdict.
        if (signal?.aborted) throw abortError()
        if (error instanceof Error && error.name === 'AbortError') throw error
        logger.warn('ENS verification unavailable', {
            name: normalized,
            error: toError(error).message,
        })
        return 'unavailable'
    }
}
