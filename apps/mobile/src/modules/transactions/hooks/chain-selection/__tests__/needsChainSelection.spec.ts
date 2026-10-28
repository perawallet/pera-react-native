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

import { describe, expect, it } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { needsChainSelection } from '../needsChainSelection'

const option = (chainId: string, isEnabled: boolean) => ({
    chainId: chainId as ChainId,
    isEnabled,
})

describe('needsChainSelection', () => {
    it('goes straight to the QR for a single enabled chain', () => {
        expect(needsChainSelection([option('algorand', true)])).toBe(
            false,
        )
    })

    it('asks when there is more than one chain to receive on', () => {
        expect(
            needsChainSelection([
                option('ethereum', true),
                option('base', false),
            ]),
        ).toBe(true)
    })

    it('asks when the only option still has to be enabled', () => {
        expect(needsChainSelection([option('base', false)])).toBe(true)
    })
})
