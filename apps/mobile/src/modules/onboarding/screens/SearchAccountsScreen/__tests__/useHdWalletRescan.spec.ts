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
import {
    useHdWalletRescan,
    type HdWalletRescanOptions,
} from '../useHdWalletRescan'

const mocks = vi.hoisted(() => ({
    errorToast: vi.fn(),
    showToast: vi.fn(),
    goBack: vi.fn(),
    replace: vi.fn(),
    setSelectedAccountId: vi.fn(),
    scanRekeyed: vi.fn(),
    discoverWalletAccounts: vi.fn(),
    seedOf: vi.fn(),
    held: { current: [] as unknown[] },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: Record<string, unknown>) =>
            options ? `${key}:${JSON.stringify(options)}` : key,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mocks.goBack,
        replace: mocks.replace,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: mocks.errorToast,
        showToast: mocks.showToast,
    }),
}))

vi.mock('@modules/chain-ui', () => ({
    networkListOf: (chainIds: string[]) => chainIds.join(' & '),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAllAccounts: () => mocks.held.current,
    NoHdSeedError: class NoHdSeedError extends Error {},
    seedOf: mocks.seedOf,
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector({ discoverWalletAccounts: mocks.discoverWalletAccounts }),
    useSelectedAccountId: () => ({
        setSelectedAccountId: mocks.setSelectedAccountId,
    }),
}))

vi.mock('../../../hooks', () => ({
    REKEY_SCAN_UNAVAILABLE: 'rekey-scan-unavailable',
    useDelegationScanNoticeResult: () => ({
        scanRekeyed: mocks.scanRekeyed,
        rekeyScanAddressesOf: (accounts: WalletAccount[]) =>
            accounts.flatMap(account => account.chains.algorand?.address ?? []),
        withoutHeld: (candidates: WalletAccount[], held: WalletAccount[]) =>
            candidates.filter(
                candidate =>
                    !held.some(
                        account =>
                            account.chains.algorand?.address ===
                            candidate.chains.algorand?.address,
                    ),
            ),
    }),
}))

const SEED = 'seed-1'

const hdAccount = (id: string, chains: Record<string, unknown>) =>
    ({
        id,
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        chains,
    }) as unknown as WalletAccount

const algorandAccount = hdAccount('hd-1', {
    algorand: { address: 'ALGO_ADDRESS', keyPairId: 'k1' },
})

const walked = (overrides: object = {}) => ({
    accounts: [],
    createdAccountIds: [],
    coverage: 'complete',
    failedChainIds: [],
    isCancelled: false,
    ...overrides,
})

const rescan = async (
    account: WalletAccount = algorandAccount,
    options?: HdWalletRescanOptions,
) => {
    const { result } = renderHook(() => useHdWalletRescan())
    await result.current.rescanHdWallet(account, options)
}

