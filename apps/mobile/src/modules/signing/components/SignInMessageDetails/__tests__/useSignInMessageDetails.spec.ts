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

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SignInSummary } from '@perawallet/wallet-core-chain-contract'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { shortenUri, useSignInMessageDetails } from '../useSignInMessageDetails'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, string>) =>
            options ? `${key} ${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainNetworkOf: ({ chainId }: { chainId: string }) => ({
        chain: chainId === 'base' ? 'Base' : 'Ethereum',
        network: 'Sepolia',
    }),
}))

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const ISSUED_AT = '2026-11-20T10:00:00.000Z'
const EXPIRES_AT = '2026-11-21T10:00:00.000Z'

const signIn = (overrides: Partial<SignInSummary> = {}): SignInSummary => ({
    message: {
        domain: 'opensea.io',
        address: ADDRESS,
        uri: 'https://opensea.io/',
        version: '1',
        chainId: '1',
        nonce: '3fp8w2kd',
        issuedAt: ISSUED_AT,
    },
    messageScope: { chainId: 'ethereum', networkId: 'mainnet' },
    isOtherAddress: false,
    isOtherChain: false,
    grants: [],
    hasUnreadableGrants: false,
    ...overrides,
})

const render = (value: SignInSummary) =>
    renderHook(() => useSignInMessageDetails(value)).result.current

describe('useSignInMessageDetails', () => {
    it('lists the domain, address and URI, then the nonce and issued time', () => {
        const { leadingRows, trailingRows, unknownChainRow } = render(signIn())

        expect(leadingRows.map(row => row.value)).toEqual([
            'opensea.io',
            ADDRESS,
            'https://opensea.io/',
        ])
        expect(trailingRows.map(row => row.value)).toEqual([
            '3fp8w2kd',
            formatDatetime(new Date(ISSUED_AT)),
        ])
        expect(unknownChainRow).toBeUndefined()
    })

    it('adds the expiry when the message has one', () => {
        const { trailingRows } = render(
            signIn({
                message: { ...signIn().message, expirationTime: EXPIRES_AT },
            }),
        )

        expect(trailingRows.at(-1)).toMatchObject({
            testID: 'sign_in_expires_at',
            value: formatDatetime(new Date(EXPIRES_AT)),
        })
    })

    it('adds the not-before time and request id when the message has them', () => {
        const { trailingRows } = render(
            signIn({
                message: {
                    ...signIn().message,
                    notBefore: ISSUED_AT,
                    requestId: 'req-42',
                },
            }),
        )

        expect(trailingRows.map(row => row.testID)).toEqual([
            'sign_in_nonce',
            'sign_in_issued_at',
            'sign_in_not_before',
            'sign_in_request_id',
        ])
        expect(trailingRows.at(-1)?.value).toBe('req-42')
    })

    it('lists every resource as its own row', () => {
        const { resourceRows } = render(
            signIn({
                message: {
                    ...signIn().message,
                    resources: ['ipfs://bafy', 'https://opensea.io/terms'],
                },
            }),
        )

        expect(resourceRows.map(row => row.value)).toEqual([
            'ipfs://bafy',
            'https://opensea.io/terms',
        ])
    })

    it('warns of no permissions for a plain sign-in', () => {
        expect(render(signIn()).grantsWarning).toBeUndefined()
    })

    it('warns of the permissions a ReCap grants, one row per target', () => {
        const { grantsWarning } = render(
            signIn({
                grants: [
                    {
                        target: 'https://opensea.io/',
                        abilities: ['crud/read', 'crud/update'],
                    },
                ],
            }),
        )

        expect(grantsWarning?.body).toContain('signing.sign_in.grants_body')
        expect(grantsWarning?.rows).toEqual([
            {
                label: 'https://opensea.io/',
                value: 'crud/read, crud/update',
                testID: 'sign_in_grant_0',
            },
        ])
    })

    it('warns of permissions it cannot read', () => {
        expect(
            render(signIn({ hasUnreadableGrants: true })).grantsWarning?.body,
        ).toContain('signing.sign_in.grants_unreadable_body')
    })

    it('shows no notes for a message that matches the request', () => {
        const { otherAddressNote, otherChainNote } = render(signIn())

        expect(otherAddressNote).toBeUndefined()
        expect(otherChainNote).toBeUndefined()
    })

    it('notes an address other than the signer', () => {
        expect(render(signIn({ isOtherAddress: true })).otherAddressNote).toBe(
            `signing.sign_in.other_address_note ${JSON.stringify({ address: ADDRESS })}`,
        )
    })

    it('notes another chain by its name', () => {
        expect(
            render(
                signIn({
                    messageScope: { chainId: 'base', networkId: 'mainnet' },
                    isOtherChain: true,
                }),
            ).otherChainNote,
        ).toBe(
            `signing.sign_in.other_chain_note ${JSON.stringify({ chain: 'Base' })}`,
        )
    })

    it('names a test network beside its chain', () => {
        expect(
            render(
                signIn({
                    messageScope: { chainId: 'ethereum', networkId: 'sepolia' },
                    isOtherChain: true,
                }),
            ).otherChainNote,
        ).toContain('Ethereum Sepolia')
    })

    it('shows the raw chain id of a chain the wallet does not know', () => {
        const value = signIn({
            message: { ...signIn().message, chainId: '987654321' },
            isOtherChain: true,
        })
        delete value.messageScope

        const { unknownChainRow, otherChainNote } = render(value)

        expect(unknownChainRow?.value).toBe('987654321')
        expect(otherChainNote).toContain('signing.sign_in.chain_id 987654321')
    })
})

describe('shortenUri', () => {
    it('keeps a short URI whole', () => {
        expect(shortenUri('https://opensea.io/terms')).toBe(
            'https://opensea.io/terms',
        )
    })

    it('keeps the scheme and host of a long URL and elides its path', () => {
        const uri = `https://a-very-long-subdomain.opensea.io/${'p'.repeat(60)}/end-tail`
        const short = shortenUri(uri)

        expect(
            short.startsWith('https://a-very-long-subdomain.opensea.io'),
        ).toBe(true)
        expect(short).toContain('…')
        expect(short.endsWith('end-tail')).toBe(true)
        expect(short.length).toBeLessThan(uri.length)
    })

    it('elides the payload of a long URN', () => {
        const short = shortenUri(`urn:recap:${'e'.repeat(200)}`)

        expect(short.startsWith('urn:recap:')).toBe(true)
        expect(short.length).toBeLessThan(60)
    })
})
