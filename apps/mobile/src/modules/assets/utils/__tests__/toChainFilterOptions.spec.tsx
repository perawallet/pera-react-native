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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { render, screen } from '@test-utils/render'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { toChainFilterOptions } from '../toChainFilterOptions'

const CHAINS = ['algorand', 'ethereum'] as ChainId[]

describe('toChainFilterOptions', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('offers one chip per chain, in order', () => {
        expect(toChainFilterOptions(CHAINS, { testIDPrefix: 'p' })).toEqual([
            expect.objectContaining({
                value: 'algorand',
                label: 'Algorand',
                testID: 'p_algorand',
            }),
            expect.objectContaining({
                value: 'ethereum',
                label: 'Ethereum',
                testID: 'p_ethereum',
            }),
        ])
    })

    it('draws each chain chip with its chain icon when asked, and All with none', () => {
        const [all, , ethereum] = toChainFilterOptions(CHAINS, {
            allLabel: 'All',
            testIDPrefix: 'p',
            withIcons: true,
        })

        render(<>{ethereum?.renderIcon?.(16)}</>)

        expect(screen.getByTestId('chain_icon_ethereum')).toBeTruthy()
        expect(all?.renderIcon).toBeUndefined()
    })

    it('leaves chips text-only by default', () => {
        const options = toChainFilterOptions(CHAINS, { testIDPrefix: 'p' })

        expect(options.every(option => option.renderIcon === undefined)).toBe(
            true,
        )
    })

    it('leads with an All chip when given its label', () => {
        const options = toChainFilterOptions(CHAINS, {
            allLabel: 'All',
            testIDPrefix: 'p',
        })

        expect(options[0]).toEqual({
            value: null,
            label: 'All',
            testID: 'p_all',
        })
        expect(options.map(option => option.value)).toEqual([
            null,
            'algorand',
            'ethereum',
        ])
    })

    it('offers nothing for a single chain, with or without All', () => {
        expect(
            toChainFilterOptions(['algorand' as ChainId], {
                allLabel: 'All',
                testIDPrefix: 'p',
            }),
        ).toEqual([])
    })
})
