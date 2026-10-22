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

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen } from '@test-utils/render'
import { AutoLockGuard } from '../AutoLockGuard'
import {
    useIsLockOverlayVisible,
    useLockOverlayState,
} from '@hooks/useIsLockOverlayVisible'
import { useAutoLockListener } from '../useAutoLockListener'
import { useLockScreen } from '../useLockScreen'
import { PWText } from '@components/core'

vi.mock('../useAutoLockListener', () => ({ useAutoLockListener: vi.fn() }))
vi.mock('../useLockScreen', () => ({ useLockScreen: vi.fn() }))
vi.mock('../../PinEntry', () => ({ PinEntry: () => null }))
vi.mock('../LockoutView', () => ({ LockoutView: () => null }))

const LockOverlayVisibilityProbe = () => (
    <PWText testID='probe'>{String(useIsLockOverlayVisible())}</PWText>
)

const LockOverlayStateProbe = () => (
    <PWText testID='state-probe'>{useLockOverlayState()}</PWText>
)

describe('AutoLockGuard lock-overlay context', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useLockScreen as Mock).mockReturnValue({
            hasError: false,
            isLockedOut: false,
            remainingSeconds: 0,
            isDuressWipeInProgress: false,
            handlePinComplete: vi.fn(),
            handleErrorAnimationComplete: vi.fn(),
        })
    })

    const renderWithGuard = (listener: {
        isLocked: boolean
        isChecking: boolean
    }) => {
        ;(useAutoLockListener as Mock).mockReturnValue({
            ...listener,
            unlock: vi.fn(),
            handleResetData: vi.fn(),
        })
        render(
            <AutoLockGuard>
                <LockOverlayVisibilityProbe />
                <LockOverlayStateProbe />
            </AutoLockGuard>,
        )
    }

    it('publishes false while the app is visible', () => {
        renderWithGuard({ isLocked: false, isChecking: false })

        expect(screen.getByText('false')).toBeTruthy()
    })

    it('publishes true while the PIN screen is up', () => {
        renderWithGuard({ isLocked: true, isChecking: false })

        expect(screen.getByText('true')).toBeTruthy()
    })

    it('publishes true while the startup check is still running', () => {
        renderWithGuard({ isLocked: false, isChecking: true })

        expect(screen.getByText('true')).toBeTruthy()
    })

    // The QR scanner rides out 'checking' covered but dismisses for 'locked', so
    // a PIN screen must never be reported as a check.
    it('reports the PIN screen as locked', () => {
        renderWithGuard({ isLocked: true, isChecking: false })

        expect(screen.getByText('locked')).toBeTruthy()
    })

    it('reports the resume or startup decision as checking', () => {
        renderWithGuard({ isLocked: false, isChecking: true })

        expect(screen.getByText('checking')).toBeTruthy()
    })

    it('reports a locked app as locked even while a check runs', () => {
        renderWithGuard({ isLocked: true, isChecking: true })

        expect(screen.getByText('locked')).toBeTruthy()
    })

    it('reports none while the app is visible', () => {
        renderWithGuard({ isLocked: false, isChecking: false })

        expect(screen.getByText('none')).toBeTruthy()
    })
})
