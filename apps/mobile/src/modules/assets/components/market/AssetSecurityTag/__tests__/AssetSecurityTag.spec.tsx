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

import { describe, it, expect } from 'vitest'
import { render, screen } from '@test-utils/render'
import { AssetSecurityTag } from '../AssetSecurityTag'

describe('AssetSecurityTag', () => {
    it('renders the provided label', () => {
        render(
            <AssetSecurityTag
                iconName='snowflake'
                label='No Freeze'
                variant='neutral'
            />,
        )

        expect(screen.getByText('No Freeze')).toBeTruthy()
    })

    it('renders in the warning variant without crashing', () => {
        render(
            <AssetSecurityTag
                iconName='snowflake'
                label='Freeze'
                variant='warning'
                testID='freeze-tag'
            />,
        )

        expect(screen.getByText('Freeze')).toBeTruthy()
    })
})
