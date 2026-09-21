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
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({ escrowCardOwner: null as string | null }))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardStore: (
        selector: (state: { escrowCardOwner: string | null }) => unknown,
    ) => selector({ escrowCardOwner: mocks.escrowCardOwner }),
}))

import { useCardOwnerAccount } from '../useCardOwnerAccount'

const owner = { address: 'OWNER', type: 'algo25' } as WalletAccount
const other = { address: 'OTHER', type: 'algo25' } as WalletAccount

describe('useCardOwnerAccount', () => {
    beforeEach(() => {
        mocks.escrowCardOwner = 'OWNER'
        vi.mocked(useFindAccountByAddress).mockImplementation(
            address => [other, owner].find(a => a.address === address) ?? null,
        )
    })

    it('resolves the stored owner address to its local account', () => {
        const { result } = renderHook(() => useCardOwnerAccount())
        expect(result.current).toBe(owner)
    })

    it('is null when no card has been created', () => {
        mocks.escrowCardOwner = null
        const { result } = renderHook(() => useCardOwnerAccount())
        expect(result.current).toBeNull()
    })

    // The owner is the only account the contract lets withdraw, so a removed
    // owner means no withdrawal, not a fallback to whatever is selected.
    it('is null when the owner is no longer in the wallet', () => {
        vi.mocked(useFindAccountByAddress).mockImplementation(
            address => [other].find(a => a.address === address) ?? null,
        )
        const { result } = renderHook(() => useCardOwnerAccount())
        expect(result.current).toBeNull()
    })
})
