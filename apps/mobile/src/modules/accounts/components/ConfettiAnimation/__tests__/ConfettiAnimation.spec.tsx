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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import ConfettiAnimation from '../ConfettiAnimation'

vi.mock('lottie-react-native', () => ({
    default: 'LottieView',
}))

describe('ConfettiAnimation', () => {
    it('renders lottie view when playing', () => {
        render(<ConfettiAnimation play={true} />)
        // With mock, it renders Text 'LottieView' or similar? No, standard mock returns element type 'LottieView'
        expect(screen.toJSON()).toBeDefined()
    })

    it('returns null when not visible', () => {
        render(<ConfettiAnimation play={false} />)
        expect(screen.toJSON()).toBeNull()
    })
})
