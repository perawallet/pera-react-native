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

import { useQuery } from '@tanstack/react-query'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { cardQueryKeys } from './querykeys'

export type UseWalletProvisioningAvailabilityQueryOptions = {
    enabled?: boolean
}

/**
 * Whether this build + device can push provision the card into the OS wallet.
 * `data` stays false until the Apple entitlement / Google TapAndPay
 * allowlisting exist — the platform service never rejects, it reports false.
 */
export const useWalletProvisioningAvailabilityQuery = (
    options?: UseWalletProvisioningAvailabilityQueryOptions,
) =>
    useQuery({
        queryKey: cardQueryKeys.walletProvisioningAvailability,
        queryFn: () =>
            getProvider().walletProvisioning.checkWalletAvailability(),
        enabled: options?.enabled ?? true,
        // Availability flips with build entitlements/allowlisting, not at
        // runtime — one check per session is enough.
        staleTime: Infinity,
        retry: false,
    })