describe('useHdWalletRescan', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.seedOf.mockReturnValue(SEED)
        mocks.held.current = [algorandAccount]
        mocks.discoverWalletAccounts.mockResolvedValue(walked())
        mocks.scanRekeyed.mockResolvedValue([])
    })

    it("walks the account's seed with the chains, signal and progress it was given", async () => {
        const signal = new AbortController().signal
        const onProgress = vi.fn()

        await rescan(algorandAccount, {
            chainIds: ['base'],
            signal,
            onProgress,
        })

        expect(mocks.discoverWalletAccounts).toHaveBeenCalledExactlyOnceWith(
            SEED,
            { chainIds: ['base'], signal, onProgress },
        )
    })

    it('walks the seed of an account that holds only an Ethereum entry', async () => {
        const ethereumOnly = hdAccount('hd-eth', {
            ethereum: { address: '0xabc', keyPairId: 'k-eth' },
        })

        await rescan(ethereumOnly)

        expect(mocks.seedOf).toHaveBeenCalledWith(ethereumOnly)
        expect(mocks.errorToast).not.toHaveBeenCalled()
    })

    it('scans for rekeyed accounts over the seed Algorand addresses only', async () => {
        const sibling = hdAccount('hd-2', {
            algorand: { address: 'SIBLING', keyPairId: 'k2' },
        })
        const otherSeed = hdAccount('other', {
            algorand: { address: 'OTHER', keyPairId: 'k3' },
        })
        mocks.held.current = [algorandAccount, sibling, otherSeed]
        mocks.seedOf.mockImplementation((account: WalletAccount) =>
            account.id === 'other' ? 'seed-2' : SEED,
        )

        await rescan()

        expect(mocks.scanRekeyed).toHaveBeenCalledExactlyOnceWith(
            ['ALGO_ADDRESS', 'SIBLING'],
            'rescan',
        )
    })

    it('opens the result with what the walk added, failed and left unfinished', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue(
            walked({
                accounts: [algorandAccount, hdAccount('hd-2', {})],
                createdAccountIds: ['hd-2'],
                coverage: 'partial',
                failedChainIds: ['base', 'bsc'],
            }),
        )

        await rescan()

        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'ScanAccountsResult',
            {
                account: algorandAccount,
                changedAccountIds: ['hd-1', 'hd-2'],
                createdAccountIds: ['hd-2'],
                failedChainIds: ['base', 'bsc'],
                isCancelled: false,
                isIncomplete: true,
            },
        )
    })

    it('opens the result after a cancel without a rekey scan, even when nothing answered', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue(
            walked({ coverage: 'unanswered', isCancelled: true }),
        )

        await rescan()

        expect(mocks.scanRekeyed).not.toHaveBeenCalled()
        expect(mocks.errorToast).not.toHaveBeenCalled()
        expect(mocks.replace).toHaveBeenCalledWith(
            'ScanAccountsResult',
            expect.objectContaining({ isCancelled: true }),
        )
    })

    it('navigates nowhere once the user has left the screen', async () => {
        await rescan(algorandAccount, { hasLeft: () => true })

        expect(mocks.replace).not.toHaveBeenCalled()
        expect(mocks.goBack).not.toHaveBeenCalled()
    })

    it('treats rekeyed accounts the wallet already holds as nothing new', async () => {
        const heldRekeyed = hdAccount('held-rekeyed', {
            algorand: { address: 'REKEYED', keyPairId: 'k9' },
        })
        mocks.held.current = [algorandAccount, heldRekeyed]
        mocks.scanRekeyed.mockResolvedValue([
            { id: 'candidate', chains: { algorand: { address: 'REKEYED' } } },
        ])

        await rescan()

        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'ScanAccountsResult',
            expect.anything(),
        )
    })

    it('opens the result when the rekey scan was unavailable', async () => {
        mocks.scanRekeyed.mockResolvedValue('rekey-scan-unavailable')

        await rescan()

        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'ScanAccountsResult',
            expect.anything(),
        )
    })

    it('opens the rekeyed picker after selecting the account when rekeyed accounts exist', async () => {
        const rekeyed = [
            hdAccount('rekeyed', { algorand: { address: 'NEW_REKEYED' } }),
        ]
        mocks.scanRekeyed.mockResolvedValue(rekeyed)

        await rescan()

        expect(mocks.setSelectedAccountId).toHaveBeenCalledWith('hd-1')
        expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
            'ImportRekeyedAddresses',
            { accounts: rekeyed },
        )
    })

    it('names the unchecked networks before opening the rekeyed picker, which stands in for the result', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue(
            walked({ coverage: 'partial', failedChainIds: ['base'] }),
        )
        mocks.scanRekeyed.mockResolvedValue([
            hdAccount('rekeyed', { algorand: { address: 'NEW_REKEYED' } }),
        ])

        await rescan()

        expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith({
            type: 'warning',
            title: 'onboarding.scan_accounts_result.incomplete_title',
            body: 'onboarding.scan_accounts_result.failed_networks_body:{"networks":"base"}',
        })
        expect(mocks.replace).toHaveBeenCalledWith(
            'ImportRekeyedAddresses',
            expect.anything(),
        )
    })

    it('reports the failure and goes back when no chain answered', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue(
            walked({ coverage: 'unanswered' }),
        )

        await rescan()

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'onboarding.searching_accounts.rescan_failed_title',
            'onboarding.searching_accounts.rescan_failed_body',
        )
        expect(mocks.goBack).toHaveBeenCalledOnce()
        expect(mocks.scanRekeyed).not.toHaveBeenCalled()
        expect(mocks.replace).not.toHaveBeenCalled()
    })

    it('reports the failure and goes back when the account has no seed', async () => {
        mocks.seedOf.mockReturnValue(undefined)

        await rescan()

        expect(mocks.discoverWalletAccounts).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledOnce()
        expect(mocks.goBack).toHaveBeenCalledOnce()
    })

    it('never rejects, even when the rekey scan throws', async () => {
        mocks.scanRekeyed.mockRejectedValue(new Error('boom'))

        await expect(rescan()).resolves.toBeUndefined()

        expect(mocks.goBack).toHaveBeenCalledOnce()
    })
})
