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

type ChainOverrides = {
    enabled?: boolean
    capabilities?: Partial<Record<ChainCapability, boolean>>
}

/**
 * Writes a chain's whole `chain_<id>_overrides` developer override, the way the
 * Feature Flags screen does, so the real registry resolves it. The kill switch
 * and capabilities share that key: use this to set both at once. Cleared by
 * `useRemoteConfigStore.getState().resetState()`.
 */
export const setChainOverrides = (
    chainId: ChainId,
    overrides: ChainOverrides,
): void => {
    installOverrideReader()
    useRemoteConfigStore
        .getState()
        .setConfigOverride(
            chainOverridesKey(chainId),
            JSON.stringify(overrides),
        )
}

/**
 * Replaces the chain's whole override, so it also turns a kill switch set by
 * `setChainEnabled` back on; pass both to `setChainOverrides` to keep it.
 */
export const setCapabilityOverrides = (
    capabilities: Partial<Record<ChainCapability, boolean>>,
    chainId: ChainId = 'algorand',
): void => setChainOverrides(chainId, { capabilities })

/**
 * Replaces the chain's whole override, so it also drops capabilities set by
 * `setCapabilityOverrides`; pass both to `setChainOverrides` to keep them.
 */
export const setChainEnabled = (chainId: ChainId, isEnabled: boolean): void =>
    setChainOverrides(chainId, { enabled: isEnabled })
