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
import { describe, it, expect, vi } from 'vitest'
import { Arc60SigningView } from '../Arc60SigningView'
import { Arc60SignRequest } from '@perawallet/wallet-core-blockchain'

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...actual,
        useSigningRequest: vi.fn(() => ({
            removeSignRequest: vi.fn(),
        })),
    }
})

describe('Arc60SigningView', () => {
    const mockRequest = {
        type: 'arc60',
        transport: 'callback',
        reject: vi.fn(),
    } as unknown as Arc60SignRequest

    it('renders not implemented message', () => {
        const { container } = render(<Arc60SigningView request={mockRequest} />)
        // Check for 'not implemented' OR use the translation key 'common.not_implemented.title'
        // Since we mock i18n to return keys, we might need to check for keys or default content
        expect(container.textContent?.toLowerCase()).toMatch(
            /not implemented|common\.not_implemented/,
        )
    })
})
