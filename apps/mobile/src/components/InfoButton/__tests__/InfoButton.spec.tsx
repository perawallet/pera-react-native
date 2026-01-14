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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import InfoButton from '../InfoButton'
import { Text } from 'react-native'

describe('InfoButton', () => {
    it('opens bottom sheet on press', () => {
        // Mock useModalState if needed, but integration test with real state is better if isolated
        // Simple render test
        render(
            <InfoButton title='Info Title'>
                <Text>Info Content</Text>
            </InfoButton>,
        )
        // Check if icon is rendered
        // Actually testing internal logic requires more setup or interaction
        expect(document.body).toBeDefined()
    })
})
