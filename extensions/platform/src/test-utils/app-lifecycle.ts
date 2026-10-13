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
} from '../app-lifecycle'

/** In-memory lifecycle a test drives with `setState`. */
export class MemoryAppLifecycleService implements AppLifecycleService {
    private state: AppLifecycleState
    private readonly listeners = new Set<AppLifecycleListener>()

    constructor(initialState: AppLifecycleState = 'active') {
        this.state = initialState
    }

    getCurrentState(): AppLifecycleState {
        return this.state
    }

    addChangeListener(listener: AppLifecycleListener): () => void {
        // Wrapped so the same function subscribed twice gets two independent
        // subscriptions, as RN's emitter does.
        const entry: AppLifecycleListener = next => listener(next)
        this.listeners.add(entry)
        return () => {
            this.listeners.delete(entry)
        }
    }

    setState(next: AppLifecycleState): void {
        this.state = next
        for (const listener of [...this.listeners]) listener(next)
    }

    get listenerCount(): number {
        return this.listeners.size
    }
}
