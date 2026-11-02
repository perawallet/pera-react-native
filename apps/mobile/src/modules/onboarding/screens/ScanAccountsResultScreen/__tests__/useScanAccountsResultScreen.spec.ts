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

import { renderHook } from '@test-utils/render'
import { vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useScanAccountsResultScreen } from '../useScanAccountsResultScreen'

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    exitAccountFlow: vi.fn(),
    params: { current: {} as Record<string, unknown> },
    accounts: { current: [] as unknown[] },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key}:${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ replace: mocks.replace }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: mocks.params.current }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector({ accounts: mocks.accounts.current }),
}))

vi.mock('@modules/chain-ui', () => ({
    networkListOf: (chainIds: string[]) => chainIds.join(' & '),
}))

vi.mock('../../../hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mocks.exitAccountFlow }),
}))

const scanned = { id: 'hd-1' } as WalletAccount
const added = { id: 'hd-2' } as WalletAccount

const render = (params: Record<string, unknown> = {}) => {
    mocks.params.current = {
        account: scanned,
        changedAccountIds: [],
        createdAccountIds: [],
        failedChainIds: [],
        isCancelled: false,
        isIncomplete: false,
        ...params,
    }
    return renderHook(() => useScanAccountsResultScreen()).result.current
}

describe('useScanAccountsResultScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accounts.current = [scanned, added]
    })

    it('lists the accounts the scan created and says how many', () => {
        const result = render({
            changedAccountIds: ['hd-2'],
            createdAccountIds: ['hd-2'],
        })

        expect(result.variant).toBe('success')
        expect(result.title).toBe(
            'onboarding.scan_accounts_result.found_title:{"count":1}',
        )
        expect(result.changedAccounts).toEqual([added])
        expect(result.secondaryAction).toBeUndefined()
    })

    it('does not call an existing account that gained a network new', () => {
        const result = render({ changedAccountIds: ['hd-1'] })

        expect(result.title).toBe(
            'onboarding.scan_accounts_result.updated_title:{"count":1}',
        )
        expect(result.body).toBe(
            'onboarding.scan_accounts_result.updated_body:{"count":1}',
        )
        expect(result.changedAccounts).toEqual([scanned])
    })

    it('names both new accounts and existing ones that gained a network', () => {
        const result = render({
            changedAccountIds: ['hd-1', 'hd-2'],
            createdAccountIds: ['hd-2'],
        })

        expect(result.title).toBe(
            'onboarding.scan_accounts_result.found_title:{"count":1}',
        )
        expect(result.body).toBe(
            'onboarding.scan_accounts_result.found_body:{"count":1} onboarding.scan_accounts_result.updated_note:{"count":1}',
        )
    })

    it('says nothing new was found when the scan added nothing', () => {
        const result = render()

        expect(result.variant).toBe('success')
        expect(result.title).toBe('onboarding.scan_accounts_result.none_title')
        expect(result.body).toBe('onboarding.scan_accounts_result.none_body')
    })

    it('names the networks it could not check, and offers to check only those again', () => {
        const result = render({
            changedAccountIds: ['hd-2'],
            createdAccountIds: ['hd-2'],
            failedChainIds: ['base', 'bsc'],
            isIncomplete: true,
        })

        expect(result.variant).toBe('warning')
        expect(result.body).toBe(
            'onboarding.scan_accounts_result.failed_networks_body:{"networks":"base & bsc"}',
        )

        result.secondaryAction?.onPress()

        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'SearchAccounts',
            { account: scanned, chainIds: ['base', 'bsc'] },
        )
    })

    it('says the scan was stopped, and offers a full scan again', () => {
        const result = render({ isCancelled: true, isIncomplete: true })

        expect(result.variant).toBe('warning')
        expect(result.title).toBe(
            'onboarding.scan_accounts_result.cancelled_title',
        )
        expect(result.body).toBe(
            'onboarding.scan_accounts_result.cancelled_none_body',
        )

        result.secondaryAction?.onPress()

        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'SearchAccounts',
            { account: scanned, chainIds: undefined },
        )
    })

    it('says some checks did not finish when no network is to blame', () => {
        const result = render({ isIncomplete: true })

        expect(result.variant).toBe('warning')
        expect(result.body).toBe(
            'onboarding.scan_accounts_result.incomplete_body',
        )
        expect(result.secondaryAction?.label).toBe(
            'onboarding.scan_accounts_result.scan_again',
        )
    })

    it('Done leaves the flow', () => {
        render().primaryAction.onPress()

        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
    })
})
