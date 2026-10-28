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
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
import { registerEthereumChain } from '@test-utils/chain-fixtures'
import { useSuspectedAddressReuseGuard } from '../useSuspectedAddressReuseGuard'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock(
    '../../../components/address-safety/SuspectedAddressReuseWarningContent',
    () => ({ SuspectedAddressReuseWarningContent: () => null }),
)

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const LOOK_ALIKE = '0xF39F000000000000000000000000000000002266'
const REAL = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const SUSPECTED: SuspectedPoisoning = {
    transactionId: 'tx-1',
    counterparty: LOOK_ALIKE,
    imitates: { address: REAL, source: 'contact', name: 'Alice' },
}

const guardFor = (suspectedPoisoning: SuspectedPoisoning | undefined) =>
    renderHook(() =>
        useSuspectedAddressReuseGuard({ suspectedPoisoning, scope: ETHEREUM }),
    ).result.current

describe('useSuspectedAddressReuseGuard', () => {
    beforeAll(() => {
        registerEthereumChain()
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        ['the imitated address', REAL],
        ['a transaction id', 'tx-1'],
    ])('lets %s through without a warning', async (_, value) => {
        await expect(guardFor(SUSPECTED).confirmReuse(value)).resolves.toBe(
            true,
        )
        expect(mocks.request).not.toHaveBeenCalled()
    })

    it('lets everything through when the entry is not suspected', async () => {
        await expect(
            guardFor(undefined).confirmReuse(LOOK_ALIKE),
        ).resolves.toBe(true)
        expect(mocks.request).not.toHaveBeenCalled()
    })

    it.each([
        ['continues', 'continue', true],
        ['cancels', undefined, false],
    ])(
        'warns before the suspected address is reused, in any letter case, and allows it only when the user %s',
        async (_, decision, isAllowed) => {
            mocks.request.mockResolvedValue(decision)

            await expect(
                guardFor(SUSPECTED).confirmReuse(LOOK_ALIKE.toLowerCase()),
            ).resolves.toBe(isAllowed)
            expect(mocks.request).toHaveBeenCalledTimes(1)
        },
    )
})
