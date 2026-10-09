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
import {
    hardwareAccount,
    hdAccount,
    quantumAccount,
    watchAccount,
} from '../../__tests__/algorandAccounts'
import {
    canSignViaParticipants,
    signableParticipantAt,
} from '../multisig-participants'

describe('signableParticipantAt', () => {
    it('returns a held local-key or hardware participant', () => {
        const local = hdAccount('A')
        const ledger = hardwareAccount('B')

        expect(signableParticipantAt('A', [local, ledger])).toBe(local)
        expect(signableParticipantAt('B', [local, ledger])).toBe(ledger)
    })

    it('skips a watch participant even when it delegates to a held key', () => {
        expect(
            signableParticipantAt('W', [
                hdAccount('A'),
                watchAccount('W', { authorityAddress: 'A' }),
            ]),
        ).toBeUndefined()
    })

    it("skips a quantum participant, whose key a slot can't verify", () => {
        expect(
            signableParticipantAt('Q', [quantumAccount('Q')]),
        ).toBeUndefined()
    })

    it('returns nothing for an address the wallet does not hold', () => {
        expect(signableParticipantAt('X', [hdAccount('A')])).toBeUndefined()
    })
})

describe('canSignViaParticipants', () => {
    it('needs one signable participant', () => {
        expect(
            canSignViaParticipants(
                ['Q', 'A'],
                [quantumAccount('Q'), hdAccount('A')],
            ),
        ).toBe(true)
        expect(
            canSignViaParticipants(
                ['Q', 'W'],
                [quantumAccount('Q'), watchAccount('W')],
            ),
        ).toBe(false)
    })
})
