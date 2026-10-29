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
import { useHdWalletRescan } from '../useHdWalletRescan'

const mocks = vi.hoisted(() => ({
    showToast: vi.fn(),
    errorToast: vi.fn(),
    goBack: vi.fn(),
    replace: vi.fn(),
    exitAccountFlow: vi.fn(),
    setSelectedAccountId: vi.fn(),
    scanRekeyed: vi.fn(),
    discoverWalletAccounts: vi.fn(),
    seedOf: vi.fn(),
    held: { current: [] as unknown[] },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { count?: number }) =>
            options?.count === undefined ? key : `${key}:${options.count}`,
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
        showToast: mocks.showToast,
        errorToast: mocks.errorToast,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => {
    const useAccountsStore = Object.assign(
        (selector: (state: unknown) => unknown) =>
            selector({ discoverWalletAccounts: mocks.discoverWalletAccounts }),
        { getState: () => ({ accounts: mocks.held.current }) },
    )
    return {
        NoHdSeedError: class NoHdSeedError extends Error {},
        seedOf: mocks.seedOf,
        useAccountsStore,
        useSelectedAccountId: () => ({
            setSelectedAccountId: mocks.setSelectedAccountId,
        }),
    }
})

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
    useExitAccountFlow: () => ({ exitAccountFlow: mocks.exitAccountFlow }),
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

const rescan = async (account: WalletAccount = algorandAccount) => {
    const { result } = renderHook(() => useHdWalletRescan())
    await result.current.rescanHdWallet(account)
}

describe('useHdWalletRescan', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.seedOf.mockReturnValue(SEED)
        mocks.held.current = [algorandAccount]
        mocks.discoverWalletAccounts.mockResolvedValue({
            accounts: [],
            coverage: 'complete',
        })
        mocks.scanRekeyed.mockResolvedValue([])
    })

    it("walks the account's seed with no root key and no declined indexes", async () => {
        await rescan()

        expect(mocks.discoverWalletAccounts).toHaveBeenCalledExactlyOnceWith(
            SEED,
        )
    })

    it('walks the seed of an account that holds only an Ethereum entry', async () => {
        const ethereumOnly = hdAccount('hd-eth', {
            ethereum: { address: '0xabc', keyPairId: 'k-eth' },
        })

        await rescan(ethereumOnly)

        expect(mocks.seedOf).toHaveBeenCalledWith(ethereumOnly)
        expect(mocks.discoverWalletAccounts).toHaveBeenCalledExactlyOnceWith(
            SEED,
        )
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

        expect(mocks.scanRekeyed).toHaveBeenCalledExactlyOnceWith([
            'ALGO_ADDRESS',
            'SIBLING',
        ])
    })

    it('tells the user how many accounts changed and exits the flow', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue({
            accounts: [algorandAccount, hdAccount('hd-2', {})],
            coverage: 'complete',
        })

        await rescan()

        expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith({
            type: 'success',
            title: 'onboarding.searching_accounts.rescan_found_title',
            body: 'onboarding.searching_accounts.rescan_found_body:2',
        })
        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
    })

    it('tells the user when it found nothing new', async () => {
        await rescan()

        expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith({
            type: 'info',
            title: 'onboarding.searching_accounts.no_new_addresses_title',
            body: 'onboarding.searching_accounts.no_new_addresses_body',
        })
        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
    })

    it('does not claim nothing was found when the rekey scan was unavailable', async () => {
        mocks.scanRekeyed.mockResolvedValue('rekey-scan-unavailable')

        await rescan()

        expect(mocks.showToast).not.toHaveBeenCalled()
        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
    })

    it('warns that the scan was incomplete, keeping what was found', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue({
            accounts: [algorandAccount],
            coverage: 'partial',
        })

        await rescan()

        expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith({
            type: 'warning',
            title: 'onboarding.searching_accounts.rescan_partial_title',
            body: 'onboarding.searching_accounts.rescan_partial_body',
        })
        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
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

        expect(mocks.replace).not.toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                title: 'onboarding.searching_accounts.no_new_addresses_title',
            }),
        )
        expect(mocks.exitAccountFlow).toHaveBeenCalledOnce()
    })

    it('opens the rekeyed picker after selecting the account when rekeyed accounts exist', async () => {
        const rekeyed = [
            hdAccount('rekeyed', { algorand: { address: 'NEW_REKEYED' } }),
        ]
        mocks.scanRekeyed.mockResolvedValue(rekeyed)

        await rescan()

        expect(mocks.setSelectedAccountId).toHaveBeenCalledWith('hd-1')
        expect(mocks.replace).toHaveBeenCalledWith('ImportRekeyedAddresses', {
            accounts: rekeyed,
        })
        expect(mocks.exitAccountFlow).not.toHaveBeenCalled()
        expect(mocks.showToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'info' }),
        )
    })

    it('reports the failure and goes back when no chain answered', async () => {
        mocks.discoverWalletAccounts.mockResolvedValue({
            accounts: [],
            coverage: 'unanswered',
        })

        await rescan()

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'onboarding.searching_accounts.rescan_failed_title',
            'onboarding.searching_accounts.rescan_failed_body',
        )
        expect(mocks.goBack).toHaveBeenCalledOnce()
        expect(mocks.scanRekeyed).not.toHaveBeenCalled()
        expect(mocks.exitAccountFlow).not.toHaveBeenCalled()
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
