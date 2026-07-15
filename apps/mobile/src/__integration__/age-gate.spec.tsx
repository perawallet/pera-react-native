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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

// Ensure the platform constants module is not intercepted by any prior mock.
vi.unmock('@perawallet/wallet-extension-platform')

import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { withAgeGate } from '@components/AgeGated'
import { DiscoverScreen } from '@modules/discover/screens/DiscoverScreen/DiscoverScreen'
import { useAgeGateStore } from '@perawallet/wallet-core-age-gate'

// The gate is applied at the navigator via withAgeGate (screens no longer
// self-wrap), so exercise the gated screen as it is registered in the routes.
const GatedDiscoverScreen = withAgeGate(DiscoverScreen)

describe('Flow: Discover — age gate', () => {
    beforeEach(() => {
        // Start each test from a clean unknown state so the gate always runs.
        // resetState is synchronous; void marks the act() return as ignored.
        void act(() => useAgeGateStore.getState().resetState())
    })

    afterEach(() => {
        void act(() => useAgeGateStore.getState().resetState())
    })

    it('Given age is unknown, when Discover mounts, then the self-declaration sheet appears', async () => {
        renderWithNavigation(GatedDiscoverScreen, 'Discover')

        await waitFor(() => {
            expect(screen.getByTestId('age-gate-declaration')).toBeTruthy()
        })
    })

    it('Given the declaration sheet is open, when the user presses No, then the restricted fallback appears', async () => {
        renderWithNavigation(GatedDiscoverScreen, 'Discover')

        await waitFor(() => screen.getByTestId('age-gate-declaration'))

        fireEvent.click(screen.getByText('age_gate.declare.no'))

        await waitFor(() => {
            expect(screen.getByTestId('age-gate-retry')).toBeTruthy()
        })
    })
})
