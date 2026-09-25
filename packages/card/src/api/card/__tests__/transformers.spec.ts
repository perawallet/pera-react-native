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

import { describe, it, expect } from 'vitest'
import { transformCard } from '../transformers'
import { CardStatus, CardType } from '../../../models'
import type { CardStatusApiResponse } from '../schema'

const base: CardStatusApiResponse = {
    id: 'card_1',
    holderName: 'JANE DOE',
    expiryDate: '2027/05',
    panLast4: '1234',
    status: 'ACTIVE',
    type: 'VIRTUAL',
    orderedAt: '2026-01-01T00:00:00Z',
}

describe('transformCard', () => {
    it('maps known status and type to enum members', () => {
        const card = transformCard(base)

        expect(card.status).toBe(CardStatus.Active)
        expect(card.type).toBe(CardType.Virtual)
        expect(card.panLast4).toBe('1234')
        expect(card.orderedAt).toBe('2026-01-01T00:00:00Z')
    })

    it('maps the transient provisioning status to Pending, not the Blocked fallback', () => {
        const card = transformCard({ ...base, status: 'PENDING' })

        expect(card.status).toBe(CardStatus.Pending)
    })

    it('falls back to Blocked for an unknown status', () => {
        const card = transformCard({ ...base, status: 'SOMETHING_NEW' })

        expect(card.status).toBe(CardStatus.Blocked)
    })

    it('falls back to Virtual for an unknown type', () => {
        const card = transformCard({ ...base, type: 'MYSTERY' })

        expect(card.type).toBe(CardType.Virtual)
    })
})
