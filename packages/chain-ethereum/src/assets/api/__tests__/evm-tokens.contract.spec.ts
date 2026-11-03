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
import type { NetworkTier } from '@perawallet/wallet-core-chain-contract'
import {
    EVM_TEST_CHAINS,
    eip155IdOf,
    evmScopeOf,
} from '../../../__tests__/evm-chains'
import {
    expectEveryRowParses,
    readBackendRecording,
} from '../../../__tests__/backend-recordings'
import { whitelistPath } from '../endpoints'
import { whitelistItemSchema, whitelistResponseSchema } from '../schema'
import { toWhitelistRow } from '../transformers'

const recording = readBackendRecording('evm-tokens')

const TIERS: readonly NetworkTier[] = ['mainnet', 'testnet']

const recordedNetwork = () => {
    const eip155ChainId = recording.request.pathParams?.chainId
    for (const chain of EVM_TEST_CHAINS) {
        for (const tier of TIERS) {
            const hasTier = chain.descriptor.networks.some(n => n.tier === tier)
            if (hasTier && eip155IdOf(chain, tier) === eip155ChainId) {
                return { chain, scope: evmScopeOf(chain, tier) }
            }
        }
    }
    throw new Error(`No EVM network has EIP-155 chain id ${eip155ChainId}`)
}

describe('GET /api/v3/evm/{id}/tokens/ contract', () => {
    it('is the route the app calls', () => {
        expect(recording.request).toMatchObject({
            method: 'GET',
            path: whitelistPath(recording.request.pathParams?.chainId ?? -1),
        })
    })

    it('the recorded response parses', () => {
        const { results } = whitelistResponseSchema.parse(recording.response)

        expectEveryRowParses(results, whitelistItemSchema)
    })

    it('lists the native token', () => {
        const { results } = whitelistResponseSchema.parse(recording.response)

        expect(
            results.map(row => whitelistItemSchema.parse(row).type),
        ).toContain('native')
    })

    // The schema passing isn't enough: the app also drops a row of a type it
    // doesn't list or with an id it can't map to its own asset id.
    it("maps every row into the app's token list", () => {
        const { chain, scope } = recordedNetwork()
        const { results } = whitelistResponseSchema.parse(recording.response)

        expect(
            results.filter(row => toWhitelistRow(row, scope, chain) === null),
        ).toEqual([])
    })
})
