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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { render, screen } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
// Initialise i18n so t() resolves real strings in this test's module graph.
import '../../../i18n'
import { TabLabel } from '../TabLabel'

describe('TabLabel', () => {
    it('renders the translated label', () => {
        render(
            <TabLabel
                labelKey={i18nKey('common.ok.label')}
                active={true}
            />,
        )

        expect(screen.getByText('Ok')).toBeTruthy()
    })
})
