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
import { render, screen } from '@test-utils/render'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { TransactionLeadingIcon } from '../TransactionLeadingIcon'

// Tokens with no logo draw their initials, which tell the icons apart here.
const token = (unitName: string) => ({
    chainId: 'ethereum' as const,
    asset: { assetId: `0x${unitName}`, unitName },
})

describe('TransactionLeadingIcon', () => {
    beforeEach(() => {
        registerEthereumChain()
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('leads a send or receive with its asset rather than its network', () => {
        render(
            <TransactionLeadingIcon
                iconName='transactions/send'
                leadingAssets={[token('Alpha Beta')]}
                chainIds={['ethereum']}
            />,
        )

        expect(screen.getByText('AB')).toBeTruthy()
        expect(screen.queryByTestId('chain_icon_ethereum')).toBeNull()
        expect(
            screen.getByTestId('transaction_kind_badge_transactions/send'),
        ).toBeTruthy()
    })

    it('leads a swap with both its assets', () => {
        render(
            <TransactionLeadingIcon
                iconName='transactions/swap'
                leadingAssets={[token('Alpha Beta'), token('Gamma Delta')]}
                chainIds={['ethereum']}
            />,
        )

        expect(screen.getByText('AB')).toBeTruthy()
        expect(screen.getByText('GD')).toBeTruthy()
        expect(
            screen.queryByTestId('transaction_kind_badge_transactions/swap'),
        ).toBeNull()
    })

    it('leads with each network when no asset does', () => {
        render(
            <TransactionLeadingIcon
                iconName='transactions/send'
                leadingAssets={[]}
                chainIds={['ethereum', 'algorand']}
                size='lg'
            />,
        )

        expect(screen.getByTestId('chain_icon_ethereum')).toBeTruthy()
        expect(screen.getByTestId('chain_icon_algorand')).toBeTruthy()
        expect(
            screen.getByTestId('transaction_kind_badge_transactions/send'),
        ).toBeTruthy()
    })

    it('draws the kind icon alone when neither an asset nor a network leads', () => {
        render(
            <TransactionLeadingIcon
                iconName='transactions/send'
                leadingAssets={[]}
                chainIds={[]}
            />,
        )

        expect(screen.queryByTestId('chain_icon_ethereum')).toBeNull()
        expect(screen.queryByText(/^[A-Z]{1,2}$/)).toBeNull()
        expect(
            screen.queryByTestId('transaction_kind_badge_transactions/send'),
        ).toBeNull()
    })
})
