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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import { TitledExpandablePanel } from '../TitledExpandablePanel'
import { Text } from 'react-native'

describe('TitledExpandablePanel', () => {
    it('renders title', () => {
        render(
            <TitledExpandablePanel title='My Panel'>
                <Text>Content</Text>
            </TitledExpandablePanel>,
        )
        expect(screen.getByText('My Panel')).toBeTruthy()
    })

    it('toggles expansion on press', () => {
        render(
            <TitledExpandablePanel title='My Panel'>
                <Text>Content</Text>
            </TitledExpandablePanel>,
        )

        // react-native-web renders the collapsed panel's pointerEvents prop
        // as a `pointer-events` attribute, not a style token.
        const content = screen.getByText('Content').parentElement
        expect(content?.getAttribute('pointer-events')).toBe('none')

        fireEvent.click(screen.getByText('My Panel'))

        expect(content?.getAttribute('pointer-events')).toBe('auto')
    })
})
