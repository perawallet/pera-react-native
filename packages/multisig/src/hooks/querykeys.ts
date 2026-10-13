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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const MODULE_PREFIX = 'multisig'

export const getMultisigAccountDetailQueryKey = (
    scope: ChainScope,
    address: string,
) => {
    return [MODULE_PREFIX, 'account-detail', { scope, address }]
}

export const getParticipantVerdictQueryKey = (
    scope: ChainScope,
    address: string,
) => {
    return [MODULE_PREFIX, 'participant-verdict', { scope, address }]
}

export const getSignRequestDetailQueryKey = (
    scope: ChainScope,
    signRequestId: string,
) => {
    return [MODULE_PREFIX, 'sign-request-detail', { scope, signRequestId }]
}

export const getSignRequestsWithSignaturesQueryKey = (
    scope: ChainScope,
    signRequestId: string,
) => {
    return [
        MODULE_PREFIX,
        'sign-request-with-signatures',
        { scope, signRequestId },
    ]
}
