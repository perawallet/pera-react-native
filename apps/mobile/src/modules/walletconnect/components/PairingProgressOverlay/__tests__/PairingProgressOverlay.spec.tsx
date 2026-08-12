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
import { act, render, screen } from '@test-utils/render'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePairingProgressStore } from '../../../stores/usePairingProgressStore'
import { PairingProgressOverlay } from '../PairingProgressOverlay'

describe('PairingProgressOverlay', () => {
    beforeEach(() => {
        usePairingProgressStore.getState().resetState()
    })

    it('renders nothing while no pairing is in flight', () => {
        render(<PairingProgressOverlay />)
        expect(
            screen.queryByText('walletconnect.pairing.connecting'),
        ).toBeNull()
    })

    it('shows the connecting label while a pairing is in flight and hides it after', () => {
        render(<PairingProgressOverlay />)

        act(() => {
            usePairingProgressStore.getState().beginPairing()
        })
        expect(
            screen.getByText('walletconnect.pairing.connecting'),
        ).toBeTruthy()

        act(() => {
            usePairingProgressStore.getState().endPairing()
        })
        expect(
            screen.queryByText('walletconnect.pairing.connecting'),
        ).toBeNull()
    })
})
