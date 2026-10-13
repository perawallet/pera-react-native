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

// The store-migration suite drives the real persisted accounts store, so the
// barrel carries it instead of the stub vitest.setup.ts installs: app code
// that reaches the store through the barrel must see the same instance the
// suite rehydrates.
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await (
        await import('./src/harness/accountsBarrel')
    ).hookFreeAccountsModules()),
    ...(await vi.importActual<object>(
        '@perawallet/wallet-core-accounts/store',
    )),
}))
