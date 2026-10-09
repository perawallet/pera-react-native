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
    walletConnect: {
        /** A network this chain reports a CAIP-2 identity for. */
        networkWithCaip2: NetworkId
        /**
         * A WalletConnect v1 chain id acceptable on at least one network.
         * Omit on a chain whose adapter serves no v1 (`walletConnect.v1` unset).
         */
        v1ChainId?: number
    }
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

        it('rejects an empty transaction payload with a non-empty message', () => {
            const result = makeAdapter().validateTransactionPayload([])

            expect(result.ok).toBe(false)
            if (!result.ok) expect(result.message).toMatch(/\S/)
        })

        it('answers empty signatures only for addresses it was asked about', () => {
            const unheld = 'A'.repeat(58)
            const answered = makeAdapter().emptySignaturesFor([unheld])

            expect(
                Object.keys(answered).every(address => address === unheld),
            ).toBe(true)
            expect(makeAdapter().emptySignaturesFor([])).toEqual({})
        })

        describe('walletConnect', () => {
            it('names a non-empty namespace', () => {
                expect(makeAdapter().walletConnect.namespace).toMatch(/\S/)
            })

            it("gives a disclosed network's CAIP-2 id the adapter's own namespace prefix", () => {
                const adapter = makeAdapter()
                const caip2 = adapter.walletConnect.caip2ChainIdFor(
                    fixtures.walletConnect.networkWithCaip2,
                )

                expect(caip2).not.toBeNull()
                expect(
                    caip2?.startsWith(`${adapter.walletConnect.namespace}:`),
                ).toBe(true)
            })

            it('round-trips a CAIP-2 id back to the network it names', () => {
                const adapter = makeAdapter()
                const { networkWithCaip2 } = fixtures.walletConnect
                const caip2 =
                    adapter.walletConnect.caip2ChainIdFor(networkWithCaip2)
                if (caip2 === null) {
                    throw new Error(
                        'fixtures.walletConnect.networkWithCaip2 has no CAIP-2 id',
                    )
                }

                expect(
                    adapter.walletConnect.networkForCaip2ChainId(caip2),
                ).toBe(networkWithCaip2)
            })

            it('names no network for an unknown CAIP-2 id', () => {
                expect(
                    makeAdapter().walletConnect.networkForCaip2ChainId(
                        'unknown-namespace:0000000000000000000000000000000',
                    ),
                ).toBeNull()
            })

            if (fixtures.walletConnect.v1ChainId !== undefined) {
                it('accepts a v1 chain id on every network its own networksFor names', () => {
                    const { v1ChainId } = fixtures.walletConnect
                    const v1 = makeAdapter().walletConnect.v1
                    if (!v1) {
                        throw new Error(
                            'fixtures declared v1ChainId but the adapter has no walletConnect.v1',
                        )
                    }
                    if (v1ChainId === undefined) return

                    const networks = v1.networksFor(v1ChainId)
                    expect(networks.length).toBeGreaterThan(0)
                    for (const network of networks) {
                        expect(v1.isChainIdAcceptable(v1ChainId, network)).toBe(
                            true,
                        )
                    }
                })
            }
        })
    })
}
