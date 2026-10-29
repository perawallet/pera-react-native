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

import React from 'react'
import './i18n'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import {
    parseTypedJson,
    stringifyTypedJson,
} from '@perawallet/wallet-core-shared'
import {
    getProvider,
    PeraWalletProvider,
} from '@perawallet/wallet-extension-provider'
import { AppShellContent } from './app-root/AppShellContent'

// Platform hydration is complete before this module evaluates (App.web.tsx
// ensures this), so getProvider() is safe to call at module scope here. The
// rest of the post-hydration setup is bootstrap/preReact.web.ts.
const persister = createAsyncStoragePersister({
    storage: getProvider().keyValueStorage,
    serialize: stringifyTypedJson,
    deserialize: parseTypedJson,
})

export const AppShell = (): React.JSX.Element => (
    <PeraWalletProvider>
        <AppShellContent persister={persister} />
    </PeraWalletProvider>
)
