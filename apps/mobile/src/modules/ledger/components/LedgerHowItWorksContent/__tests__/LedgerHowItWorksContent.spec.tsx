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

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@test-utils/render'
import { LedgerHowItWorksContent } from '../LedgerHowItWorksContent'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

describe('LedgerHowItWorksContent', () => {
    it('renders the title and all four step strings', () => {
        render(<LedgerHowItWorksContent />)

        expect(screen.getByText('ledger.how_does_it_work.title')).toBeTruthy()
        expect(screen.getByText('ledger.how_does_it_work.step_1')).toBeTruthy()
        expect(screen.getByText('ledger.how_does_it_work.step_2')).toBeTruthy()
        expect(screen.getByText('ledger.how_does_it_work.step_3')).toBeTruthy()
        expect(screen.getByText('ledger.how_does_it_work.step_4')).toBeTruthy()
    })
})
