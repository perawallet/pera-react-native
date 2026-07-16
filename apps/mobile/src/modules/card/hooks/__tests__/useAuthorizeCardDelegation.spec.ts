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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockRequest = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequest }),
}))

const mockRequirePinVerification = vi.fn()
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePinVerification,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@components/ConfirmActionContent', () => ({
    ConfirmActionContent: () => null,
}))

vi.mock('@perawallet/wallet-core-card', () => ({
    AUTO_FUNDING_PER_TX_LIMIT_USD: new Decimal(400),
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    formatCurrency: () => '$400',
    truncateAlgorandAddress: (address: string) => address,
}))

import { useAuthorizeCardDelegation } from '../useAuthorizeCardDelegation'

const account = { address: 'ADDR1', name: 'Main' } as unknown as WalletAccount

describe('useAuthorizeCardDelegation', () => {
    const delegate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        delegate.mockResolvedValue(undefined)
        mockRequirePinVerification.mockResolvedValue(true)
    })

    it('delegates after consent and a passed PIN gate', async () => {
        mockRequest.mockResolvedValueOnce('confirm')

        const { result } = renderHook(() => useAuthorizeCardDelegation())
        const ok = await result.current.authorizeDelegation(account, delegate)

        expect(ok).toBe(true)
        expect(delegate).toHaveBeenCalledWith(account)
        expect(mockRequirePinVerification).toHaveBeenCalled()
    })

    it('falls back to the truncated address when the account has no name', async () => {
        const noName = { address: 'ADDR2' } as unknown as WalletAccount
        mockRequest.mockResolvedValueOnce('confirm')

        const { result } = renderHook(() => useAuthorizeCardDelegation())
        const ok = await result.current.authorizeDelegation(noName, delegate)

        expect(ok).toBe(true)
        expect(delegate).toHaveBeenCalledWith(noName)
    })

    it('does not delegate when the user declines consent', async () => {
        mockRequest.mockResolvedValueOnce(undefined) // dismissed

        const { result } = renderHook(() => useAuthorizeCardDelegation())
        const ok = await result.current.authorizeDelegation(account, delegate)

        expect(ok).toBe(false)
        expect(delegate).not.toHaveBeenCalled()
        expect(mockRequirePinVerification).not.toHaveBeenCalled()
    })

    it('does not delegate when the PIN gate is not passed', async () => {
        mockRequest.mockResolvedValueOnce('confirm')
        mockRequirePinVerification.mockResolvedValue(false)

        const { result } = renderHook(() => useAuthorizeCardDelegation())
        const ok = await result.current.authorizeDelegation(account, delegate)

        expect(ok).toBe(false)
        expect(delegate).not.toHaveBeenCalled()
    })

    it('propagates errors thrown by the delegate step', async () => {
        mockRequest.mockResolvedValueOnce('confirm')
        delegate.mockRejectedValue(new Error('baanx down'))

        const { result } = renderHook(() => useAuthorizeCardDelegation())

        await expect(
            result.current.authorizeDelegation(account, delegate),
        ).rejects.toThrow('baanx down')
    })
})
