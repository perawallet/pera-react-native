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
    /** One per resource the message lists, in message order. */
    resourceRows: SignInDetailRow[]
    /** Set when signing also delegates capabilities to the site. */
    grantsWarning: Optional<{ body: string; rows: SignInDetailRow[] }>
    /** Set when the message strays from the sign-in format, so the site may read it differently. */
    malformedWarning: Optional<string>
    otherAddressNote: Optional<string>
    otherChainNote: Optional<string>
}

const MAX_URI_LENGTH = 40
const URI_TAIL_LENGTH = 8
const PATH_START = /^(?:$|[/?#])/

// The host as a WHATWG parser reads it, or undefined when the text could show
// another one: userinfo, backslashes or anything else between it and the path.
const authorityOf = (uri: string): Optional<string> => {
    let url: URL
    try {
        url = new URL(uri)
    } catch {
        return undefined
    }
    if (!url.host || url.username || url.password) return undefined
    const head = `${url.protocol}//${url.host}`
    const isVerbatim =
        uri.slice(0, head.length).toLowerCase() === head &&
        PATH_START.test(uri.slice(head.length))
    return isVerbatim ? uri.slice(0, head.length) : undefined
}

// Only the path, query or fragment is elided; a URI whose host can't be read
// unambiguously is shown whole.
export const shortenUri = (uri: string): string => {
    if (uri.length <= MAX_URI_LENGTH) return uri
    const head = authorityOf(uri)
    if (head === undefined) return uri
    const kept = Math.max(head.length, MAX_URI_LENGTH - URI_TAIL_LENGTH)
    if (kept >= uri.length - URI_TAIL_LENGTH) return uri
    return `${uri.slice(0, kept)}…${uri.slice(-URI_TAIL_LENGTH)}`
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
        const optionalRows: Array<Optional<SignInDetailRow>> = [
            message.expirationTime === undefined
                ? undefined
                : {
                      label: t('signing.sign_in.expires_at'),
                      value: dateOf(message.expirationTime) ?? '',
                      testID: 'sign_in_expires_at',
                  },
            message.notBefore === undefined
                ? undefined
                : {
                      label: t('signing.sign_in.not_before'),
                      value: dateOf(message.notBefore) ?? '',
                      testID: 'sign_in_not_before',
                  },
            message.requestId === undefined
                ? undefined
                : {
                      label: t('signing.sign_in.request_id'),
                      value: message.requestId,
                      testID: 'sign_in_request_id',
                  },
        ]
        const hasGrants = signIn.grants.length > 0 || signIn.hasUnreadableGrants
        const chainName = messageScope
            ? chainNameOf(messageScope)
            : `${t('signing.sign_in.chain_id')} ${message.chainId}`

        return {
            leadingRows: [
                {
                    label: t('signing.sign_in.domain'),
                    // Shown so a plaintext `http://` origin doesn't read as a normal site.
                    value: message.scheme
                        ? `${message.scheme}://${message.domain}`
                        : message.domain,
                    testID: 'sign_in_domain',
                },
                {
                    label: t('signing.sign_in.address'),
                    value: message.address,
                    testID: 'sign_in_address',
                },
                {
                    label: t('signing.sign_in.uri'),
                    value: shortenUri(message.uri),
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
                ...optionalRows.filter(row => row !== undefined),
            ],
            resourceRows: (message.resources ?? []).map((uri, index) => ({
                label: t('signing.sign_in.resource'),
                value: shortenUri(uri),
                testID: `sign_in_resource_${index}`,
            })),
            grantsWarning: hasGrants
                ? {
                      body: signIn.hasUnreadableGrants
                          ? t('signing.sign_in.grants_unreadable_body', {
                                domain: message.domain,
                            })
                          : t('signing.sign_in.grants_body', {
                                domain: message.domain,
                            }),
                      rows: signIn.grants.map((grant, index) => ({
                          // Whole, since Advanced shows the ReCap only as base64.
                          label: grant.target,
                          value: grant.abilities.join(', '),
                          testID: `sign_in_grant_${index}`,
                      })),
                  }
                : undefined,
            malformedWarning: signIn.isMalformed
                ? t('signing.sign_in.malformed_body', {
                      domain: message.domain,
                  })
                : undefined,
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
