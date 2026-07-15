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
import { exportCardStatement } from '../api/transactions'
import type {
    CardStatement,
    CardTransactionFilters,
    StatementFormat,
} from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

export type ExportStatementVariables = {
    format: StatementFormat
    filters?: CardTransactionFilters
}

export type UseExportCardStatementMutationResult = CardMutationResult<
    ExportStatementVariables,
    CardStatement
>

export const useExportCardStatementMutation =
    (): UseExportCardStatementMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            CardStatement,
            Error,
            ExportStatementVariables
        >({
            mutationFn: ({ format, filters }) =>
                exportCardStatement({ network, format, filters }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
