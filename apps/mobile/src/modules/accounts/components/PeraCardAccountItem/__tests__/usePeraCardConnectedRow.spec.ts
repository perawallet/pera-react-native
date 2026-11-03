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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    CardStatus,
    useCardStatusQuery,
    type Card,
} from '@perawallet/wallet-core-card'

vi.mock('@perawallet/wallet-core-card', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-card')>()),
    useCardStatusQuery: vi.fn(),
}))

// `t` echoes the key so assertions read the resolved key, not English copy.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { usePeraCardConnectedRow } from '../usePeraCardConnectedRow'

const SCOPE = { chainId: 'algorand', networkId: 'testnet' } as const

const cardWith = (partial: Partial<Card>): Card => ({
    id: 'card-1',
    panLast4: '4821',
    status: CardStatus.Active,
    type: 'VIRTUAL',
    orderedAt: '2026-10-30T08:47:00Z',
    ...partial,
})

const mockStatusQuery = (data: Card | null | undefined) => {
    vi.mocked(useCardStatusQuery).mockReturnValue({
        data,
    } as unknown as ReturnType<typeof useCardStatusQuery>)
}

describe('usePeraCardConnectedRow', () => {
    beforeEach(() => {
        vi.mocked(useCardStatusQuery).mockReset()
    })

    it('shows the masked card number while the card is active', () => {
        // Arrange
        mockStatusQuery(cardWith({ status: CardStatus.Active }))

        // Act
        const { result } = renderHook(() => usePeraCardConnectedRow(SCOPE))

        // Assert
        expect(result.current.statusLabel).toBe('•••• 4821')
    })

    it.each([
        [CardStatus.Frozen, 'peraCard.account_item.status_frozen'],
        [CardStatus.Blocked, 'peraCard.account_item.status_blocked'],
        [CardStatus.Pending, 'peraCard.account_item.status_pending'],
    ])('labels a %s card with its status', (status, key) => {
        // Arrange
        mockStatusQuery(cardWith({ status }))

        // Act
        const { result } = renderHook(() => usePeraCardConnectedRow(SCOPE))

        // Assert
        expect(result.current.statusLabel).toBe(key)
    })

    it.each([
        ['the status has not loaded', undefined],
        ['no card has been ordered', null],
    ])('shows nothing while %s', (_case, data) => {
        // Arrange
        mockStatusQuery(data)

        // Act
        const { result } = renderHook(() => usePeraCardConnectedRow(SCOPE))

        // Assert
        expect(result.current.statusLabel).toBeNull()
    })

    it('shows nothing for an active card without its last digits', () => {
        // Arrange
        mockStatusQuery(cardWith({ status: CardStatus.Active, panLast4: '' }))

        // Act
        const { result } = renderHook(() => usePeraCardConnectedRow(SCOPE))

        // Assert
        expect(result.current.statusLabel).toBeNull()
    })

    it('reads the status for the scope it is given', () => {
        // Arrange
        mockStatusQuery(null)

        // Act
        renderHook(() => usePeraCardConnectedRow(SCOPE))

        // Assert
        expect(useCardStatusQuery).toHaveBeenCalledWith(SCOPE)
    })
})
