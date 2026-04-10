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

import type {
    HardwareWalletManufacturer,
    HardwareWalletTransportProvider,
} from './types'

/**
 * Registry for hardware wallet transport providers.
 * Each manufacturer registers exactly one provider. The signing pipeline
 * resolves the correct provider based on the account's manufacturer field.
 */
export type HardwareWalletRegistry = {
    /** Register a transport provider for a manufacturer. Replaces any existing provider for that manufacturer. */
    register: (provider: HardwareWalletTransportProvider) => void
    /** Look up the provider for a given manufacturer. Returns undefined if not registered. */
    getProvider: (
        manufacturer: HardwareWalletManufacturer,
    ) => HardwareWalletTransportProvider | undefined
    /** Return all registered providers. */
    getAllProviders: () => HardwareWalletTransportProvider[]
    /** Check if a provider is registered for a manufacturer. */
    hasProvider: (manufacturer: HardwareWalletManufacturer) => boolean
}

/**
 * Creates a new hardware wallet registry.
 * Typically created once during platform initialization and stored in PlatformServices.
 */
export const createHardwareWalletRegistry = (): HardwareWalletRegistry => {
    const providers = new Map<string, HardwareWalletTransportProvider>()

    return {
        register: (provider: HardwareWalletTransportProvider): void => {
            providers.set(provider.manufacturer, provider)
        },
        getProvider: (
            manufacturer: HardwareWalletManufacturer,
        ): HardwareWalletTransportProvider | undefined => {
            return providers.get(manufacturer)
        },
        getAllProviders: (): HardwareWalletTransportProvider[] => {
            return [...providers.values()]
        },
        hasProvider: (manufacturer: HardwareWalletManufacturer): boolean => {
            return providers.has(manufacturer)
        },
    }
}
