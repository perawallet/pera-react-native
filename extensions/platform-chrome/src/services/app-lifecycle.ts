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

import type {
    AppLifecycleListener,
    AppLifecycleService,
    AppLifecycleState,
} from '@perawallet/wallet-extension-platform'

// Mirrors react-native-web's AppState, which the rest of the web bundle still
// sees: a context without a document (the service worker) reads as
// permanently active and never emits.
const isAvailable = (): boolean =>
    typeof document !== 'undefined' && Boolean(document.visibilityState)

// `prerender` and `unloaded` are legacy values react-native-web still maps.
const BACKGROUND_VISIBILITY_STATES = new Set([
    'hidden',
    'prerender',
    'unloaded',
])

const readState = (): AppLifecycleState => {
    if (!isAvailable()) return 'active'
    return BACKGROUND_VISIBILITY_STATES.has(document.visibilityState)
        ? 'background'
        : 'active'
}

export class ChromeAppLifecycleService implements AppLifecycleService {
    private readonly listeners = new Set<AppLifecycleListener>()
    private isBound = false

    getCurrentState(): AppLifecycleState {
        return readState()
    }

    addChangeListener(listener: AppLifecycleListener): () => void {
        if (!isAvailable()) return () => {}
        if (!this.isBound) {
            this.isBound = true
            document.addEventListener('visibilitychange', () => {
                const state = readState()
                for (const entry of [...this.listeners]) entry(state)
            })
        }
        const entry: AppLifecycleListener = state => listener(state)
        this.listeners.add(entry)
        return () => {
            this.listeners.delete(entry)
        }
    }
}
