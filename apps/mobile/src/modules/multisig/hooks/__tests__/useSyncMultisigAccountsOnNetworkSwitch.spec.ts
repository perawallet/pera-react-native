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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type {
    MultiSigAccount,
    MultiSigDetails,
    WalletAccount,
    WatchAccount,
} from '@perawallet/wallet-core-accounts'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'

const {
    networkMock,
    deviceIdMock,
    accountsMock,
    createMultisigAccountMock,
    loggerMock,
} = vi.hoisted(() => ({
    networkMock: { current: 'testnet' as Network },
    deviceIdMock: { current: 'device-testnet' as Nullable<string> },
    accountsMock: { current: [] as WalletAccount[] },
    createMultisigAccountMock: vi.fn(),
    loggerMock: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: networkMock.current }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => deviceIdMock.current,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
    useAllAccounts: () => accountsMock.current,
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    createMultisigAccount: createMultisigAccountMock,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: loggerMock,
}))

import { useSyncMultisigAccountsOnNetworkSwitch } from '../useSyncMultisigAccountsOnNetworkSwitch'

const DETAILS: MultiSigDetails = {
    threshold: 2,
    addresses: ['P1', 'P2'],
    version: 1,
}

const multisigAccount = (
    address: string,
    multisigDetails: MultiSigDetails = DETAILS,
): MultiSigAccount => ({
    type: 'multisig',
    address,
    name: address,
    multisigDetails,
})

const watchAccount = (address: string): WatchAccount => ({
    type: 'watch',
    address,
})

const renderSync = () =>
    renderHook(() => useSyncMultisigAccountsOnNetworkSwitch())

describe('useSyncMultisigAccountsOnNetworkSwitch', () => {
    beforeEach(() => {
        networkMock.current = 'testnet'
        deviceIdMock.current = 'device-testnet'
        accountsMock.current = []
        createMultisigAccountMock.mockReset()
        createMultisigAccountMock.mockResolvedValue({})
        loggerMock.warn.mockClear()
    })

    it('does not register accounts on the initial mount', () => {
        accountsMock.current = [multisigAccount('MSIG1')]

        renderSync()

        expect(createMultisigAccountMock).not.toHaveBeenCalled()
    })

    it('registers every multisig account on the new network after a switch', () => {
        accountsMock.current = [
            multisigAccount('MSIG1'),
            multisigAccount('MSIG2'),
            watchAccount('WATCH1'),
        ]
        const { rerender } = renderSync()

        networkMock.current = 'mainnet'
        deviceIdMock.current = 'device-mainnet'
        rerender()

        expect(createMultisigAccountMock).toHaveBeenCalledTimes(2)
        expect(createMultisigAccountMock).toHaveBeenCalledWith('mainnet', {
            version: 1,
            threshold: 2,
            participant_addresses: ['P1', 'P2'],
            device_id: 'device-mainnet',
        })
    })

    it('waits for the new network device id — registers only once it is available', () => {
        accountsMock.current = [multisigAccount('MSIG1')]
        const { rerender } = renderSync()

        // Switch before the new network has a registered device.
        networkMock.current = 'mainnet'
        deviceIdMock.current = null
        rerender()
        expect(createMultisigAccountMock).not.toHaveBeenCalled()

        // Device id lands — the still-pending sync now runs.
        deviceIdMock.current = 'device-mainnet'
        rerender()
        expect(createMultisigAccountMock).toHaveBeenCalledTimes(1)
        expect(createMultisigAccountMock).toHaveBeenCalledWith(
            'mainnet',
            expect.objectContaining({ device_id: 'device-mainnet' }),
        )
    })

    it('does nothing when there are no multisig accounts', () => {
        accountsMock.current = [watchAccount('WATCH1')]
        const { rerender } = renderSync()

        networkMock.current = 'mainnet'
        rerender()

        expect(createMultisigAccountMock).not.toHaveBeenCalled()
    })

    it('logs a failure and still registers the other accounts when one rejects', async () => {
        accountsMock.current = [
            multisigAccount('MSIG1'),
            multisigAccount('MSIG2'),
        ]
        createMultisigAccountMock.mockRejectedValueOnce(new Error('boom'))
        const { rerender } = renderSync()

        networkMock.current = 'mainnet'
        deviceIdMock.current = 'device-mainnet'
        rerender()

        // Both accounts attempted — Promise.allSettled, not Promise.all.
        expect(createMultisigAccountMock).toHaveBeenCalledTimes(2)
        await waitFor(() => expect(loggerMock.warn).toHaveBeenCalledTimes(1))
    })
})
