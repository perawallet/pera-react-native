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
import { useSignInMessageDetails } from '../useSignInMessageDetails'

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
