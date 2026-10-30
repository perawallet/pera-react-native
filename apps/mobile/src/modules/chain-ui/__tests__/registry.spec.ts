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

import { describe, expect, it, vi } from 'vitest'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import { ethereumChainUi } from '@modules/ethereum/chain-ui'
import { chainUiFor } from '../registry'

const mocks = vi.hoisted(() => ({ BaseFeeSection: () => null }))

vi.mock('@modules/ethereum/chain-ui', async importOriginal => ({
    ...(await importOriginal<typeof import('@modules/ethereum/chain-ui')>()),
    evmChainUiOverrides: {
        base: { sendConfirmation: { FeeSection: mocks.BaseFeeSection } },
        arbitrum: {
            sendConfirmation: { FeeSection: mocks.BaseFeeSection },
            assetDetails: undefined,
        },
    },
}))

describe('chainUiFor', () => {
    it("returns Algorand's entry for the algorand family", () => {
        const ui = chainUiFor('algorand')

        expect(ui).toBe(algorandChainUi)
        expect(ui.transactionDetails?.ReviewBody).toBeDefined()
        expect(ui.assetDetails?.resolveAbout).toBeDefined()
    })

    it("returns Ethereum's transaction and asset detail slots for the evm family, with no chain sections", () => {
        const ui = chainUiFor('evm')

        expect(ui).toBe(ethereumChainUi)
        expect(ui.transactionDetails?.ReviewBody).toBeDefined()
        expect(ui.transactionDetails?.DetailBody).toBeDefined()
        expect(ui.transactionDetails?.PreviewRow).toBeDefined()
        expect(ui.assetDetails?.resolveAbout).toBeDefined()
        expect(ui.assetDetails?.resolveSupply).toBeDefined()
        expect(ui.assetDetails?.VerificationSection).toBeUndefined()
        expect(ui.assetDetails?.IssuerControlsSection).toBeUndefined()
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

    it("replaces the family's slot with the chain's own", () => {
        expect(chainUiFor('evm', 'base').sendConfirmation?.FeeSection).toBe(
            mocks.BaseFeeSection,
        )
    })

    it("keeps the family's other slots on a chain that overrides one", () => {
        const ui = chainUiFor('evm', 'base')

        expect(ui.transactionDetails).toBe(ethereumChainUi?.transactionDetails)
        expect(ui.familyLabel).toBe('chain_families.evm')
    })

    it('returns the same merged entry on every call for an overridden chain', () => {
        expect(chainUiFor('evm', 'base')).toBe(chainUiFor('evm', 'base'))
    })

    it("inherits the family's slot where an override sets it to undefined", () => {
        const ui = chainUiFor('evm', 'arbitrum')

        expect(ui.assetDetails).toBe(ethereumChainUi?.assetDetails)
        expect(ui.sendConfirmation?.FeeSection).toBe(mocks.BaseFeeSection)
    })

    it("leaves a chain with no override on the family's entry", () => {
        const ui = chainUiFor('evm', 'ethereum')

        expect(ui).toBe(ethereumChainUi)
        expect(ui.sendConfirmation?.FeeSection).not.toBe(mocks.BaseFeeSection)
    })

    it("never lets one family's override reach another family", () => {
        expect(chainUiFor('algorand', 'base')).toBe(algorandChainUi)
    })
})
