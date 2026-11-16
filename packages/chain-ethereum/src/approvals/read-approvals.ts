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

import type { Decimal } from 'decimal.js'
import {
    decodeFunctionResult,
    encodeFunctionData,
    erc20Abi,
    erc721Abi,
    getAddress,
    type Address,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
    KnownSpender,
    TokenApproval,
} from '@perawallet/wallet-core-chain-contract'
import {
    mapWithConcurrency,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { toRpcTransportError } from '../blockchain/errors/toRpcTransportError'
import { eip155ChainIdOf } from '../blockchain/utils/caip19'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { aggregate3, type Aggregate3Call } from '../blockchain/utils/erc20'
import type { EvmChain } from '../chains/types'
import { fetchEvmContractMetadata } from '../contracts/api/endpoints'
import { toAllowanceAmount } from '../signing/allowance'
import { knownSpenderOf } from '../signing/known-contracts'
import { fetchEvmApprovalCandidates } from './api/endpoints'
import type { EvmApprovalCandidate } from './api/schema'

const LABEL_LOOKUPS_IN_FLIGHT = 4

const callOf = (
    candidate: EvmApprovalCandidate,
    owner: Address,
): Aggregate3Call =>
    candidate.kind === 'allowance'
        ? {
              target: candidate.token,
              allowFailure: true,
              callData: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: 'allowance',
                  args: [owner, candidate.spender],
              }),
          }
        : {
              target: candidate.collection,
              allowFailure: true,
              callData: encodeFunctionData({
                  abi: erc721Abi,
                  functionName: 'isApprovedForAll',
                  args: [owner, candidate.operator],
              }),
          }

// The chain's own answer for one pair: the allowance, or whether the
// operator is approved. Null when the call reverted or answered with nothing
// readable (a target with no code "succeeds" with empty return data).
const answerOf = (
    candidate: EvmApprovalCandidate,
    result: { success: boolean; returnData: `0x${string}` },
): Nullable<bigint | boolean> => {
    if (!result.success) return null
    try {
        return candidate.kind === 'allowance'
            ? decodeFunctionResult({
                  abi: erc20Abi,
                  functionName: 'allowance',
                  data: result.returnData,
              })
            : decodeFunctionResult({
                  abi: erc721Abi,
                  functionName: 'isApprovedForAll',
                  data: result.returnData,
              })
    } catch {
        return null
    }
}

const spenderOf = (candidate: EvmApprovalCandidate): Address =>
    candidate.kind === 'allowance' ? candidate.spender : candidate.operator

// Pera's curated name when the backend vouches for the contract, else the
// bundled registry's, as a dApp review names it.
const labelSpenders = async (
    scope: ChainScope,
    chain: EvmChain,
    spenders: Address[],
): Promise<Map<Address, KnownSpender>> => {
    const eip155ChainId = eip155ChainIdOf(scope, chain)
    const settled = await mapWithConcurrency(
        spenders,
        LABEL_LOOKUPS_IN_FLIGHT,
        spender => fetchEvmContractMetadata(scope, chain, spender),
    )
    const labels = new Map<Address, KnownSpender>()
    spenders.forEach((spender, index) => {
        const read = settled[index]
        const metadata = read?.status === 'fulfilled' ? read.value : null
        const label = metadata
            ? { name: metadata.name }
            : knownSpenderOf(eip155ChainId, spender)
        if (label) labels.set(spender, label)
    })
    return labels
}

/**
 * The approvals `owner` has given that the chain says still stand. Each
 * backend candidate is re-read in Multicall3 `aggregate3` calls, since a
 * later `transferFrom` spends an allowance down without a log; a pair that
 * reads zero or false, reverts or answers nothing is dropped. A failed read
 * rejects, so a lapsed approval is never listed as live.
 */
export const readEvmApprovals = async (
    ctx: ChainContext,
    chain: EvmChain,
    scope: ChainScope,
    owner: string,
): Promise<TokenApproval[]> => {
    const candidates = await fetchEvmApprovalCandidates(scope, chain, owner)
    if (candidates.length === 0) return []
    const holder = getAddress(owner)
    const client = createEvmClient(scope, ctx, chain)
    let results
    try {
        results = await aggregate3(
            client,
            candidates.map(candidate => callOf(candidate, holder)),
        )
    } catch (error) {
        throw toRpcTransportError(error) ?? error
    }
    const live: { candidate: EvmApprovalCandidate; amount?: Decimal }[] = []
    candidates.forEach((candidate, index) => {
        const answer = answerOf(candidate, results[index]!)
        if (candidate.kind === 'allowance') {
            if (typeof answer === 'bigint' && answer > 0n) {
                live.push({ candidate, amount: toAllowanceAmount(answer) })
            }
        } else if (answer === true) {
            live.push({ candidate })
        }
    })
    const labels = await labelSpenders(scope, chain, [
        ...new Set(live.map(({ candidate }) => spenderOf(candidate))),
    ])
    return live.map(({ candidate, amount }): TokenApproval => {
        const knownSpender = labels.get(spenderOf(candidate))
        if (candidate.kind === 'allowance') {
            return {
                kind: 'allowance',
                assetRef: { chainId: chain.row.id, assetId: candidate.token },
                spender: candidate.spender,
                ...(amount && { amount }),
                ...(knownSpender && { knownSpender }),
            }
        }
        return {
            kind: 'collection',
            collection: candidate.collection,
            ...(candidate.collectionName && {
                collectionName: candidate.collectionName,
            }),
            spender: candidate.operator,
            ...(knownSpender && { knownSpender }),
        }
    })
}
