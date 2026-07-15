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
import React, { useEffect } from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { Text } from 'react-native'
import { PWTouchableOpacity } from '../PWTouchableOpacity'

describe('PWTouchableOpacity', () => {
    it('calls onPress when clicked', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableOpacity onPress={onPress}>
                <Text>Click Me</Text>
            </PWTouchableOpacity>,
        )

        fireEvent.click(screen.getByText('Click Me'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('swallows a rapid second press (double-tap guard)', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableOpacity onPress={onPress}>
                <Text>Tap</Text>
            </PWTouchableOpacity>,
        )

        fireEvent.click(screen.getByText('Tap'))
        fireEvent.click(screen.getByText('Tap'))

        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('allows rapid repeats when allowRapidPress is set', () => {
        const onPress = vi.fn()
        render(
            <PWTouchableOpacity
                onPress={onPress}
                allowRapidPress
            >
                <Text>Tap</Text>
            </PWTouchableOpacity>,
        )

        fireEvent.click(screen.getByText('Tap'))
        fireEvent.click(screen.getByText('Tap'))

        expect(onPress).toHaveBeenCalledTimes(2)
    })

    it('renders children correctly', () => {
        render(
            <PWTouchableOpacity>
                <Text>Child Text</Text>
            </PWTouchableOpacity>,
        )

        expect(screen.getByText('Child Text')).toBeTruthy()
    })

    it('remounts the touchable when disabled flips to enabled', () => {
        // RN's Pressability leaves a stale, collapsed press region when only the
        // `disabled` prop flips (no layout event fires), so a button that mounts
        // disabled and is later enabled only responds near its center. We key the
        // touchable on `disabled` to force a fresh mount — and re-measure — when
        // it becomes enabled. The press-region bug itself isn't reproducible in
        // jsdom, so guard the remount that fixes it: a child mounts twice across
        // the flip. Drop the key and this child mounts only once.
        const onMount = vi.fn()
        const MountProbe = () => {
            useEffect(() => onMount(), [])
            return <Text>Probe</Text>
        }

        const { rerender } = render(
            <PWTouchableOpacity disabled>
                <MountProbe />
            </PWTouchableOpacity>,
        )
        expect(onMount).toHaveBeenCalledTimes(1)

        rerender(
            <PWTouchableOpacity disabled={false}>
                <MountProbe />
            </PWTouchableOpacity>,
        )
        expect(onMount).toHaveBeenCalledTimes(2)
    })
})
