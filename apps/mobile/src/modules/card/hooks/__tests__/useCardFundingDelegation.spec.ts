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
import type { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockMutateAsync = vi.fn()
vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useUpdateCardFundingDelegationMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
            isSuccess: false,
            isPaused: false,
            error: null,
            data: null,
            reset: vi.fn(),
        }),
    }
})

const mockSignDelegatedLsig = vi.fn()
vi.mock('@perawallet/wallet-core-signing', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-signing',
    )
    return {
        ...actual,
        useProgramSigner: () => ({
            signProgram: vi.fn(),
            signDelegatedLsig: mockSignDelegatedLsig,
        }),
    }
})

import { AUTO_FUNDING_PER_TX_LIMIT_USD } from '@perawallet/wallet-core-card'
import { ProgramSigningUnsupportedError } from '@perawallet/wallet-core-signing'
import { useCardFundingDelegation } from '../useCardFundingDelegation'

const localAccount = {
    address: 'LOCAL_ADDR',
    type: 'algo25',
    keyPairId: 'key-1',
} as unknown as WalletAccount

const ledgerAccount = {
    address: 'LEDGER_ADDR',
    type: 'hardware',
} as unknown as WalletAccount

describe('useCardFundingDelegation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockMutateAsync.mockResolvedValue(undefined)
        mockSignDelegatedLsig.mockResolvedValue({
            signedProgram: new Uint8Array([1]),
        })
    })

    it('delegates with the per-tx limit allowance and a signer bound to the account', async () => {
        const { result } = renderHook(() => useCardFundingDelegation())

        await result.current.delegateTo(localAccount)

        expect(mockMutateAsync).toHaveBeenCalledTimes(1)
        const variables = mockMutateAsync.mock.calls[0][0]
        expect(variables.address).toBe('LOCAL_ADDR')
        expect(variables.allowance).toBe(AUTO_FUNDING_PER_TX_LIMIT_USD)

        // The injected callback signs with the delegating account.
        const program = new Uint8Array([0x04])
        await variables.signDelegation(program)
        expect(mockSignDelegatedLsig).toHaveBeenCalledWith(
            localAccount,
            program,
        )
    })

    it('cancels by delegating an allowance of zero', async () => {
        const { result } = renderHook(() => useCardFundingDelegation())

        await result.current.cancelDelegation(localAccount)

        const variables = mockMutateAsync.mock.calls[0][0]
        expect((variables.allowance as Decimal).isZero()).toBe(true)
    })

    it('rejects hardware accounts before any network call', async () => {
        const { result } = renderHook(() => useCardFundingDelegation())

        expect(result.current.canDelegate(ledgerAccount)).toBe(false)
        await expect(result.current.delegateTo(ledgerAccount)).rejects.toThrow(
            ProgramSigningUnsupportedError,
        )
        expect(mockMutateAsync).not.toHaveBeenCalled()
    })

    it('rejects rekeyed accounts before any network call', async () => {
        const rekeyedAccount = {
            ...localAccount,
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount
        const { result } = renderHook(() => useCardFundingDelegation())

        expect(result.current.canDelegate(rekeyedAccount)).toBe(false)
        await expect(result.current.delegateTo(rekeyedAccount)).rejects.toThrow(
            ProgramSigningUnsupportedError,
        )
        expect(mockMutateAsync).not.toHaveBeenCalled()
    })

    it('reports local-key accounts as able to delegate', () => {
        const { result } = renderHook(() => useCardFundingDelegation())

        expect(result.current.canDelegate(localAccount)).toBe(true)
    })
})
