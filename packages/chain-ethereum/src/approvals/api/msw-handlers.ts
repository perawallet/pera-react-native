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

import { http, HttpResponse, type RequestHandler } from 'msw'
import { rejectUnauthenticated } from '../../assets/api/msw-handlers'
import { approvalsPath } from './endpoints'
import type { ApprovalCandidateResponse } from './schema'

export type PeraEvmApprovalFixtures = {
    /** Defaults to every host. */
    baseUrl?: string
    /**
     * Candidate pages keyed by lowercase owner address; an owner left out has
     * none. A number fails every read with that status.
     */
    approvals?: Record<string, ApprovalCandidateResponse[][]> | number
}

const APPROVAL_CURSOR = /^page:(\d+)$/

/** A (token, spender) pair the backend saw approved. */
export const evmAllowanceCandidate = (
    overrides: Partial<
        Extract<ApprovalCandidateResponse, { kind: 'allowance' }>
    > = {},
): ApprovalCandidateResponse => ({
    kind: 'allowance',
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    ...overrides,
})

/** A (collection, operator) pair the backend saw approved for all items. */
export const evmOperatorCandidate = (
    overrides: Partial<
        Extract<ApprovalCandidateResponse, { kind: 'operator' }>
    > = {},
): ApprovalCandidateResponse => ({
    kind: 'operator',
    collection: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    operator: '0x1E0049783F008A0085193E00003D00cd54003c71',
    collection_name: 'Bored Ape Yacht Club',
    ...overrides,
})

/** The Pera backend's EVM approval candidates endpoint. */
export const peraEvmApprovalHandlers = ({
    baseUrl = '*',
    approvals = {},
}: PeraEvmApprovalFixtures = {}): RequestHandler[] => [
    http.get(
        `${baseUrl.replace(/\/+$/, '')}${approvalsPath(':chainId', ':address')}`,
        ({ request, params }) => {
            const refused = rejectUnauthenticated(request)
            if (refused) return refused
            if (typeof approvals === 'number') {
                return HttpResponse.json({}, { status: approvals })
            }
            const listed = approvals[String(params.address).toLowerCase()]
            const pages = listed?.length ? listed : [[]]
            const cursor = new URL(request.url).searchParams.get('cursor')
            const index =
                cursor === null
                    ? 0
                    : Number(APPROVAL_CURSOR.exec(cursor)?.[1] ?? NaN)
            const results = pages[index]
            if (!results) {
                return HttpResponse.json(
                    { error: 'Invalid cursor', code: 'invalid_cursor' },
                    { status: 404 },
                )
            }
            return HttpResponse.json({
                next: index + 1 < pages.length ? `page:${index + 1}` : null,
                results,
            })
        },
    ),
]
