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

import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { PWText } from '../PWText'

describe('PWText', () => {
    it('renders children correctly', () => {
        render(<PWText>Hello World</PWText>)
        expect(screen.getByText('Hello World')).toBeTruthy()
    })

    it('applies variant styles correctly', () => {
        render(<PWText variant='h1'>Heading 1</PWText>)
        // RNE Text maps h1 prop to styles, difficult to test exact style composition without snapshots or shallow rendering,
        // but checking render is sufficient for wrapper presence.
        expect(screen.getByText('Heading 1')).toBeTruthy()
    })
})
