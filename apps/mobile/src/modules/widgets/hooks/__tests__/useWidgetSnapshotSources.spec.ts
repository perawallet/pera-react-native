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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useWidgetSnapshotSources } from '../useWidgetSnapshotSources'

const state = vi.hoisted(() => ({
    accounts: [] as { id: string; name?: string; address?: string }[],
    privacyMode: false,
    storedPeriod: 'one-month' as unknown,
    preferredCurrency: 'EUR',
    priceIsPending: false,
    priceIsError: false,
    priceData: '0.2' as string | undefined,
    priceUpdatedAt: 1234,
    nftResult: { candidates: [], isError: false } as {
        candidates: unknown
        isError: boolean
    },
    backendUrl: 'https://mainnet.api.example',
    assetOptionsQuery: vi.fn(),
    nftCandidatesQuery: vi.fn(),
    allAccounts: [] as { id: string; name?: string; address?: string }[],
    needingBackup: vi.fn(),
    passphrasePending: false,
    hasInbox: true,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: () => state.accounts,
    useAccountsStore: (selector: (s: { accounts: unknown }) => unknown) =>
        selector({ accounts: state.allAccounts }),
    addressOn: (account: { address?: string }) => account.address,
    getAccountDisplayName: (account: { name?: string; address?: string }) =>
        account.name ?? `short:${account.address}`,
    useAccountValueTotalsQuery: () => ({
        portfolioUsdValue: new Decimal('100'),
        portfolioNativeValue: new Decimal('500'),
        isPending: false,
        isError: false,
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'developer',
    useChainCapability: () => state.hasInbox,
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: () => ({
        preferredCurrency: state.preferredCurrency,
        isRatePending: false,
        usdToPreferred: (usd: Decimal | null | undefined) =>
            usd ? usd.mul(2) : null,
        nativeUsdPrice: undefined,
    }),
    useNativeUsdPriceQuery: () => ({
        data:
            state.priceData === undefined
                ? undefined
                : new Decimal(state.priceData),
        isPending: state.priceIsPending,
        isError: state.priceIsError,
        dataUpdatedAt: state.priceUpdatedAt,
    }),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: () => ({ privacyMode: state.privacyMode, theme: 'dark' }),
    usePreferences: () => ({ getPreference: () => state.storedPeriod }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { backendAPIKey: 'api-key' },
    deploymentOf: () => 'live',
    getPeraServicesConfig: () => ({ backendUrl: state.backendUrl }),
    getPeraDeploymentConfig: (deployment: string) => ({
        backendUrl: `https://${deployment}.api.example`,
    }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeploymentDeviceID: (deployment: string) => `${deployment}-device`,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useAccountsNeedingMnemonicBackup: (...args: unknown[]) => {
        state.needingBackup(...args)
        return {
            accounts: [{ id: 'unbacked' }],
            isPending: state.passphrasePending,
        }
    },
}))

vi.mock('../useWidgetReceiveTargets', () => ({
    useWidgetReceiveTargets: () => [
        {
            address: 'ADDR1',
            name: 'Main',
            paymentUri: 'algorand://ADDR1',
            chain: null,
        },
    ],
}))

vi.mock('@modules/cloud-backup', () => ({
    useCloudBackupSummary: () => ({ state: 'notSetUp' }),
}))

vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'algorand',
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, options?: { count?: unknown }) =>
            typeof options?.count === 'string'
                ? `${key}|${options.count}`
                : key,
        currentLanguage: 'pt-BR',
    }),
}))

vi.mock('@hooks/useNetworkLabel', () => ({
    useNetworkLabel: () => (network: string) => `label:${network}`,
}))

vi.mock('../useWidgetAssetOptionsQuery', () => ({
    useWidgetAssetOptionsQuery: (...args: unknown[]) => {
        state.assetOptionsQuery(...args)
        return {
            options: [{ assetId: '31566704', name: 'USDC', unitName: 'USDC' }],
        }
    },
}))

vi.mock('../useWidgetNftCandidatesQuery', () => ({
    useWidgetNftCandidatesQuery: (...args: unknown[]) => {
        state.nftCandidatesQuery(...args)
        return state.nftResult
    },
}))

