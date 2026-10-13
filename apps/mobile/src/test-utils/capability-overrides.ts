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
    ChainCapability,
    ChainId,
    ChainMode,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainMode,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import {
    chainOverridesKey,
    readCapabilityOverrides,
    useRemoteConfigStore,
} from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'

// The unit registry has no reader until the app's bootstrap runs, which only
// integration specs do; this installs the same layers so both resolve alike.
const installOverrideReader = (): void => {
    const { chains } = getProvider()
    chains.setCapabilityOverrides(() => ({
        ...readCapabilityOverrides(),
        chainMode: Object.fromEntries(
            chains
                .list()
                .map(({ id }) => [
                    id,
                    selectChainMode(useNetworkStore.getState(), id),
                ]),
        ) as Partial<Record<ChainId, ChainMode>>,
    }))
}

/**
 * Switches capabilities through the developer-override layer, the way the
 * Feature Flags screen does, so the real registry resolves them. Cleared by
 * `useRemoteConfigStore.getState().resetState()`.
 */
export const setCapabilityOverrides = (
    capabilities: Partial<Record<ChainCapability, boolean>>,
    chainId: ChainId = 'algorand',
): void => {
    installOverrideReader()
    useRemoteConfigStore
        .getState()
        .setConfigOverride(
            chainOverridesKey(chainId),
            JSON.stringify({ capabilities }),
        )
}
