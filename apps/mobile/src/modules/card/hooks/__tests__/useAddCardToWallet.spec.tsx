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

import React, { type ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { createTestQueryClient, renderHook } from '@test-utils/render'
import { act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    isEnabled: true,
    isIOS: true,
    isWalletAvailable: true as boolean | undefined,
    walletCardStatus: 'not found' as string | undefined,
    panLast4: '2234' as string | null,
    cardUser: null as { firstName?: string; lastName?: string } | null,
    addCardToAppleWallet: vi.fn(),
    addCardToGoogleWallet: vi.fn(),
    fetchApplePayload: vi.fn(),
    fetchGooglePayload: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        walletProvisioning: {
            addCardToAppleWallet: mocks.addCardToAppleWallet,
            addCardToGoogleWallet: mocks.addCardToGoogleWallet,
        },
    }),
}))

vi.mock('../../utils/provisioningPayload', async () => {
    const actual = await vi.importActual<object>(
        '../../utils/provisioningPayload',
    )
    return {
        ...actual,
        fetchAppleProvisioningPayload: mocks.fetchApplePayload,
        fetchGoogleProvisioningPayload: mocks.fetchGooglePayload,
    }
})

vi.mock('@hooks/useIsCardPushProvisioningEnabled', () => ({
    useIsCardPushProvisioningEnabled: () => mocks.isEnabled,
}))

vi.mock('../../../../platform/utils', async () => {
    const actual = await vi.importActual<object>('../../../../platform/utils')
    return {
        ...actual,
        isIOS: () => mocks.isIOS,
    }
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: { lastKnownPanLast4: string | null }) => unknown,
        ) => selector({ lastKnownPanLast4: mocks.panLast4 }),
        useCardUserQuery: () => ({ data: mocks.cardUser }),
        useWalletProvisioningAvailabilityQuery: () => ({
            data: mocks.isWalletAvailable,
        }),
        useWalletProvisioningStatusQuery: () => ({
            data: mocks.walletCardStatus,
        }),
    }
})

import { useAddCardToWallet } from '../useAddCardToWallet'

let queryClient: QueryClient

const renderAddCardToWallet = () =>
    renderHook(() => useAddCardToWallet(), {
        wrapper: ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })

