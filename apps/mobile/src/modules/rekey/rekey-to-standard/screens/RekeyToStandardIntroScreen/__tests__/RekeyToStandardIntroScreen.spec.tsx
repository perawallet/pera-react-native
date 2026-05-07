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

import { render, screen, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RekeyToStandardIntroScreen } from '../RekeyToStandardIntroScreen'

const mockHandleStartProcess = vi.fn()
const mockHandleLearnMore = vi.fn()

vi.mock('../useRekeyToStandardIntroScreen', () => ({
    useRekeyToStandardIntroScreen: () => ({
        handleStartProcess: mockHandleStartProcess,
        handleLearnMore: mockHandleLearnMore,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@assets/images/rekey-to-standard-hero.jpg', () => ({
    default: 1,
}))

describe('RekeyToStandardIntroScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('invokes handleStartProcess when the CTA is pressed', () => {
        render(<RekeyToStandardIntroScreen />)

        fireEvent.click(screen.getByTestId('rekey-to-standard-intro-start'))

        expect(mockHandleStartProcess).toHaveBeenCalledTimes(1)
    })

    it('invokes handleLearnMore when the inline link is pressed', () => {
        render(<RekeyToStandardIntroScreen />)

        fireEvent.click(screen.getByText('rekey.to_standard.intro.learn_more'))

        expect(mockHandleLearnMore).toHaveBeenCalledTimes(1)
    })

    it('renders the three "what to expect" rows from i18n', () => {
        render(<RekeyToStandardIntroScreen />)

        expect(
            screen.getByText('rekey.to_standard.intro.expect_1'),
        ).toBeTruthy()
        expect(
            screen.getByText('rekey.to_standard.intro.expect_2'),
        ).toBeTruthy()
        expect(
            screen.getByText('rekey.to_standard.intro.expect_3'),
        ).toBeTruthy()
    })
})
