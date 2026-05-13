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

import { render, screen, act } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBottomSheetStore } from '../../../store/bottomSheetStore'
import { BottomSheetManager } from '../BottomSheetManager'

// Match the repo's existing pattern (e.g. SigningCompletedBottomSheet.spec.tsx)
// — replace PWBottomSheet entirely; do NOT use vi.importActual.
vi.mock('@components/core', () => ({
    PWBottomSheet: ({ children }: { children: React.ReactNode }) => (
        <div data-testid='sheet'>{children}</div>
    ),
}))

describe('BottomSheetManager', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('renders nothing when the stack is empty', () => {
        render(<BottomSheetManager />)
        expect(screen.queryAllByTestId('sheet')).toHaveLength(0)
    })

    it('renders one host per pending request', () => {
        render(<BottomSheetManager />)
        act(() => {
            useBottomSheetStore.getState().request({ contents: <span>A</span> })
            useBottomSheetStore.getState().request({ contents: <span>B</span> })
        })
        expect(screen.getAllByTestId('sheet')).toHaveLength(2)
    })

    it('removes a host after remove(id) is called', () => {
        render(<BottomSheetManager />)
        act(() => {
            useBottomSheetStore
                .getState()
                .request({ id: 'X', contents: <span>X</span> })
        })
        expect(screen.getAllByTestId('sheet')).toHaveLength(1)
        act(() => {
            useBottomSheetStore.getState().remove('X')
        })
        expect(screen.queryAllByTestId('sheet')).toHaveLength(0)
    })
})
