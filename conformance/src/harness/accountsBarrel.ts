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

/**
 * The accounts barrel's hook-free modules, loaded for real, for a setup file's
 * `vi.mock('@perawallet/wallet-core-accounts')`. The app's own signer
 * (`signTransactionsWithLocalKey`) imports the barrel for its account-type
 * guards, and the barrel drags every accounts hook (multisig, staking,
 * currencies) along with them — none of which is reachable from a Node suite.
 *
 * Deliberately NOT the whole barrel: `./hooks`, `./db`, `./sync`, `./store`,
 * `./account-discovery`, `./cleanup`, `./import-session` and
 * `./device-accounts` are absent, so a suite that starts importing one of
 * those from the barrel gets `undefined` at use rather than an import error.
 * Add the module here when that happens — do not reach for `importActual` of
 * the barrel itself, which is the graph this exists to avoid. Each setup file
 * decides the store: vitest.setup.ts stubs it, the store-migration project's
 * setup loads it for real.
 */
export const hookFreeAccountsModules = async (): Promise<object> => {
    const [
        models,
        utils,
        signerResolution,
        constants,
        errors,
        bip44,
        chainAdapter,
        credentialScheme,
        accessors,
        accountChainState,
    ] = await Promise.all([
        vi.importActual<object>('@perawallet/wallet-core-accounts/models'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/utils'),
        vi.importActual<object>(
            '@perawallet/wallet-core-accounts/signer-resolution',
        ),
        vi.importActual<object>('@perawallet/wallet-core-accounts/constants'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/errors'),
        vi.importActual<object>('@perawallet/wallet-core-accounts/bip44'),
        vi.importActual<object>(
            '@perawallet/wallet-core-accounts/chain-adapter',
        ),
        vi.importActual<object>(
            '@perawallet/wallet-core-accounts/credentials/credentialScheme',
        ),
        vi.importActual<object>(
            '@perawallet/wallet-core-accounts/credentials/accessors',
        ),
        vi.importActual<object>(
            '@perawallet/wallet-core-accounts/store/accountChainState',
        ),
    ])
    return {
        ...models,
        ...utils,
        ...signerResolution,
        ...constants,
        ...errors,
        ...bip44,
        ...chainAdapter,
        ...credentialScheme,
        ...accessors,
        ...accountChainState,
    }
}
