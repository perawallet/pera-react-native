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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    asUnsignedAlgorandTransaction,
    fakeAlgorandTransactionPlanner,
    makeTestAddress,
    makeTestPaymentTx,
    registerFakeTransactionPlanner,
} from '../../../__tests__/transactions'
import type { SignableGroup, SourceMetadata } from '../../../pipeline/types'
import { isPlannerSigned } from '../isPlannerSigned'

const SENDER = makeTestAddress(1)
const transaction = makeTestPaymentTx(SENDER, { receiver: makeTestAddress(2) })

const neutralGroup = (
    source: SourceMetadata = { type: 'local' },
): SignableGroup => ({
    data: {
        type: 'transactions',
        transactions: [asUnsignedAlgorandTransaction(transaction)],
        chainData: { algorand: { indicesToSign: [0] } },
    },
    source,
    signerAddress: SENDER.toString(),
})

const ED25519_LOCAL = { custody: 'local', scheme: 'ed25519' } as const

describe('isPlannerSigned', () => {
    beforeEach(() => {
        registerFakeTransactionPlanner(fakeAlgorandTransactionPlanner())
    })

    it('signs a local key in the scheme the planner plans', () => {
        expect(isPlannerSigned(neutralGroup(), ED25519_LOCAL, 'algorand')).toBe(
            true,
        )
    })

    it('leaves a local key in another scheme to the chain', () => {
        expect(
            isPlannerSigned(
                neutralGroup(),
                { custody: 'local', scheme: 'falcon-1024' },
                'algorand',
            ),
        ).toBe(false)
    })

    it('leaves a multisig cosignature to the chain', () => {
        expect(
            isPlannerSigned(
                neutralGroup({ type: 'multisig-cosign', signRequestId: 'r' }),
                ED25519_LOCAL,
                'algorand',
            ),
        ).toBe(false)
    })

    it.each(['hardware', 'multisig'] as const)(
        'leaves %s custody to the chain',
        custody => {
            expect(
                isPlannerSigned(
                    neutralGroup(),
                    { custody, scheme: 'ed25519' },
                    'algorand',
                ),
            ).toBe(false)
        },
    )

    it("leaves a group marked for the chain's own signer to the chain", () => {
        const group: SignableGroup = {
            ...neutralGroup(),
            shouldUseChainSigner: true,
        }

        expect(isPlannerSigned(group, ED25519_LOCAL, 'algorand')).toBe(false)
    })
})