describe('useWidgetSnapshotSources', () => {
    beforeEach(() => {
        state.accounts = [
            { id: '1', name: 'Main', address: 'ADDR1' },
            { id: '2', address: 'ADDR2' },
            { id: '3', name: 'Elsewhere' },
        ]
        state.privacyMode = false
        state.storedPeriod = 'one-month'
        state.preferredCurrency = 'EUR'
        state.priceIsPending = false
        state.priceIsError = false
        state.priceData = '0.2'
        state.priceUpdatedAt = 1234
        state.nftResult = { candidates: [], isError: false }
        vi.mocked(getProvider().widgets.backendPinning).mockReturnValue(null)
        state.backendUrl = 'https://mainnet.api.example'
        state.assetOptionsQuery.mockClear()
        state.nftCandidatesQuery.mockClear()
        state.allAccounts = [{ id: 'signing' }, { id: 'rekey-target' }]
        state.needingBackup.mockClear()
        state.passphrasePending = false
        state.hasInbox = true
    })

    it('shares accounts with their display names and skips ones without an address on the chain', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.portfolioFeed?.accounts).toEqual([
            { address: 'ADDR1', name: 'Main' },
            { address: 'ADDR2', name: 'short:ADDR2' },
        ])
    })

    it('uses the app chart period preference for the portfolio feed', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.portfolioFeed?.period).toBe('one-month')
    })

    it('queries asset options and NFTs for the shared addresses', () => {
        renderHook(() => useWidgetSnapshotSources())

        const scope = { chainId: 'algorand', networkId: 'testnet' }
        expect(state.assetOptionsQuery).toHaveBeenCalledWith(
            ['ADDR1', 'ADDR2'],
            scope,
            true,
        )
        expect(state.nftCandidatesQuery).toHaveBeenCalledWith(
            ['ADDR1', 'ADDR2'],
            scope,
            true,
        )
    })

    it('reads nothing account-revealing and shares no accounts in privacy mode', () => {
        state.privacyMode = true

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.portfolioFeed).toBeNull()
        expect(result.current.isPrivacyMode).toBe(true)
        expect(state.assetOptionsQuery).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            false,
        )
        expect(state.nftCandidatesQuery).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            false,
        )
    })

    it('points the price feed at the network backend with the app API key and currency', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.priceFeed).toEqual({
            backendUrl: 'https://mainnet.api.example',
            apiKey: 'api-key',
            currencyCode: 'EUR',
            pinning: null,
        })
    })

    it('passes the pins the app enforces on the backend to the price feed', () => {
        const pinning = {
            publicKeyHashes: ['pin='],
            expiresAt: '2027-07-08T00:00:00Z',
        }
        vi.mocked(getProvider().widgets.backendPinning).mockReturnValue(pinning)

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(getProvider().widgets.backendPinning).toHaveBeenCalledWith(
            'https://mainnet.api.example',
        )
        expect(result.current.priceFeed?.pinning).toEqual(pinning)
    })

    it('has no price feed on a network without a Pera backend', () => {
        state.backendUrl = ''

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.priceFeed).toBeNull()
    })

    it('passes the app locale, theme and translated network label through', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current).toMatchObject({
            locale: 'pt-BR',
            theme: 'dark',
            network: { isMainnet: false, label: 'label:testnet' },
        })
    })

    it('maps every widget label to its translation key', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.strings).toMatchObject({
            portfolio: 'portfolio.title',
            recentTransactions: 'widgets.recent_transactions',
            txSend: 'transactions.list_item.send',
            txAppCall: 'transactions.list_item.app_call',
        })
    })

    it('converts the price into the preferred currency with the price query timestamp', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.algoPrice).toEqual({
            value: new Decimal('0.4'),
            currencyCode: 'EUR',
            asOf: 1234,
        })
    })

    // A failed price read must not hold back the snapshot like a pending one.
    it('treats a failed first price read as an unknown value, not as loading', () => {
        state.priceIsError = true
        state.priceData = undefined

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.algoPrice?.value).toBeNull()
        expect(result.current.portfolio?.algoValue).toEqual(new Decimal('500'))
    })

    it('keeps the last good price through a failed read', () => {
        const { result, rerender } = renderHook(() =>
            useWidgetSnapshotSources(),
        )
        const good = result.current.algoPrice

        state.priceIsError = true
        state.priceData = undefined
        state.priceUpdatedAt = 9999
        rerender()

        expect(result.current.algoPrice).toBe(good)
    })

    // An unchanged price poll must not cost a snapshot write and a timeline reload.
    it('keeps the price timestamp while a refetch returns the same price', () => {
        const { result, rerender } = renderHook(() =>
            useWidgetSnapshotSources(),
        )

        state.priceUpdatedAt = 5678
        rerender()
        expect(result.current.algoPrice?.asOf).toBe(1234)
        expect(result.current.portfolio?.asOf).toBe(1234)

        state.priceData = '0.3'
        rerender()
        expect(result.current.algoPrice).toEqual({
            value: new Decimal('0.6'),
            currencyCode: 'EUR',
            asOf: 5678,
        })
    })

    it('keeps the last good NFTs through a failed read', () => {
        const candidates = [
            { assetId: '7', title: 'Seven', imageUrl: 'https://x/7.png' },
        ]
        state.nftResult = { candidates, isError: false }
        const { result, rerender } = renderHook(() =>
            useWidgetSnapshotSources(),
        )

        state.nftResult = { candidates: null, isError: true }
        rerender()

        expect(result.current.nfts).toEqual(candidates)
    })

    // Null, not []: an empty list would purge every cached image.
    it('reports NFTs as unknown when the first read fails', () => {
        state.nftResult = { candidates: null, isError: true }

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.nfts).toBeNull()
    })

    it('writes the inbox counts as whole sentences with a count token for the widget', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.strings).toMatchObject({
            inboxWaiting: 'widgets.inbox_waiting|{count}',
            inboxToSign: 'widgets.inbox_to_sign|{count}',
        })
        expect(result.current.strings).not.toHaveProperty('waiting')
        expect(result.current.strings).not.toHaveProperty('toSign')
    })

    it('reports the price as loading while its query is pending', () => {
        state.priceIsPending = true

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.algoPrice).toBeUndefined()
    })

    // A rekey target isn't a signing account, yet its passphrase still matters.
    it('counts passphrase backups over every account, not just signing ones', () => {
        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(state.needingBackup).toHaveBeenCalledWith(state.allAccounts, {
            chainId: 'algorand',
            networkId: 'testnet',
        })
        expect(result.current.backup).toEqual({
            cloud: {
                state: 'notSetUp',
                title: 'widgets.backup_not_set_up',
                detail: 'widgets.backup_tap_to_back_up',
            },
            passphrase: {
                state: 'needed',
                title: 'widgets.passphrase_needed',
                detail: 'widgets.backup_tap_to_back_up',
            },
        })
    })

    it('reports backup as loading while the passphrase count is pending', () => {
        state.passphrasePending = true

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.backup).toBeUndefined()
    })

    // Shared accounts aren't signing accounts, but their sign requests are
    // labelled by the shared account's name.
    it('shares the inbox device, the signing addresses and every account name', () => {
        state.allAccounts = [
            { id: '1', name: 'Main', address: 'ADDR1' },
            { id: 'shared', name: 'Team Vault', address: 'SHARED' },
        ]

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.inboxFeed).toEqual({
            deviceId: 'live-device',
            addresses: ['ADDR1', 'ADDR2'],
            localAddresses: ['ADDR1', 'SHARED'],
            accountNames: [
                { address: 'ADDR1', name: 'Main' },
                { address: 'SHARED', name: 'Team Vault' },
            ],
            notifications: {
                backendUrl: 'https://developer.api.example',
                deviceId: 'developer-device',
            },
        })
    })

    it('shares no inbox where the network has it switched off', () => {
        state.hasInbox = false

        const { result } = renderHook(() => useWidgetSnapshotSources())

        expect(result.current.inboxFeed).toBeNull()
    })
})
