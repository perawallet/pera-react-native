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

// Text encoding polyfill (some deps expect TextEncoder/TextDecoder globals)
import 'fast-text-encoding'

// xhd-wallet-api and KMS BIP39 derivation call bare `Buffer` at runtime.
// Native gets it from quick-crypto's install(); web never sets it without this.
import { Buffer } from 'buffer'
if (globalThis.Buffer === undefined) {
    globalThis.Buffer = Buffer
}

import { registerRootComponent } from 'expo'
import { App } from './src/App.web'

registerRootComponent(App)
