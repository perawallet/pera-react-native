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
import { beforeEach, describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { hiddenAssetIdsOf, useHiddenTokensStore } from '../hiddenTokens'
import { settleInboxTokens } from '../inboxTokens'
import { keptAssetIdsOf, useKeptTokensStore } from '../keptTokens'

const ETH: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const ADDRESS = '0xabc'

const tokens = [
    { address: ADDRESS, scope: ETH, assetId: '0x1' },
    { address: ADDRESS, scope: ETH, assetId: '0x2' },
    { address: ADDRESS, scope: BASE, assetId: '0x3' },
]

describe('settleInboxTokens', () => {
    beforeEach(() => {
        useKeptTokensStore.getState().resetState()
        useHiddenTokensStore.getState().resetState()
    })

    it('keeps every accepted token under its own address and network', () => {
        settleInboxTokens(tokens, true)

        const { keptTokens } = useKeptTokensStore.getState()
        expect(keptAssetIdsOf(keptTokens, ADDRESS, ETH)).toEqual(['0x1', '0x2'])
        expect(keptAssetIdsOf(keptTokens, ADDRESS, BASE)).toEqual(['0x3'])
        expect(useHiddenTokensStore.getState().hiddenTokens).toEqual({})
    })

    it('hides every rejected token, keeping none', () => {
        settleInboxTokens(tokens, false)

        const { hiddenTokens } = useHiddenTokensStore.getState()
        expect(hiddenAssetIdsOf(hiddenTokens, ADDRESS, ETH)).toEqual([
            '0x1',
            '0x2',
        ])
        expect(hiddenAssetIdsOf(hiddenTokens, ADDRESS, BASE)).toEqual(['0x3'])
        expect(useKeptTokensStore.getState().keptTokens).toEqual({})
    })
})
