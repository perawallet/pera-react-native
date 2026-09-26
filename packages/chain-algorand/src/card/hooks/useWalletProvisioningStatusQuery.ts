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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { cardQueryKeys } from './querykeys'

export type UseWalletProvisioningStatusQueryOptions = {
    enabled?: boolean
}

/**
 * State of the card (by PAN suffix) inside the OS wallet — `'active'` means
 * it is already provisioned and the add entry point must be hidden (a Google
 * certification requirement). `'not found'` covers every can't-know case.
 */
export const useWalletProvisioningStatusQuery = (
    panLast4: Nullable<string>,
    options?: UseWalletProvisioningStatusQueryOptions,
) =>
    useQuery({
        queryKey: cardQueryKeys.walletProvisioningStatus(panLast4),
        queryFn: () =>
            getProvider().walletProvisioning.getCardStatusBySuffix(
                panLast4 ?? '',
            ),
        enabled: (options?.enabled ?? true) && panLast4 != null,
        retry: false,
    })
