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
import { render, screen, fireEvent } from '@test-utils/render'
import { LedgerConnectingBottomSheet } from '../LedgerConnectingBottomSheet'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

describe('LedgerConnectingBottomSheet', () => {
    it('renders the title and subtitle when visible', () => {
        render(
            <LedgerConnectingBottomSheet
                isVisible={true}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.getByText('ledger.connecting.title')).toBeTruthy()
        expect(screen.getByText('ledger.connecting.subtitle')).toBeTruthy()
    })

    it('calls onCancel when the cancel button is pressed', () => {
        const onCancel = vi.fn()
        render(
            <LedgerConnectingBottomSheet
                isVisible={true}
                onCancel={onCancel}
            />,
        )

        fireEvent.click(screen.getByText('ledger.connecting.cancel'))

        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})
