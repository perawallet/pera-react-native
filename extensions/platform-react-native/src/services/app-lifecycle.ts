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

import { AppState } from 'react-native'
import type {
    AppLifecycleListener,
    AppLifecycleService,
    AppLifecycleState,
} from '@perawallet/wallet-extension-platform'

export class RNAppLifecycleService implements AppLifecycleService {
    getCurrentState(): AppLifecycleState {
        // RN's strict types widen this to `string | null | undefined`; the runtime
        // only reports AppStateStatus values, and null before the first native report.
        return (AppState.currentState ?? 'unknown') as AppLifecycleState
    }

    addChangeListener(listener: AppLifecycleListener): () => void {
        const subscription = AppState.addEventListener('change', listener)
        return () => subscription.remove()
    }
}
