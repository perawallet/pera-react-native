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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { prepareTransactions } from '../api'
import type { PrepareTransactionsRequest } from '../api'

export const usePrepareTransactionsMutation = () => {
    const { network } = useNetwork()

    return useMutation({
        // OFF-004: fail fast offline before building/quoting a swap, so the
        // caller surfaces a readable error instead of the mutation pausing and
        // silently auto-resuming against a stale quote on reconnect.
        mutationFn: (data: PrepareTransactionsRequest) => {
            assertOnline()
            return prepareTransactions(data, network)
        },
        // Surfacing is handled by the caller — see `mutationDefaults`.
        throwOnError: false,
    })
}
