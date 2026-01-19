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
import { describe, it, expect, vi } from 'vitest'
import { ConfettiAnimation } from '../ConfettiAnimation'

vi.mock('lottie-react-native', () => ({
    default: () => <div data-testid='lottie-view' />,
}))

describe('ConfettiAnimation', () => {
    it('renders lottie view after delay when playing', () => {
        vi.useFakeTimers()
        render(<ConfettiAnimation play={true} />)

        // Initially should be null due to delay
        expect(screen.queryByTestId('lottie-view')).toBeNull()

        // Fast-forward 500ms
        act(() => {
            vi.advanceTimersByTime(500)
        })

        expect(screen.getByTestId('lottie-view')).toBeTruthy()
        vi.useRealTimers()
    })

    it('returns null when not visible', () => {
        const { container } = render(<ConfettiAnimation play={false} />)
        expect(container.firstChild).toBeNull()
    })
})
