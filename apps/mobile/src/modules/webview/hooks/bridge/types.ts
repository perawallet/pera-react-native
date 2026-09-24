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

import type { WebviewMessageSecurity } from '../handlers'

export type WebviewMessage = {
    id: string
    jsonrpc: '2.0'
    method: string
    params?: Record<string, unknown>
    // Stamped by the main-frame-only injected bridge; validated at the
    // PWWebView message boundary, ignored by handler dispatch.
    token?: string
}

export type BridgeHandler = (
    message: WebviewMessage,
    security: WebviewMessageSecurity,
) => void

export type BridgeRoute = {
    handle: BridgeHandler
    /**
     * Runs only while the message's frame is the trusted Discover origin;
     * anything else is answered `-32001` before the handler sees it.
     */
    requiresTrustedOrigin: boolean
}
