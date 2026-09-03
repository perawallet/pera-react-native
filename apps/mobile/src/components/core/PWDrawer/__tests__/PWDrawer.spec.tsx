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

import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render, screen } from '@test-utils/render'

import { PWDrawer } from '../PWDrawer'

// The drag is reanimated worklets writing a shared value, which this environment
// stubs out — so these cover what is mounted when (the structure the gesture acts
// on) and leave the physics and the layering to on-device testing rather than
// asserting against a mock that would pass either way.
const renderDrawer = (props: Partial<Parameters<typeof PWDrawer>[0]> = {}) =>
    render(
        <PWDrawer
            isOpen={false}
            onOpen={vi.fn()}
            onClose={vi.fn()}
            renderContent={() => <Text>Panel</Text>}
            {...props}
        >
            <Text>Screen</Text>
        </PWDrawer>,
    )

describe('PWDrawer', () => {
    it('mounts the panel and the wrapped content together', () => {
        renderDrawer()

        expect(screen.getByText('Screen')).toBeTruthy()
        expect(screen.getByText('Panel')).toBeTruthy()
    })

    it('keeps the panel mounted while closed, so opening does not remount it', () => {
        renderDrawer({ isOpen: false })

        expect(screen.getByText('Panel')).toBeTruthy()
    })

    it('exposes a gesture surface for the edge drag', () => {
        renderDrawer()

        expect(screen.getByTestId('pw_drawer_gesture_surface')).toBeTruthy()
    })

    it('drops the gesture surface when swiping is disabled', () => {
        renderDrawer({ isSwipeEnabled: false })

        expect(screen.queryByTestId('pw_drawer_gesture_surface')).toBeNull()
    })
})
