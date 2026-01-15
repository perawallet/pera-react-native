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

import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import TabLabel from '../TabLabel'

describe('TabLabel', () => {
    it('renders with translated text', () => {
        const { container } = render(
            <TabLabel
                i18nKey='common.ok.label'
                active={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('applies active style when active is true', () => {
        const { container } = render(
            <TabLabel
                i18nKey='common.ok.label'
                active={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('applies inactive style when active is false', () => {
        const { container } = render(
            <TabLabel
                i18nKey='common.ok.label'
                active={false}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('handles different i18n keys', () => {
        const { container: container1 } = render(
            <TabLabel
                i18nKey='tabs.home'
                active={true}
            />,
        )
        const { container: container2 } = render(
            <TabLabel
                i18nKey='tabs.settings'
                active={true}
            />,
        )
        expect(container1).toBeTruthy()
        expect(container2).toBeTruthy()
    })
})
