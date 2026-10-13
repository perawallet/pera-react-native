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
    AuthDataPayload,
    BuildSiwxAuthDataArgs,
    SiwxMessage,
} from '@perawallet/wallet-core-signing'
import { ARC60_SCOPE_AUTH } from './arc60'
import { buildSiwaAuthRequest, type Siwa } from './siwa'

/** Maps SIWA's wire keys onto the chain-agnostic model; absent optionals stay unset. */
export const toSiwxMessage = (siwa: Siwa): SiwxMessage => ({
    domain: siwa.domain,
    address: siwa.account_address,
    uri: siwa.uri,
    version: siwa.version,
    chainId: siwa.chain_id,
    ...(siwa.statement !== undefined ? { statement: siwa.statement } : {}),
    ...(siwa.nonce !== undefined ? { nonce: siwa.nonce } : {}),
    ...(siwa['issued-at'] !== undefined ? { issuedAt: siwa['issued-at'] } : {}),
    ...(siwa['expiration-time'] !== undefined
        ? { expirationTime: siwa['expiration-time'] }
        : {}),
    ...(siwa['not-before'] !== undefined
        ? { notBefore: siwa['not-before'] }
        : {}),
    ...(siwa['request-id'] !== undefined
        ? { requestId: siwa['request-id'] }
        : {}),
    ...(siwa.resources !== undefined ? { resources: siwa.resources } : {}),
})

export const buildSiwxAuthData = (
    args: BuildSiwxAuthDataArgs,
): AuthDataPayload => {
    const { data, authenticatorData } = buildSiwaAuthRequest({
        ...args,
        accountAddress: args.address,
    })
    return {
        authData: {
            data,
            signer: args.address,
            domain: args.domain,
            authenticatorData,
        },
        metadata: { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
    }
}
