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

import { describe, expect, it } from 'vitest'
import { PWText } from '@components/core'
import { render, screen, within } from '@test-utils/render'
import { AvatarBadge } from '../AvatarBadge'

describe('AvatarBadge', () => {
    it('holds the content it is given inside the badge', () => {
        render(
            <AvatarBadge>
                <PWText>7</PWText>
            </AvatarBadge>,
        )

        expect(
            within(screen.getByTestId('avatar_badge')).getByText('7'),
        ).toBeTruthy()
    })
})
