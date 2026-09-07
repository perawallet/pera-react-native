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

import type { ReactNativeKeyStore } from '@algorandfoundation/react-native-keystore'

export type ResealReport = {
    resealed: number
    reminted: number
    /** Ids that open under neither key — never their contents. */
    unrecoverable: string[]
    legacyKeyRemoved: boolean
}

export type ResealDeps = {
    keystore: Pick<ReactNativeKeyStore, 'export' | 'import'>
    resolveEngineKey: () => Promise<CryptoKey>
    subtle: SubtleCrypto
    indexedDB: IDBFactory
    databaseName: string
}
