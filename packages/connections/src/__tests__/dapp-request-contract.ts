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

import { describe, expect, it } from 'vitest'
import type {
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { DappRequestChainAdapter } from '../dappRequest'
import { WALLET_OPERATION_TYPES } from '../models'

export interface DappRequestContractFixtures {
    /** `sign-transactions` params past the chain's size caps. */
    overCapTransactionParams: Record<string, unknown>
    /** A wallet scope the chain reports to a page as `reportedAs`. */
    disclosed: {
        scope: ChainScope
        customGenesisHash?: string
        reportedAs: NetworkId
    }
    /** A wallet scope the chain must not disclose. */
    undisclosed: { scope: ChainScope; customGenesisHash?: string }
}

/** Every chain package runs this against its own dApp request adapter. */
export const dappRequestContractTests = (
    makeAdapter: () => DappRequestChainAdapter,
    fixtures: DappRequestContractFixtures,
): void => {
    describe(`DappRequestChainAdapter contract: ${makeAdapter().chainId}`, () => {
        it('names only non-empty error names as relayable', () => {
            for (const name of makeAdapter().relayableErrorNames) {
                expect(name).toMatch(/\S/)
            }
        })

        it.each(WALLET_OPERATION_TYPES)(
            'reports a %s request without its payload as missing',
            type => {
                const result = makeAdapter().parseSigningParams(type, {})

                expect(result).toMatchObject({ ok: false, reason: 'missing' })
                expect(result.ok || result.message).toMatch(/\S/)
            },
        )

        it('reports a transaction request past its caps as out of bounds', () => {
            expect(
                makeAdapter().parseSigningParams(
                    'sign-transactions',
                    fixtures.overCapTransactionParams,
                ),
            ).toMatchObject({ ok: false, reason: 'out-of-bounds' })
        })

        it('reports a disclosable network as the chain names it', () => {
            const { scope, customGenesisHash, reportedAs } = fixtures.disclosed

            expect(
                makeAdapter().resolveReportedNetwork(scope, customGenesisHash),
            ).toBe(reportedAs)
        })

        it('withholds a network it must not disclose', () => {
            const { scope, customGenesisHash } = fixtures.undisclosed

            expect(
                makeAdapter().resolveReportedNetwork(scope, customGenesisHash),
            ).toBeUndefined()
        })
    })
}
