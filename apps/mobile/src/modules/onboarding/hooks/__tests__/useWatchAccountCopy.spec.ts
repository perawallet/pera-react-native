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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useWatchAccountCopy } from '../useWatchAccountCopy'

const ALGORAND_COPY = {
    optionDescriptionKey: 'algorand.option',
    descriptionKey: 'algorand.description',
    invalidAddressKey: 'algorand.invalid',
}

const mocks = vi.hoisted(() => ({
    chains: [] as { id: string; family: string }[],
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ chains: { list: () => mocks.chains } }),
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) =>
        family === 'algorand' ? { watchAccountCopy: ALGORAND_COPY } : {},
}))

const chains = (...ids: string[]) => ids as ChainId[]

describe('useWatchAccountCopy', () => {
    beforeEach(() => {
        mocks.chains = [
            { id: 'algorand', family: 'algorand' },
            { id: 'ethereum', family: 'evm' },
            { id: 'base', family: 'evm' },
        ]
    })

    it("uses Algorand's own copy while only Algorand can watch accounts", () => {
        const { result } = renderHook(() =>
            useWatchAccountCopy(chains('algorand')),
        )

        expect(result.current).toEqual(ALGORAND_COPY)
    })

    it('names no chain while chains of several families can watch accounts', () => {
        const { result } = renderHook(() =>
            useWatchAccountCopy(chains('algorand', 'ethereum')),
        )

        expect(result.current).toEqual({
            optionDescriptionKey:
                'onboarding.add_account.watch_address_option_description_generic',
            descriptionKey: 'onboarding.watch_account.description_generic',
            invalidAddressKey:
                'onboarding.watch_account.invalid_address_generic',
        })
    })

    it('names no chain while only a family without its own copy can watch accounts', () => {
        const { result } = renderHook(() =>
            useWatchAccountCopy(chains('ethereum', 'base')),
        )

        expect(result.current.descriptionKey).toBe(
            'onboarding.watch_account.description_generic',
        )
    })

    it('names no chain when no chain can watch accounts', () => {
        const { result } = renderHook(() => useWatchAccountCopy(chains()))

        expect(result.current.descriptionKey).toBe(
            'onboarding.watch_account.description_generic',
        )
    })
})
