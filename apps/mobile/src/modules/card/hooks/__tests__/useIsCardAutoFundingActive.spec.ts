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
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    selectedFundingType: null as string | null,
    connectedAddress: null as string | null,
}))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardStore: (
        selector: (state: {
            selectedFundingType: string | null
            connectedFundingSourceAddress: string | null
        }) => unknown,
    ) =>
        selector({
            selectedFundingType: mocks.selectedFundingType,
            connectedFundingSourceAddress: mocks.connectedAddress,
        }),
}))

import { useIsCardAutoFundingActive } from '../useIsCardAutoFundingActive'

const localAccount = {
    address: 'LOCAL',
    type: 'algo25',
    keyPairId: 'key-1',
} as WalletAccount

const ledgerAccount = {
    address: 'LEDGER',
    type: 'hardware',
    hardwareDetails: { manufacturer: 'ledger' },
} as unknown as WalletAccount

describe('useIsCardAutoFundingActive', () => {
    beforeEach(() => {
        mocks.selectedFundingType = 'AUTO'
        mocks.connectedAddress = 'LOCAL'
        vi.mocked(useAllAccounts).mockReturnValue([localAccount, ledgerAccount])
    })

    it('is true when AUTO is stored and the connected account can sign the LSig', () => {
        const { result } = renderHook(() => useIsCardAutoFundingActive())

        expect(result.current).toBe(true)
    })

    it('is false when the connected account is a Ledger', () => {
        mocks.connectedAddress = 'LEDGER'

        const { result } = renderHook(() => useIsCardAutoFundingActive())

        expect(result.current).toBe(false)
    })

    // The address can outlive the account it names (removed account, wrong
    // network), and an unresolvable account can't have authorized anything.
    it('is false when the stored address matches no known account', () => {
        mocks.connectedAddress = 'GONE'

        const { result } = renderHook(() => useIsCardAutoFundingActive())

        expect(result.current).toBe(false)
    })

    it('is false when no funding account is connected', () => {
        mocks.connectedAddress = null

        const { result } = renderHook(() => useIsCardAutoFundingActive())

        expect(result.current).toBe(false)
    })

    it('is false for MANUAL and for nothing stored', () => {
        mocks.selectedFundingType = 'MANUAL'
        expect(
            renderHook(() => useIsCardAutoFundingActive()).result.current,
        ).toBe(false)

        mocks.selectedFundingType = null
        expect(
            renderHook(() => useIsCardAutoFundingActive()).result.current,
        ).toBe(false)
    })
})
