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
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { ExpressSendScreen } from '../ExpressSendScreen'
import { useExpressSendScreen } from '../useExpressSendScreen'

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({
            navigate: vi.fn(),
            replace: vi.fn(),
        }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: vi.fn(({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    )),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: vi.fn(({ children }: any) => <div>{children}</div>),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: vi.fn(({ children }: any) => <span>{children}</span>),
    PWIcon: vi.fn(() => <div />),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWScrollView: vi.fn(({ children }: any) => <div>{children}</div>),
}))

vi.mock('../useExpressSendScreen', () => ({
    useExpressSendScreen: vi.fn(),
}))

const mockHandleContinue = vi.fn()
const mockHandleDontShowAgain = vi.fn()

describe('ExpressSendScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useExpressSendScreen as Mock).mockReturnValue({
            handleContinue: mockHandleContinue,
            handleDontShowAgain: mockHandleDontShowAgain,
        })
    })

    it('renders title and step texts', () => {
        render(<ExpressSendScreen />)

        expect(screen.getByText('send_funds.express_send.title')).toBeTruthy()
        expect(screen.getByText('send_funds.express_send.step_1')).toBeTruthy()
        expect(screen.getByText('send_funds.express_send.step_2')).toBeTruthy()
        expect(screen.getByText('send_funds.express_send.step_3')).toBeTruthy()
    })

    it('calls handleContinue when continue button is pressed', () => {
        render(<ExpressSendScreen />)

        fireEvent.click(screen.getByText('send_funds.express_send.continue'))

        expect(mockHandleContinue).toHaveBeenCalledTimes(1)
    })

    it('calls handleDontShowAgain when dont show again button is pressed', () => {
        render(<ExpressSendScreen />)

        fireEvent.click(
            screen.getByText('send_funds.express_send.dont_show_again'),
        )

        expect(mockHandleDontShowAgain).toHaveBeenCalledTimes(1)
    })
})
