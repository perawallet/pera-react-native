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

import { vi } from 'vitest'

// The blockchain barrel reaches the platform provider, whose storage is a
// native module that the test runtime cannot load.
const store = new Map<string, string>()

const keyValueStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
        store.delete(key)
    },
}

vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: () => ({ keyValueStorage }),
    getPlatformServices: () => ({ keyValueStorage }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ keyValueStorage }),
}))

// The signing dist is minified, which mangles the `constructor.name` its
// errors take their `name` from; name-matching specs must see the source classes.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<object>()),
    ...(await import('../signing/src/pipeline/errors')),
}))
