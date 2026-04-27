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
import { ParticipantCount } from '../ParticipantCount'

describe('ParticipantCount', () => {
    it('renders the count', () => {
        render(<ParticipantCount count={4} />)
        expect(screen.getByText('4')).toBeTruthy()
    })

    it('exposes the count under the provided testID', () => {
        render(
            <ParticipantCount
                count={7}
                testID='participant_count_value'
            />,
        )
        expect(screen.getByTestId('participant_count_value')).toBeTruthy()
    })
})