describe('useAddCardToWallet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = createTestQueryClient()
        mocks.isEnabled = true
        mocks.isIOS = true
        mocks.isWalletAvailable = true
        mocks.walletCardStatus = 'not found'
        mocks.panLast4 = '2234'
        mocks.cardUser = { firstName: 'Ada', lastName: 'Lovelace' }
        mocks.addCardToAppleWallet.mockResolvedValue('success')
        mocks.addCardToGoogleWallet.mockResolvedValue('success')
        mocks.fetchApplePayload.mockRejectedValue(new Error('not built yet'))
        mocks.fetchGooglePayload.mockRejectedValue(new Error('not built yet'))
    })

    it('reports unsupported when the flag is off even if the wallet is available', () => {
        mocks.isEnabled = false

        const { result } = renderAddCardToWallet()

        expect(result.current.canPushProvision).toBe(false)
    })

    it('reports unsupported when the OS wallet is unavailable', () => {
        mocks.isWalletAvailable = false

        const { result } = renderAddCardToWallet()

        expect(result.current.canPushProvision).toBe(false)
    })

    it('reports unsupported while availability is still unknown', () => {
        mocks.isWalletAvailable = undefined

        const { result } = renderAddCardToWallet()

        expect(result.current.canPushProvision).toBe(false)
    })

    it('supports provisioning when the flag is on and the wallet is available', () => {
        const { result } = renderAddCardToWallet()

        expect(result.current.canPushProvision).toBe(true)
        expect(result.current.isCardInWallet).toBe(false)
    })

    it('flags a card that is already in the wallet', () => {
        mocks.walletCardStatus = 'active'

        const { result } = renderAddCardToWallet()

        expect(result.current.isCardInWallet).toBe(true)
    })

    it('falls back immediately when provisioning is unsupported', async () => {
        mocks.isEnabled = false
        const { result } = renderAddCardToWallet()

        const outcome = await result.current.startAddCardToWallet()

        expect(outcome).toBe('fallback')
        expect(mocks.addCardToAppleWallet).not.toHaveBeenCalled()
        expect(mocks.addCardToGoogleWallet).not.toHaveBeenCalled()
    })

    it('falls back when the pan suffix is unknown', async () => {
        mocks.panLast4 = null
        const { result } = renderAddCardToWallet()

        const outcome = await result.current.startAddCardToWallet()

        expect(outcome).toBe('fallback')
        expect(mocks.addCardToAppleWallet).not.toHaveBeenCalled()
    })

    it('runs the Apple flow with the card data and reports added', async () => {
        const { result } = renderAddCardToWallet()

        let outcome: string | undefined
        await act(async () => {
            outcome = await result.current.startAddCardToWallet()
        })

        expect(outcome).toBe('added')
        expect(mocks.addCardToAppleWallet).toHaveBeenCalledWith(
            {
                network: 'MASTERCARD',
                cardHolderName: 'Ada Lovelace',
                lastDigits: '2234',
                cardDescription: 'Pera Card',
            },
            expect.any(Function),
        )
    })

    it('wires the Apple issuer callback to the payload fetcher', async () => {
        const { result } = renderAddCardToWallet()

        await act(async () => {
            await result.current.startAddCardToWallet()
        })
        const issuerCallback = mocks.addCardToAppleWallet.mock.calls[0][1] as (
            nonce: string,
            nonceSignature: string,
            certificates: string[],
        ) => Promise<unknown>

        await expect(
            issuerCallback('nonce', 'signature', ['cert']),
        ).rejects.toThrow()
        expect(mocks.fetchApplePayload).toHaveBeenCalledWith({
            nonce: 'nonce',
            nonceSignature: 'signature',
            certificates: ['cert'],
        })
    })

    it('reports dismissed when the user cancels the Apple flow', async () => {
        mocks.addCardToAppleWallet.mockResolvedValue('canceled')
        const { result } = renderAddCardToWallet()

        let outcome: string | undefined
        await act(async () => {
            outcome = await result.current.startAddCardToWallet()
        })

        expect(outcome).toBe('dismissed')
    })

    it('falls back when the native add flow fails', async () => {
        mocks.addCardToAppleWallet.mockRejectedValue(
            new Error('provisioning failed'),
        )
        const { result } = renderAddCardToWallet()

        let outcome: string | undefined
        await act(async () => {
            outcome = await result.current.startAddCardToWallet()
        })

        expect(outcome).toBe('fallback')
    })

    it('falls back on Android while the Google payload endpoint is missing', async () => {
        mocks.isIOS = false
        const { result } = renderAddCardToWallet()

        let outcome: string | undefined
        await act(async () => {
            outcome = await result.current.startAddCardToWallet()
        })

        expect(outcome).toBe('fallback')
        expect(mocks.addCardToGoogleWallet).not.toHaveBeenCalled()
    })

    it('runs the Google flow from the issuer payload and reports added', async () => {
        mocks.isIOS = false
        const userAddress = {
            name: 'Ada Lovelace',
            addressOne: '1 Main St',
            administrativeArea: 'CA',
            locality: 'San Francisco',
            countryCode: 'US',
            postalCode: '94100',
            phoneNumber: '+14150000000',
        }
        mocks.fetchGooglePayload.mockResolvedValue({
            network: 'MASTERCARD',
            opaquePaymentCard: 'opc-blob',
            cardHolderName: 'Ada Lovelace',
            userAddress,
        })
        const { result } = renderAddCardToWallet()

        let outcome: string | undefined
        await act(async () => {
            outcome = await result.current.startAddCardToWallet()
        })

        expect(outcome).toBe('added')
        expect(mocks.addCardToGoogleWallet).toHaveBeenCalledWith({
            network: 'MASTERCARD',
            opaquePaymentCard: 'opc-blob',
            cardHolderName: 'Ada Lovelace',
            lastDigits: '2234',
            userAddress,
        })
    })
})
