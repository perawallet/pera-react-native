/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { fireEvent, render, screen } from '@test-utils/render'
import { Decimal } from 'decimal.js'
import { describe, expect, it, vi } from 'vitest'
import type { StakingProject } from '@modules/staking/models'
import { StakingProjectCard } from '../StakingProjectCard'

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredFiatCurrency: 'USD',
        usdToPreferred: (val: unknown) => val,
    })),
}))

vi.mock('@components/CurrencyDisplay', () => ({
    CurrencyDisplay: () => <div>CurrencyDisplay</div>,
}))

const PROJECT: StakingProject = {
    id: 'tinyman',
    title: 'Tinyman',
    description:
        'Stake your Algo on Tinyman to collect rewards and receive tALGO',
    logoUrl:
        'https://algorand.co/hs-fs/hubfs/tALGO@2x.png?width=80&height=80&name=tALGO@2x.png',
    link: 'https://app.tinyman.org/liquid-stake/stake',
    type: 'liquid',
    tvlInAlgo: new Decimal(2500000),
    tvlInUsd: new Decimal(3100000),
}

describe('StakingProjectCard', () => {
    it('renders project information', () => {
        render(
            <StakingProjectCard
                project={PROJECT}
                onPress={vi.fn()}
            />,
        )

        expect(screen.getByText('Tinyman')).toBeTruthy()
        expect(
            screen.getByText(
                'Stake your Algo on Tinyman to collect rewards and receive tALGO',
            ),
        ).toBeTruthy()
        expect(screen.getByText('staking.type_liquid')).toBeTruthy()
        expect(screen.getByText('TVL')).toBeTruthy()
        expect(screen.getAllByText('CurrencyDisplay')).toHaveLength(2)
    })

    it('calls onPress with project when card is pressed', () => {
        const onPress = vi.fn()

        render(
            <StakingProjectCard
                project={PROJECT}
                onPress={onPress}
            />,
        )

        fireEvent.click(screen.getByTestId('staking-project-card-tinyman'))

        expect(onPress).toHaveBeenCalledWith(PROJECT)
    })
})
