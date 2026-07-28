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
import type WebView from 'react-native-webview'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { asBridgeWebview } from '@modules/webview/hooks/handlers.web'
import { sendBidaliEvent } from '../bidali-events.web'

const makeWebviewRef = () => {
    const posts: unknown[] = []
    const transport = { postToWebview: (data: unknown) => posts.push(data) }
    const ref = {
        current: asBridgeWebview(transport) as Nullable<WebView>,
    } as React.RefObject<Nullable<WebView>>
    return { ref, posts }
}

describe('bidali-events.web sendBidaliEvent', () => {
    it('posts the bidaliEvent envelope for paymentSent', () => {
        const { ref, posts } = makeWebviewRef()
        sendBidaliEvent(ref, 'paymentSent')
        expect(posts).toEqual([
            {
                jsonrpc: '2.0',
                method: 'bidaliEvent',
                params: { event: 'paymentSent' },
            },
        ])
    })

    it('posts the bidaliEvent envelope for paymentCancelled', () => {
        const { ref, posts } = makeWebviewRef()
        sendBidaliEvent(ref, 'paymentCancelled')
        expect(posts).toEqual([
            {
                jsonrpc: '2.0',
                method: 'bidaliEvent',
                params: { event: 'paymentCancelled' },
            },
        ])
    })

    it('does not throw and posts nothing when the ref is null', () => {
        const ref = {
            current: null,
        } as React.RefObject<Nullable<WebView>>
        expect(() => sendBidaliEvent(ref, 'paymentCancelled')).not.toThrow()
    })
})
