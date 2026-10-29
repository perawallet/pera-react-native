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

import {
    AppError,
    type NodeErrorCopy,
    type NodeErrorsAdapter,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { AlgodError } from './AlgodError'
import { ALGOD_ERROR_MESSAGE_KEYS, AlgodErrorCode } from './algodErrorCodes'
import { toAlgodError } from './toAlgodError'

const copyFor = (error: AlgodError): NodeErrorCopy => ({
    ...ALGOD_ERROR_MESSAGE_KEYS[error.code],
    params: error.params,
})

/**
 * An `AlgodError` of any code gets its copy. A plain `Error` goes through
 * `toAlgodError` and only counts when it was recognised, so the caller's own
 * copy wins over `unknown_node_error`. Any other `AppError` already carries
 * its own copy.
 */
export const describeAlgodError = (error: unknown): Optional<NodeErrorCopy> => {
    if (error instanceof AlgodError) return copyFor(error)
    if (error instanceof AppError || !(error instanceof Error)) {
        return undefined
    }
    const algodError = toAlgodError(error)
    return algodError.code === AlgodErrorCode.UNKNOWN_NODE_ERROR
        ? undefined
        : copyFor(algodError)
}

export const algorandNodeErrors: NodeErrorsAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    describeError: describeAlgodError,
}
