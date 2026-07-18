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

import { initializeApp, type FirebaseApp } from 'firebase/app'
import { config } from '@perawallet/wallet-core-config'

let app: FirebaseApp | null = null

/**
 * Lazily initializes the Firebase Web App exactly once per extension UI
 * context (popup/expanded/approval each get their own JS realm, so this
 * cache is per-context, not global). Returns null when firebaseProjectId is
 * unset (community/unregistered builds) so callers degrade to static
 * defaults instead of throwing.
 */
export const getFirebaseApp = (): FirebaseApp | null => {
    if (!config.firebaseProjectId) {
        return null
    }
    app ??= initializeApp({
        apiKey: config.firebaseApiKey,
        authDomain: config.firebaseAuthDomain,
        databaseURL: config.firebaseDatabaseUrl,
        projectId: config.firebaseProjectId,
        storageBucket: config.firebaseStorageBucket,
        messagingSenderId: config.firebaseMessagingSenderId,
        appId: config.firebaseAppId,
        measurementId: config.firebaseMeasurementId,
    })
    return app
}
