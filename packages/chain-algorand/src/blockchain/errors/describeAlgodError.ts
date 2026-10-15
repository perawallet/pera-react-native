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

import { AppError, type NodeErrorCopy } from '@perawallet/wallet-core-shared'
import { AlgodError } from './AlgodError'
import { AlgodErrorCode } from './algodErrorCodes'
import { toAlgodError } from './toAlgodError'

// Offline shares one copy across algod and the Pera backend.
const NO_CONNECTION_KEYS = [
    'errors.network.no_connection.title',
    'errors.network.no_connection.body',
] as const

const copyFor = (error: AlgodError): NodeErrorCopy => {
    if (error.code === AlgodErrorCode.NETWORK_UNAVAILABLE) {
        const [titleKey, bodyKey] = NO_CONNECTION_KEYS
        return { titleKey, bodyKey, params: {} }
    }
    return {
        titleKey: `errors.algod.${error.code}.title`,
        bodyKey: `errors.algod.${error.code}.body`,
        params: error.params,
    }
}

/**
 * An `AlgodError` of any code gets its copy. A plain `Error` goes through
 * `toAlgodError` and only counts when it was recognised, so the caller's own
 * copy wins over `unknown_node_error`. Any other `AppError` already carries
 * its own copy.
 */
export const describeAlgodError = (
    error: unknown,
): NodeErrorCopy | undefined => {
    if (error instanceof AlgodError) return copyFor(error)
    if (error instanceof AppError || !(error instanceof Error)) {
        return undefined
    }
    const algodError = toAlgodError(error)
    return algodError.code === AlgodErrorCode.UNKNOWN_NODE_ERROR
        ? undefined
        : copyFor(algodError)
}

/** Every key `describeAlgodError` can return, for the module's `i18nKeys()`. */
export const ALGOD_ERROR_I18N_KEYS: readonly string[] = [
    ...NO_CONNECTION_KEYS,
    ...Object.values(AlgodErrorCode)
        .filter(code => code !== AlgodErrorCode.NETWORK_UNAVAILABLE)
        .flatMap(code => [
            `errors.algod.${code}.title`,
            `errors.algod.${code}.body`,
        ]),
]
