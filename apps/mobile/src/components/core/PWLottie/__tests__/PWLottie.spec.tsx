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

import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@test-utils/render'
import { PWLottie } from '../PWLottie'

vi.mock('lottie-react-native', () => ({
    default: ({ testID }: { testID?: string }) => (
        <div data-testid={testID ?? 'lottie-view'} />
    ),
}))

const mockSource = {
    v: '5.0',
    fr: 30,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: 'test',
    ddd: 0,
    assets: [],
    layers: [],
}

describe('PWLottie', () => {
    it('renders and forwards props to LottieView', () => {
        render(
            <PWLottie
                source={mockSource}
                testID='lottie'
            />,
        )
        expect(screen.getByTestId('lottie')).toBeTruthy()
    })
})
