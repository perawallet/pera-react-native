/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import React from 'react'
import { render, fireEvent } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Arc60DataSigningSummaryView } from '../Arc60DataSigningSummaryView'
import {
    ARC60_SCOPE_AUTH,
    SIWA_CHAIN_ID,
    type Arc60SignRequest,
    type Siwa,
} from '@perawallet/wallet-core-signing'

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style }: any) => <div style={style}>{children}</div>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children }: any) => <span>{children}</span>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWButton: ({ title, onPress }: any) => (
        <button onClick={onPress}>{title}</button>
    ),
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: () => <div data-testid='account-display'>account</div>,
}))

const validSiwa: Siwa = {
    domain: 'arc60.io',
    account_address: 'HD_ADDR',
    uri: 'https://arc60.io/login',
    version: '1',
    chain_id: SIWA_CHAIN_ID,
    type: 'ed25519',
    statement: 'Sign in to Arc60',
    nonce: 'nonce-123',
}

const request: Arc60SignRequest = {
    id: '1',
    type: 'arc60',
    transport: 'callback',
    stdSigData: {
        data: 'eyJmb28iOiJiYXIifQ==',
        signer: 'HD_ADDR',
        domain: 'arc60.io',
        authenticatorData: new Uint8Array(33),
        requestId: 'req-1',
    },
    metadata: { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
}

describe('Arc60DataSigningSummaryView', () => {
    const onDetailsPress = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the title and description keys', () => {
        const { container } = render(
            <Arc60DataSigningSummaryView
                request={request}
                account={{ address: 'HD_ADDR', type: 'hdWallet' } as never}
                parsed={{ type: 'siwa', siwa: validSiwa }}
                onDetailsPress={onDetailsPress}
            />,
        )
        expect(container.textContent).toContain('signing.arc60_view.title')
        expect(container.textContent).toContain(
            'signing.arc60_view.description',
        )
    })

    it('renders the SIWA statement when present', () => {
        const { container } = render(
            <Arc60DataSigningSummaryView
                request={request}
                account={undefined}
                parsed={{ type: 'siwa', siwa: validSiwa }}
                onDetailsPress={onDetailsPress}
            />,
        )
        expect(container.textContent).toContain('Sign in to Arc60')
    })

    it('invokes onDetailsPress when Show Details is tapped', () => {
        const { getByText } = render(
            <Arc60DataSigningSummaryView
                request={request}
                account={undefined}
                parsed={{ type: 'siwa', siwa: validSiwa }}
                onDetailsPress={onDetailsPress}
            />,
        )
        fireEvent.click(getByText('signing.arc60_view.show_details'))
        expect(onDetailsPress).toHaveBeenCalled()
    })
})
