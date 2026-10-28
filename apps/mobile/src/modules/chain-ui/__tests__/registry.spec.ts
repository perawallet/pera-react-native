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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import { ethereumChainUi } from '@modules/ethereum/chain-ui'
import { chainUiFor } from '../registry'

describe('chainUiFor', () => {
    it("returns Algorand's entry for the algorand family", () => {
        const ui = chainUiFor('algorand')

        expect(ui).toBe(algorandChainUi)
        expect(ui.transactionDetails?.ReviewBody).toBeDefined()
        expect(ui.assetDetails?.resolveAbout).toBeDefined()
    })

    it("returns Ethereum's transaction slots for the evm family, with no asset details", () => {
        const ui = chainUiFor('evm')

        expect(ui).toBe(ethereumChainUi)
        expect(ui.transactionDetails?.ReviewBody).toBeDefined()
        expect(ui.transactionDetails?.DetailBody).toBeDefined()
        expect(ui.transactionDetails?.PreviewRow).toBeDefined()
        expect(ui.assetDetails).toBeUndefined()
    })

    it('gives each bundled family its own passphrase explainer paragraph', () => {
        expect(chainUiFor('algorand').passphraseCompatibilityKey).toBe(
            'view_passphrase.compatibility.algorand',
        )
        expect(chainUiFor('evm').passphraseCompatibilityKey).toBe(
            'view_passphrase.compatibility.evm',
        )
    })

    it('returns an entry with no slots for a family nobody registered', () => {
        const ui = chainUiFor('solana' as ChainFamily)

        expect(ui.transactionDetails).toBeUndefined()
        expect(ui.assetDetails).toBeUndefined()
    })
})
