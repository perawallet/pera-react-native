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

import { useMemo } from 'react'
import type {
    ChainScope,
    SignInSummary,
} from '@perawallet/wallet-core-chain-contract'
import { chainNetworkOf } from '@perawallet/wallet-core-chain-shared'
import { formatDatetime, type Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'

export type SignInDetailRow = {
    label: string
    value: string
    testID: string
}

export type UseSignInMessageDetailsResult = {
    /** The rows above the network row. */
    leadingRows: SignInDetailRow[]
    /** The rows below the network row. */
    trailingRows: SignInDetailRow[]
    /** Set when the message names a chain the wallet doesn't know, so it can't be shown by name. */
    unknownChainRow: Optional<SignInDetailRow>
    otherAddressNote: Optional<string>
    otherChainNote: Optional<string>
}

const chainNameOf = (scope: ChainScope): string => {
    const { chain, network } = chainNetworkOf(scope)
    return scope.networkId === 'mainnet' ? chain : `${chain} ${network}`
}

const dateOf = (value: Optional<string>): Optional<string> =>
    value === undefined ? undefined : formatDatetime(new Date(value))

export const useSignInMessageDetails = (
    signIn: SignInSummary,
): UseSignInMessageDetailsResult => {
    const { t } = useLanguage()

    return useMemo(() => {
        const { message, messageScope, isOtherAddress, isOtherChain } = signIn
        const expiresAt = dateOf(message.expirationTime)
        const chainName = messageScope
            ? chainNameOf(messageScope)
            : `${t('signing.sign_in.chain_id')} ${message.chainId}`

        return {
            leadingRows: [
                {
                    label: t('signing.sign_in.domain'),
                    value: message.domain,
                    testID: 'sign_in_domain',
                },
                {
                    label: t('signing.sign_in.address'),
                    value: message.address,
                    testID: 'sign_in_address',
                },
                {
                    label: t('signing.sign_in.uri'),
                    value: message.uri,
                    testID: 'sign_in_uri',
                },
            ],
            trailingRows: [
                {
                    label: t('signing.sign_in.nonce'),
                    value: message.nonce ?? '',
                    testID: 'sign_in_nonce',
                },
                {
                    label: t('signing.sign_in.issued_at'),
                    value: dateOf(message.issuedAt) ?? '',
                    testID: 'sign_in_issued_at',
                },
                ...(expiresAt
                    ? [
                          {
                              label: t('signing.sign_in.expires_at'),
                              value: expiresAt,
                              testID: 'sign_in_expires_at',
                          },
                      ]
                    : []),
            ],
            unknownChainRow: messageScope
                ? undefined
                : {
                      label: t('signing.sign_in.chain_id'),
                      value: message.chainId,
                      testID: 'sign_in_chain_id',
                  },
            otherAddressNote: isOtherAddress
                ? t('signing.sign_in.other_address_note', {
                      address: message.address,
                  })
                : undefined,
            otherChainNote: isOtherChain
                ? t('signing.sign_in.other_chain_note', { chain: chainName })
                : undefined,
        }
    }, [signIn, t])
}
