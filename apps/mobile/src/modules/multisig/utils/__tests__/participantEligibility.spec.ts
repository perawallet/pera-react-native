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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accountForType } from '@test-utils/accountCustody'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import {
    registerAlgorandAccountsAdapter,
    registerAlgorandMultisigAdapter,
} from '@test-utils/algorandAccountsAdapter'
import {
    canBeMultisigParticipant,
    canSignAsParticipant,
    signsWithParticipantScheme,
} from '../participantEligibility'

vi.mock(import('@perawallet/wallet-core-accounts'), async importOriginal => ({
    ...(await importOriginal()),
}))

describe('participantEligibility', () => {
    beforeEach(() => {
        registerAlgorandAccountsAdapter()
        registerAlgorandMultisigAdapter()
    })

    it.each([
        ['standalone', true],
        ['hdWallet', true],
        ['hardware', true],
        ['quantum', false],
        ['watch', false],
        ['multisig', false],
    ] as const)(
        'offers a %s account as a new participant: %s',
        (kind, expected) => {
            expect(
                canBeMultisigParticipant(accountForType(kind), 'algorand'),
            ).toBe(expected)
        },
    )

    it('rejects only local keys minted under another signing scheme', () => {
        expect(
            signsWithParticipantScheme(accountForType('quantum'), 'algorand'),
        ).toBe(false)
        expect(
            signsWithParticipantScheme(
                accountForType('standalone'),
                'algorand',
            ),
        ).toBe(true)
        expect(
            signsWithParticipantScheme(accountForType('watch'), 'algorand'),
        ).toBe(true)
    })

    it("follows the chain's multisig adapter on which schemes fill a slot", () => {
        const adapter = multisigChainAdapters.get('algorand')
        multisigChainAdapters.reset()
        multisigChainAdapters.register({
            ...adapter,
            acceptsParticipantScheme: () => true,
        })

        expect(
            canBeMultisigParticipant(accountForType('quantum'), 'algorand'),
        ).toBe(true)
    })

    it('lets only a directly-signing account contribute its own subsignature', () => {
        expect(
            canSignAsParticipant(accountForType('hdWallet'), 'algorand'),
        ).toBe(true)
        expect(
            canSignAsParticipant(accountForType('hardware'), 'algorand'),
        ).toBe(true)
        expect(canSignAsParticipant(accountForType('watch'), 'algorand')).toBe(
            false,
        )
        expect(
            canSignAsParticipant(accountForType('quantum'), 'algorand'),
        ).toBe(false)
    })
})
