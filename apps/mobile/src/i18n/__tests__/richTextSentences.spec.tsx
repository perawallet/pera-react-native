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

import React from 'react'
import { Decimal } from 'decimal.js'
import i18next, { type i18n } from 'i18next'
import { Trans } from 'react-i18next'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@test-utils/render'
import { PWText } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { TRANSLATION_BUNDLES } from '../locales'

const createInstance = async (locale: string): Promise<i18n> => {
    const instance = i18next.createInstance()
    await instance.init({
        lng: locale,
        resources: { [locale]: { translation: TRANSLATION_BUNDLES[locale] } },
        interpolation: { escapeValue: false },
    })
    return instance
}

type SwapSentencesProps = {
    instance: i18n
    amountIn?: string
}

const SwapSentences = ({
    instance,
    amountIn = '5 ALGO',
}: SwapSentencesProps) => (
    <>
        <PWText testID='powered-by'>
            <Trans
                i18n={instance}
                i18nKey='swap.introduction.powered_by'
                components={[
                    <PWText
                        key='brand'
                        testID='brand'
                    />,
                ]}
            />
        </PWText>
        <PWText testID='balance'>
            <Trans
                i18n={instance}
                i18nKey='swap.form.balance_label'
                components={[
                    <AssetAmount
                        key='balance'
                        asset={{
                            assetId: '31566704',
                            unitName: 'USDC',
                            decimals: 6,
                        }}
                        value={new Decimal(12)}
                        symbolPosition='end'
                        isInline
                    />,
                ]}
            />
        </PWText>
        <PWText testID='history'>
            <Trans
                i18n={instance}
                i18nKey='swap.history.list.item.description'
                components={[
                    <PWText key='in'>{amountIn}</PWText>,
                    <PWText key='out'>10 USDC</PWText>,
                ]}
            />
        </PWText>
    </>
)

describe('swap sentences rendered through Trans', () => {
    it.each(Object.keys(TRANSLATION_BUNDLES))(
        '%s keeps every component in the swap sentences',
        async locale => {
            const instance = await createInstance(locale)

            render(<SwapSentences instance={instance} />)

            expect(screen.getByTestId('brand').textContent).toBe('P.E.R.A.')
            const balance = screen.getByTestId('balance')
            expect(balance.textContent).toContain('12 USDC')
            // RN-web renders a View as <div>; one inside the label would escape its truncation.
            expect(balance.querySelector('div')).toBeNull()
            const history = screen.getByTestId('history').textContent
            expect(history).toContain('5 ALGO')
            expect(history).toContain('10 USDC')
        },
    )

    it("keeps an amount's text literal when it looks like markup", async () => {
        const instance = await createInstance('en')

        render(
            <SwapSentences
                instance={instance}
                amountIn='<1/> FAKE'
            />,
        )

        expect(screen.getByTestId('history').textContent).toBe(
            'Swapped <1/> FAKE for 10 USDC',
        )
    })
})
