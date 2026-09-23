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

import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@test-utils/render'
import { IntegrityCheckFrameHost } from '../IntegrityCheckFrameHost.web'

const CHECK_URL =
    'https://integrity-staging.perawallet.app/check?v=1&kid=k&peraCheckToken=t'

const mockFrame = vi.hoisted(() => ({
    url: null as string | null,
    isExpanded: false,
}))
const iframeRef = createRef<HTMLIFrameElement>()

vi.mock('../useIntegrityCheckFrameHost.web', () => ({
    useIntegrityCheckFrameHost: () => ({ ...mockFrame, iframeRef }),
}))

describe('IntegrityCheckFrameHost', () => {
    it('sandboxes the frame without letting it navigate the wallet page', () => {
        mockFrame.url = CHECK_URL
        mockFrame.isExpanded = false
        const { unmount } = render(<IntegrityCheckFrameHost />)

        const sandbox = document
            .querySelector('iframe')
            ?.getAttribute('sandbox')

        expect(sandbox).toBe(
            'allow-same-origin allow-scripts allow-forms allow-popups',
        )
        unmount()
    })

    it('keeps the hidden frame out of reach and presents the expanded one as a modal dialog', () => {
        mockFrame.url = CHECK_URL
        mockFrame.isExpanded = false
        const { rerender, unmount } = render(<IntegrityCheckFrameHost />)
        const frame = document.querySelector('iframe')

        expect(frame?.hasAttribute('inert')).toBe(true)
        expect(document.querySelector('[role="dialog"]')).toBeNull()

        mockFrame.isExpanded = true
        rerender(<IntegrityCheckFrameHost />)

        expect(frame?.hasAttribute('inert')).toBe(false)
        const dialog = document.querySelector('[role="dialog"]')
        expect(dialog?.getAttribute('aria-modal')).toBe('true')
        expect(dialog?.contains(frame ?? null)).toBe(true)
        unmount()
    })

    it('renders nothing while there is no check to host', () => {
        mockFrame.url = null

        render(<IntegrityCheckFrameHost />)

        expect(document.querySelector('iframe')).toBeNull()
    })

    it('keeps the same frame mounted when it expands, so a solve in progress survives', () => {
        mockFrame.url = CHECK_URL
        mockFrame.isExpanded = false
        const { rerender, unmount } = render(<IntegrityCheckFrameHost />)
        const hiddenFrame = document.querySelector('iframe')

        mockFrame.isExpanded = true
        rerender(<IntegrityCheckFrameHost />)

        expect(hiddenFrame?.getAttribute('src')).toBe(CHECK_URL)
        expect(hiddenFrame?.getAttribute('title')).toBe(
            'integrityCheck.frame_title',
        )
        expect(document.querySelector('iframe')).toBe(hiddenFrame)
        expect(iframeRef.current).toBe(hiddenFrame)
        unmount()
    })
})
