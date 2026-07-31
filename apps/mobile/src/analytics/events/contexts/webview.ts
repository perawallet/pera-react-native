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

import type { AnalyticsMetadataKey as Key } from '../metadata-keys'

/** In-app browser (Discover / dApp webview) bridge observability. */
export enum WebviewEvent {
    BridgeMethodNotFound = 'webview_bridge_method_not_found', // Page called a method outside the v3 bridge contract (method name, source url)
}

export interface WebviewRequiredPayloads {
    [WebviewEvent.BridgeMethodNotFound]: {
        [Key.WebviewBridgeMethod]: string
        [Key.Url]?: string
    }
}
