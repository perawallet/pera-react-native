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

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmRampAdapter } from '../adapter'

const addIncomingToken = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal()),
    useAddIncomingTokenMutation: () => ({ addIncomingToken }),
}))

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

describe('the Ethereum ramp adapter', () => {
    it('adds the bought token to the account without holding up the order', async () => {
        // Never settles: the order must not wait on it.
        addIncomingToken.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() =>
            createEvmRampAdapter(ETHEREUM).useEnsureCanReceive!(),
        )
        const scope = evmScopeOf(ETHEREUM)

        const canReceive = await result.current({
            address: '0xAA',
            scope,
            assetId: USDC,
        })

        expect(canReceive).toBe(true)
        expect(addIncomingToken).toHaveBeenCalledWith({
            accountAddress: '0xAA',
            scope,
            assetId: USDC,
        })
    })
})
