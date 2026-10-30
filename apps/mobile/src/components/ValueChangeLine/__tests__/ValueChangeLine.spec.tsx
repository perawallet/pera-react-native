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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSettings } from '@perawallet/wallet-core-settings'
import { render, screen } from '@test-utils/render'
import { ValueChangeLine } from '../ValueChangeLine'

vi.mock('@perawallet/wallet-core-settings', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-settings')
    >()),
    useSettings: vi.fn(),
}))

const setPrivacyMode = (privacyMode: boolean) =>
    vi
        .mocked(useSettings)
        .mockReturnValue({ privacyMode } as ReturnType<typeof useSettings>)

const renderLine = (absolute: string, percentage: string) =>
    render(
        <ValueChangeLine
            absolute={new Decimal(absolute)}
            percentage={new Decimal(percentage)}
            currency='USD'
            testID='change'
        />,
    )

describe('ValueChangeLine', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setPrivacyMode(false)
    })

    it('signs a gain with a plus on both the amount and the percentage', () => {
        renderLine('1020.35', '2.24')

        expect(screen.getByTestId('change').textContent).toMatch(
            /^\+\D*1,?020\.35 \(\+2\.24%\)$/,
        )
    })

    it('signs a loss with a minus on both parts', () => {
        renderLine('-1020.35', '-2.24')

        expect(screen.getByTestId('change').textContent).toMatch(
            /^-\D*1,?020\.35 \(-2\.24%\)$/,
        )
    })

    it('shows no sign when nothing changed', () => {
        renderLine('0', '0')

        expect(screen.getByTestId('change').textContent).toMatch(
            /^\D*0(\.00)? \(0\.00%\)$/,
        )
    })

    it('takes the direction from the amount when the percentage is unknown', () => {
        renderLine('5', '0')

        expect(screen.getByTestId('change').textContent).toMatch(
            /^\+\D*5(\.00)? \(\+0\.00%\)$/,
        )
    })

    it('renders nothing in privacy mode', () => {
        setPrivacyMode(true)

        renderLine('1020.35', '2.24')

        expect(screen.queryByTestId('change')).toBeNull()
    })
})
