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

import { useCallback } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    nameServiceOf,
    resolveVerifiedNameAddress,
} from '@perawallet/wallet-core-names'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'

export type LinkRecipientResolver = (params: {
    scope: ChainScope
    name: string
    parsedType: string
}) => Promise<Optional<string>>

/**
 * Resolves a link's recipient name to an address the chain itself confirms.
 * Anything else shows the deeplink error and returns `undefined`, so a link
 * never reaches send with a recipient that wasn't verified.
 */
export const useLinkRecipientResolver = (): LinkRecipientResolver => {
    const showError = useDeeplinkErrorHandler()

    return useCallback(
        async ({ scope, name, parsedType }) => {
            const resolution = await resolveVerifiedNameAddress({ name, scope })
            if (resolution.status === 'verified') return resolution.address

            if (resolution.status === 'not-found') {
                showError({
                    variant: 'name-not-found',
                    parsedType,
                    values: {
                        name,
                        chain: getChainDescriptor(scope.chainId).displayName,
                    },
                })
            } else {
                showError({
                    variant:
                        resolution.status === 'mismatch'
                            ? 'name-mismatch'
                            : 'name-unavailable',
                    service: nameServiceOf(scope),
                    parsedType,
                    values: { name },
                })
            }
            return undefined
        },
        [showError],
    )
}
