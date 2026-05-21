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

import { describe, it, expect } from 'vitest'
import { render, screen } from '@test-utils/render'
import { MultisigInfoCard } from '../MultisigInfoCard'

describe('MultisigInfoCard', () => {
    it('shows the "You included" label when the user is a participant', () => {
        render(
            <MultisigInfoCard
                totalParticipants={3}
                threshold={2}
                isUserIncluded
            />,
        )

        expect(screen.getByText('multisig.info_card.you_included')).toBeTruthy()
    })

    it('hides the "You included" label when the user is not a participant', () => {
        render(
            <MultisigInfoCard
                totalParticipants={3}
                threshold={2}
                isUserIncluded={false}
            />,
        )

        expect(screen.queryByText('multisig.info_card.you_included')).toBeNull()
    })
})
