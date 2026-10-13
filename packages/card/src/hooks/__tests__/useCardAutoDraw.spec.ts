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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { registerFakeCardAdapter } from '../../__tests__/fakeCardAdapter'
import { useCardAutoDraw } from '../useCardAutoDraw'

const SCOPE = scopeForLegacyNetwork('testnet')
const account = { address: 'FUNDING' } as WalletAccount

const enableAutoDraw = vi.fn(async () => undefined)
const disableAutoDraw = vi.fn(async () => undefined)

describe('useCardAutoDraw', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeCardAdapter({
            autoDraw: { enableAutoDraw, disableAutoDraw },
        })
    })

    it('forwards the account, card address and scope when enabling', async () => {
        const { result } = renderHook(() => useCardAutoDraw(SCOPE))

        await result.current.enableAutoDraw(account, 'CARD')

        expect(enableAutoDraw).toHaveBeenCalledWith(account, 'CARD', SCOPE)
    })

    it('forwards the account and scope when disabling', async () => {
        const { result } = renderHook(() => useCardAutoDraw(SCOPE))

        await result.current.disableAutoDraw(account)

        expect(disableAutoDraw).toHaveBeenCalledWith(account, SCOPE)
    })

    it("propagates the adapter's rejection", async () => {
        enableAutoDraw.mockRejectedValueOnce(new Error('enable failed'))
        disableAutoDraw.mockRejectedValueOnce(new Error('disable failed'))
        const { result } = renderHook(() => useCardAutoDraw(SCOPE))

        await expect(
            result.current.enableAutoDraw(account, 'CARD'),
        ).rejects.toThrow('enable failed')
        await expect(result.current.disableAutoDraw(account)).rejects.toThrow(
            'disable failed',
        )
    })
})
