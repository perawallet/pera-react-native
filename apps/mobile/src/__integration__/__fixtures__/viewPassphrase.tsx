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
import { expect } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { isElementDisabled } from '@test-utils/rnw'
import { useViewPassphraseFlow } from '@modules/view-passphrase'
import { BottomSheetManager } from '@modules/bottom-sheet'

// Tiny host that drives the imperative `useViewPassphraseFlow` hook
// when the trigger is tapped. Models how `AccountOptionsContent` opens
// the flow in production: it calls `openViewPassphraseFlow(address)`
// after dismissing the parent options sheet.
export const ViewPassphraseHost = ({
    address,
    onClose = () => undefined,
}: {
    address: string
    onClose?: () => void
}) => {
    const { openViewPassphraseFlow } = useViewPassphraseFlow()
    return (
        <>
            {/* The flow opens its PIN / acknowledge / display steps via
                `useBottomSheet().request(...)` — the test harness uses
                `render()` directly (not `renderWithNavigation`), so we
                need to mount the manager here ourselves. */}
            <BottomSheetManager />
            <button
                data-testid='open_view_passphrase'
                onClick={() => {
                    void openViewPassphraseFlow(address).finally(onClose)
                }}
            >
                Open
            </button>
        </>
    )
}

// Walk the open ViewPassphrase grid and pull every word leaf in render
// order. The grid lays words out in two columns top-to-bottom; this
// regex matches every plain alpha-only word cell while skipping the
// numeric index cells (which render digits, not letters).
export const readMnemonicWordsFromGrid = (): string[] => {
    const grid = screen.getByTestId('view_passphrase_bottom_sheet_grid')
    return within(grid)
        .getAllByText(/^[a-z]+$/)
        .map(node => node.textContent ?? '')
}

// Drive the flow from a closed state through to the words display:
// open the trigger, tick all four acknowledge boxes, and tap reveal.
// Returns once the words grid has rendered. Use this from any test
// whose subject is the resolved mnemonic, not the gate behavior.
export const advanceToDisplayedWords = async (): Promise<void> => {
    fireEvent.click(screen.getByTestId('open_view_passphrase'))
    await waitFor(() => {
        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_reveal'),
        ).toBeTruthy()
    })
    for (let i = 0; i < 4; i++) {
        fireEvent.click(
            screen.getByTestId(`passphrase_acknowledge_bottom_sheet_row_${i}`),
        )
    }
    const revealButton = () =>
        screen.getByTestId('passphrase_acknowledge_bottom_sheet_reveal')
    await waitFor(() => {
        expect(isElementDisabled(revealButton())).toBe(false)
    })
    fireEvent.click(revealButton())
    await waitFor(
        () => {
            expect(
                screen.getByTestId('view_passphrase_bottom_sheet_grid'),
            ).toBeTruthy()
        },
        { timeout: 5000 },
    )
}
