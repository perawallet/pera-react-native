/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { Optional } from '@perawallet/wallet-core-shared'
import type {
    HardwareWalletManufacturer,
    HardwareWalletTransportProvider,
    LedgerTransportType,
} from './types'

/**
 * Registry for hardware wallet transport providers.
 * Each (manufacturer, transportType) pair registers exactly one provider.
 * The signing pipeline resolves the correct provider based on the account's
 * manufacturer + transportType fields.
 */
export type HardwareWalletRegistry = {
    /** Register a transport provider. Replaces any existing provider for the same (manufacturer, transportType). */
    register: (provider: HardwareWalletTransportProvider) => void
    /** Look up the provider for a given (manufacturer, transportType). Returns undefined if not registered. */
    getProvider: (
        manufacturer: HardwareWalletManufacturer,
        transportType: LedgerTransportType,
    ) => Optional<HardwareWalletTransportProvider>
    /** Return all registered providers. */
    getAllProviders: () => HardwareWalletTransportProvider[]
    /** Return all providers registered for a given manufacturer (across transports). */
    getProvidersByManufacturer: (
        manufacturer: HardwareWalletManufacturer,
    ) => HardwareWalletTransportProvider[]
    /** Check if a provider is registered for a (manufacturer, transportType). */
    hasProvider: (
        manufacturer: HardwareWalletManufacturer,
        transportType: LedgerTransportType,
    ) => boolean
}

const buildKey = (
    manufacturer: HardwareWalletManufacturer,
    transportType: LedgerTransportType,
): string => `${manufacturer}:${transportType}`

/**
 * Creates a new hardware wallet registry.
 * Typically created once during platform initialization and stored in PlatformServices.
 */
export const createHardwareWalletRegistry = (): HardwareWalletRegistry => {
    const providers = new Map<string, HardwareWalletTransportProvider>()

    return {
        register: (provider: HardwareWalletTransportProvider): void => {
            providers.set(
                buildKey(provider.manufacturer, provider.transportType),
                provider,
            )
        },
        getProvider: (manufacturer, transportType) =>
            providers.get(buildKey(manufacturer, transportType)),
        getAllProviders: () => [...providers.values()],
        getProvidersByManufacturer: manufacturer =>
            [...providers.values()].filter(
                p => p.manufacturer === manufacturer,
            ),
        hasProvider: (manufacturer, transportType) =>
            providers.has(buildKey(manufacturer, transportType)),
    }
}
