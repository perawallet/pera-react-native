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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LedgerTroubleshootingScreen } from '../LedgerTroubleshootingScreen'

const mockGoBack = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({ goBack: mockGoBack }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

describe('LedgerTroubleshootingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the title and both sections', () => {
        render(<LedgerTroubleshootingScreen />)

        expect(screen.getByText('ledger.troubleshooting.title')).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.pairing_steps_title'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.common_issues_title'),
        ).toBeTruthy()
    })

    it('renders all three pairing steps and four common issues', () => {
        render(<LedgerTroubleshootingScreen />)

        expect(
            screen.getByText('ledger.troubleshooting.pairing_step_1'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.pairing_step_2'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.pairing_step_3'),
        ).toBeTruthy()

        expect(
            screen.getByText('ledger.troubleshooting.issue_unlocked'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.issue_bluetooth'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.issue_permissions'),
        ).toBeTruthy()
        expect(
            screen.getByText('ledger.troubleshooting.issue_unsupported'),
        ).toBeTruthy()
    })

    it('navigates back when the done button is pressed', () => {
        render(<LedgerTroubleshootingScreen />)
        const doneButton = screen.getByText('ledger.troubleshooting.done')
        fireEvent.click(doneButton)
        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })
})
