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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStatusCardOnOtherAccount } from '../useStatusCardOnOtherAccount'

const SCOPE = { chainId: 'algorand', networkId: 'testnet' } as const
const ISSUED_CARD = { id: 'card-1', status: 'ACTIVE', panLast4: '4680' }

let mockIsAuthenticated = true
let mockEscrowCardAddress: string | null = null
let mockCard: typeof ISSUED_CARD | null | undefined = ISSUED_CARD
let mockIsFetchedAfterMount = true
let mockIsFocused = true
const mockCardStatusQuery = vi.fn()
const mockReplace = vi.fn()

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-card')
    >('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardSession: () => ({ isAuthenticated: mockIsAuthenticated }),
        useCardStore: (
            selector: (state: { escrowCardAddress: string | null }) => unknown,
        ) => selector({ escrowCardAddress: mockEscrowCardAddress }),
        useCardStatusQuery: (...args: unknown[]) => {
            mockCardStatusQuery(...args)
            return {
                data: mockCard,
                isFetchedAfterMount: mockIsFetchedAfterMount,
            }
        },
    }
})

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useIsFocused: () => mockIsFocused,
        useNavigation: () => ({ replace: mockReplace }),
    }
})

describe('useStatusCardOnOtherAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockIsAuthenticated = true
        mockEscrowCardAddress = null
        mockCard = ISSUED_CARD
        mockIsFetchedAfterMount = true
        mockIsFocused = true
    })

    it('hands an issued card that no wallet account holds over to its own screen', () => {
        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(true)
        expect(mockReplace).toHaveBeenCalledWith('CardOnOtherAccount')
    })

    it('counts a blocked card as issued, so a second one is never offered', () => {
        mockCard = { ...ISSUED_CARD, status: 'BLOCKED' }

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(true)
    })

    it('waits for focus before handing over', () => {
        mockIsFocused = false

        renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('leaves a user without an issued card on the checklist', () => {
        mockCard = null

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(false)
        expect(result.current.isCardLookupPending).toBe(false)
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('holds creation while Baanx has not answered', () => {
        mockCard = undefined
        mockIsFetchedAfterMount = false

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardLookupPending).toBe(true)
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('ignores a card cached before this mount, which may be a previous user', () => {
        mockIsFetchedAfterMount = false

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(false)
        expect(result.current.isCardLookupPending).toBe(true)
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockCardStatusQuery).toHaveBeenCalledWith(SCOPE, {
            enabled: true,
            refetchOnMount: 'always',
        })
    })

    it('lets creation proceed when the card status cannot be read', () => {
        mockCard = undefined

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardLookupPending).toBe(false)
        expect(result.current.isCardOnOtherAccount).toBe(false)
    })

    it('skips the card lookup when this device already holds the escrow card', () => {
        mockEscrowCardAddress = 'ESCROWCARD'

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(false)
        expect(result.current.isCardLookupPending).toBe(false)
        expect(mockCardStatusQuery).toHaveBeenCalledWith(SCOPE, {
            enabled: false,
            refetchOnMount: 'always',
        })
    })

    it('skips the card lookup without a card session', () => {
        mockIsAuthenticated = false

        const { result } = renderHook(() => useStatusCardOnOtherAccount(SCOPE))

        expect(result.current.isCardOnOtherAccount).toBe(false)
        expect(mockCardStatusQuery).toHaveBeenCalledWith(SCOPE, {
            enabled: false,
            refetchOnMount: 'always',
        })
    })
})
