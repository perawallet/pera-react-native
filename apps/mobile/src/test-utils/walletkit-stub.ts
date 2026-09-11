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

// In-memory replacement for `@reown/walletkit` and `@walletconnect/core`, the
// v2 counterpart of `walletconnect-client-stub.ts`. Aliased in via
// vitest.config.ts, so every consumer gets it — which matters beyond the v2
// suites: `useConnectionsProvider` registers the v2 handler, so without this
// every mobile test that mounts `ConnectionsProvider` would build a real
// WalletKit and dial the Reown relay.
//
// The fake is the package's own, typed against the slice of `IWalletKit` the
// handler uses, so the contract these suites drive is the one the v2 specs
// check.

import type { Optional } from '@perawallet/wallet-core-shared'
import {
    createFakeWalletKit,
    type FakeWalletKit,
} from '@packages/walletconnect/src/v2/__tests__/fakeWalletKit'
import type { WalletConnectV2Storage } from '@packages/walletconnect/src/v2/storage'

export type { FakeWalletKit }

export const walletKitStub = {
    instances: [] as FakeWalletKit[],
    /** The storage the handler handed `Core`, so a test can assert on MMKV. */
    storages: [] as Optional<WalletConnectV2Storage>[],
    /** Reset between tests. */
    reset(): void {
        this.instances.length = 0
        this.storages.length = 0
    },
    /** Most recent client the handler initialised — usually what a test wants. */
    last(): Optional<FakeWalletKit> {
        return this.instances[this.instances.length - 1]
    },
}

/** Mirrors `@walletconnect/core`'s named export; nothing here connects. */
export class Core {
    projectId: Optional<string>
    storage: Optional<WalletConnectV2Storage>

    constructor(options: {
        projectId?: string
        storage?: WalletConnectV2Storage
    }) {
        this.projectId = options.projectId
        this.storage = options.storage
        walletKitStub.storages.push(options.storage)
    }
}

// The handler reads `.expired` off this rather than spelling the name out, so
// the value only has to agree with the fake's own expirer.
export const EXPIRER_EVENTS = { expired: 'expirer_expired' }

/** Mirrors `@reown/walletkit`'s named export. */
export const WalletKit = {
    init: async (): Promise<FakeWalletKit> => {
        const fake = createFakeWalletKit()
        walletKitStub.instances.push(fake)
        return fake
    },
}
