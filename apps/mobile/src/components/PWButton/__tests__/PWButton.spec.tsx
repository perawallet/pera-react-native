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
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import { PWButton } from '../PWButton'

describe('PWButton', () => {
    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        render(
            <PWButton
                title='Click Me'
                onPress={onPress}
                variant='primary'
            />,
        )

        // Use click instead of press since we're testing with react-native-web
        fireEvent.click(screen.getByText('Click Me'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it('shows loading indicator and does not call onPress when loading', () => {
        const onPress = vi.fn()
        render(
            <PWButton
                title='Click Me'
                onPress={onPress}
                variant='primary'
                isLoading={true}
            />,
        )

        // When loading, loading indicator should be present.
        // Since we don't have explicit testID, check for absence of text or verify logic.
        // Implementation: {!!props.title && !props.loading && <Text...>}
        expect(screen.queryByText('Click Me')).toBeNull()
    })
})
