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

import { describe, expect, it, vi } from 'vitest'
import type { Connection } from '@perawallet/wallet-extension-connections'
import {
    canSiteSeeAccounts,
    eip1193ApprovedChainIdsOf,
    type Eip1193Connection,
    type SiteWarningLevel,
} from '../models'

const ORIGIN = 'https://app.example'

const approvedWith = (acknowledged?: SiteWarningLevel): Connection => ({
    id: ORIGIN,
    kind: 'dapp',
    name: 'Example',
    peer: { name: 'Example', url: ORIGIN },
    accounts: ['A'],
    status: 'active',
    createdAt: 1,
    lastActiveAt: 1,
    ...(acknowledged
        ? { metadata: { acknowledgedSiteWarning: acknowledged } }
        : {}),
})

describe('canSiteSeeAccounts', () => {
    it('shows an unlocked wallet’s accounts to a site still as safe as at approval', async () => {
        expect(
            await canSiteSeeAccounts(
                false,
                approvedWith('look-alike'),
                ORIGIN,
                async () => 'look-alike',
            ),
        ).toBe(true)
    })

    it('hides them from a site flagged worse since its approval', async () => {
        expect(
            await canSiteSeeAccounts(
                false,
                approvedWith(),
                ORIGIN,
                async () => 'blocked',
            ),
        ).toBe(false)
    })

    it('hides them while locked, without running the site check', async () => {
        const siteWarningOf = vi.fn(
            async (): Promise<SiteWarningLevel> => 'clear',
        )

        expect(
            await canSiteSeeAccounts(
                true,
                approvedWith(),
                ORIGIN,
                siteWarningOf,
            ),
        ).toBe(false)
        expect(siteWarningOf).not.toHaveBeenCalled()
    })
})

describe('eip1193ApprovedChainIdsOf', () => {
    const connectionWith = (metadata: Record<string, unknown>) =>
        ({
            ...approvedWith(),
            kind: 'dapp-eip1193',
            metadata,
        }) as unknown as Eip1193Connection

    it('reads a record without the field as approved for its current chain only', () => {
        expect(
            eip1193ApprovedChainIdsOf(connectionWith({ chainId: 'ethereum' })),
        ).toEqual(['ethereum'])
    })

    it('ignores a field that is not an array', () => {
        expect(
            eip1193ApprovedChainIdsOf(
                connectionWith({ chainId: 'base', approvedChainIds: 'ethereum' }),
            ),
        ).toEqual(['base'])
    })

    it('drops unknown chains, removes duplicates and puts the current chain first', () => {
        expect(
            eip1193ApprovedChainIdsOf(
                connectionWith({
                    chainId: 'base',
                    approvedChainIds: ['ethereum', 'nope', 'base', 'ethereum', 7],
                }),
            ),
        ).toEqual(['base', 'ethereum'])
    })
})
