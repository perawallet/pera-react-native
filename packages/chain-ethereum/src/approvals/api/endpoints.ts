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

import { getAddress } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { buildIntegrityHeadersWhenReady } from '@perawallet/wallet-core-app-integrity'
import { queryClient, type Nullable } from '@perawallet/wallet-core-shared'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import type { EvmChain } from '../../chains/types'
import {
    approvalCandidateSchema,
    approvalCandidatesPageSchema,
    type EvmApprovalCandidate,
} from './schema'

export const APPROVALS_SERVICE = 'approvals'

// A cursor that never ends must fail the read, not hang the screen.
export const APPROVALS_MAX_PAGES = 100

export const approvalsPath = (
    eip155ChainId: number | string,
    address: string,
): string => `/api/v3/evm/${eip155ChainId}/accounts/${address}/approvals/`

const toCandidate = (
    row: ReturnType<typeof approvalCandidateSchema.parse>,
): EvmApprovalCandidate =>
    row.kind === 'allowance'
        ? {
              kind: 'allowance',
              token: getAddress(row.token),
              spender: getAddress(row.spender),
          }
        : {
              kind: 'operator',
              collection: getAddress(row.collection),
              operator: getAddress(row.operator),
              ...(row.collection_name && {
                  collectionName: row.collection_name,
              }),
          }

const keyOf = (candidate: EvmApprovalCandidate): string =>
    (candidate.kind === 'allowance'
        ? `${candidate.token}/${candidate.spender}`
        : `${candidate.collection}/${candidate.operator}`
    ).toLowerCase()

/**
 * Every (token, spender) and (collection, operator) pair `owner` has ever
 * approved on the scope's chain, across all pages; a row this client can't
 * read is skipped. The pairs are logs, so they over-report: none says the
 * approval still stands. Rejects with a `PeraNetworkError` on a failed page,
 * so a partial list never stands in for the whole.
 */
export const fetchEvmApprovalCandidates = async (
    scope: ChainScope,
    chain: EvmChain,
    owner: string,
): Promise<EvmApprovalCandidate[]> => {
    const url = approvalsPath(
        eip155ChainIdOf(scope, chain),
        owner.toLowerCase(),
    )
    const candidates = new Map<string, EvmApprovalCandidate>()
    let cursor: Nullable<string> = null
    for (let page = 0; page < APPROVALS_MAX_PAGES; page++) {
        const { data } = await queryClient<unknown>({
            backend: 'pera',
            service: APPROVALS_SERVICE,
            scope,
            method: 'GET',
            url,
            params: cursor === null ? undefined : { cursor },
            headers: await buildIntegrityHeadersWhenReady(),
        })
        const { results, next } = approvalCandidatesPageSchema.parse(data)
        for (const row of results) {
            const parsed = approvalCandidateSchema.safeParse(row)
            if (!parsed.success) continue
            const candidate = toCandidate(parsed.data)
            candidates.set(keyOf(candidate), candidate)
        }
        if (next === null) return [...candidates.values()]
        cursor = next
    }
    throw new Error(
        `Pera approvals for ${scope.chainId}/${scope.networkId} ran past ${APPROVALS_MAX_PAGES} pages`,
    )
}
