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

import { describe, expect, it, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { networkListOf } from '../networkList'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ base: 'Base', bsc: 'BNB Chain', arbitrum: 'Arbitrum One' })[chainId],
}))

const t = (key: string, options?: Record<string, unknown>) =>
    `${key}(${options?.first}|${options?.last})`

describe('networkListOf', () => {
    it('names a single network on its own', () => {
        expect(networkListOf(['base'] as ChainId[], t)).toBe('Base')
    })

    it('joins all but the last with commas and the last with the translated conjunction', () => {
        expect(networkListOf(['base', 'bsc', 'arbitrum'] as ChainId[], t)).toBe(
            'common.networks_list(Base, BNB Chain|Arbitrum One)',
        )
    })

    it('falls back to the chain id for a chain with no display name', () => {
        expect(networkListOf(['unknown' as ChainId], t)).toBe('unknown')
    })
})
