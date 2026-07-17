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

// @vitest-environment-options {"resources": "usable"}
// jsdom needs `resources: "usable"` to actually navigate an iframe's `src`
// (the default leaves it inert, so `sandbox`/`src` attribute assertions pass
// even if the frame renders nothing). Isolated in its own file — with the
// option enabled file-wide, a real `https://` src (used by the sibling spec)
// would trigger genuine network fetches; this file only ever loads a local
// `data:` URI, so no network I/O happens.
import { describe, it, expect } from 'vitest'
import { render } from '@test-utils/render'
import { PWStaticWebView } from '../PWStaticWebView.web'

describe('PWStaticWebView (web) — remote uri actually renders', () => {
    it('loads content for the remote uri branch, proving the frame is not blank', async () => {
        const html = '<p>remote terms</p>'
        const dataUri = `data:text/html,${encodeURIComponent(html)}`
        const { container } = render(
            <PWStaticWebView source={{ uri: dataUri }} />,
        )

        const iframe = container.querySelector('iframe') as HTMLIFrameElement
        expect(iframe).not.toBeNull()

        await new Promise<void>((resolve, reject) => {
            iframe.addEventListener('load', () => resolve(), { once: true })
            iframe.addEventListener(
                'error',
                () => reject(new Error('iframe failed to load')),
                { once: true },
            )
        })

        expect(iframe.contentDocument?.body.textContent).toBe('remote terms')
    })
})
