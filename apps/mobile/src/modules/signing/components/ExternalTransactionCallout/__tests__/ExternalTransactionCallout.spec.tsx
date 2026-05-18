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

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@test-utils/render'
import en from '@/i18n/locales/en.json'
import { ExternalTransactionCallout } from '../ExternalTransactionCallout'

const resolveKey = (key: string): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = en
    for (const part of parts) {
        node = node?.[part]
    }
    return typeof node === 'string' ? node : key
}

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: resolveKey }),
}))

describe('ExternalTransactionCallout', () => {
    it('renders title and body from i18n', () => {
        render(<ExternalTransactionCallout />)
        expect(screen.getByText('Other signer')).toBeTruthy()
        expect(
            screen.getByText(
                "This transaction has already been signed or will be signed by another party. It's shown here only for completeness.",
            ),
        ).toBeTruthy()
    })
})
