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

import { describe, expect, test, vi } from 'vitest'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { readForOwnedAccounts } from '../ownedAccounts'

const notOnDevice = () =>
    new PeraNetworkError('client', {
        status: 422,
        backendCode: 'account_not_on_device',
    })

// Answers like the router: refuses any list naming an account outside `owned`.
const routerHolding = (owned: string[]) =>
    vi.fn(async (accounts: string[], _limit?: number) => {
        if (accounts.some(account => !owned.includes(account))) {
            throw notOnDevice()
        }
        return accounts.join(',')
    })

describe('swaps/readForOwnedAccounts', () => {
    test('reads once when the router takes the whole list', async () => {
        const read = routerHolding(['A', 'B'])

        const result = await readForOwnedAccounts(['A', 'B'], read)

        expect(result).toEqual({ value: 'A,B', accounts: ['A', 'B'] })
        expect(read).toHaveBeenCalledTimes(1)
    })

    test('drops the account the router refuses and reads the rest', async () => {
        const read = routerHolding(['A', 'C'])

        const result = await readForOwnedAccounts(['A', 'B', 'C'], read)

        expect(result).toEqual({ value: 'A,C', accounts: ['A', 'C'] })
        expect(read).toHaveBeenCalledWith(['B'], 1)
        expect(read).toHaveBeenLastCalledWith(['A', 'C'])
    })

    test('keeps the refusal when the device holds none of them', async () => {
        const read = routerHolding([])

        await expect(readForOwnedAccounts(['A', 'B'], read)).rejects.toThrow(
            PeraNetworkError,
        )
    })

    test('keeps the refusal of a single account without probing', async () => {
        const read = routerHolding([])

        await expect(readForOwnedAccounts(['A'], read)).rejects.toThrow(
            PeraNetworkError,
        )
        expect(read).toHaveBeenCalledTimes(1)
    })

    test('rethrows any other failure', async () => {
        const read = vi.fn(async () => {
            throw new Error('offline')
        })

        await expect(readForOwnedAccounts(['A', 'B'], read)).rejects.toThrow(
            'offline',
        )
        expect(read).toHaveBeenCalledTimes(1)
    })
})
