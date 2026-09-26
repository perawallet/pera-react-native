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

const mocks = vi.hoisted(() => ({
    connectedAddress: null as string | null,
}))

vi.mock('@perawallet/wallet-core-chain-algorand/card', async () => ({
    ...(await vi.importActual<object>(
        '@perawallet/wallet-core-chain-algorand/card',
    )),
    useCardStore: (
        selector: (state: {
            connectedFundingSourceAddress: string | null
        }) => unknown,
    ) => selector({ connectedFundingSourceAddress: mocks.connectedAddress }),
}))

import { useCardFundingAccount } from '../useCardFundingAccount'

const localAccount = { address: 'LOCAL', type: 'algo25' } as WalletAccount

describe('useCardFundingAccount', () => {
    beforeEach(() => {
        mocks.connectedAddress = 'LOCAL'
        vi.mocked(useFindAccountByAddress).mockImplementation(
            address => [localAccount].find(a => a.address === address) ?? null,
        )
    })

    it('resolves the connected address to a local account', () => {
        const { result } = renderHook(() => useCardFundingAccount())

        expect(result.current).toBe(localAccount)
    })

    it('is null when nothing is connected', () => {
        mocks.connectedAddress = null

        const { result } = renderHook(() => useCardFundingAccount())

        expect(result.current).toBeNull()
    })

    // A stored address can outlive the account, e.g. after it is removed from
    // the wallet, and callers must not treat that as a usable funding source.
    it('is null when the stored address is no longer in the wallet', () => {
        mocks.connectedAddress = 'REMOVED'

        const { result } = renderHook(() => useCardFundingAccount())

        expect(result.current).toBeNull()
    })
})
