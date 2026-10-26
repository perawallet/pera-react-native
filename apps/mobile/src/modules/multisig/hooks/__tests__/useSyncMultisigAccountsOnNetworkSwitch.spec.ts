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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type {
    MultiSigAccount,
    WalletAccount,
    WatchAccount,
} from '@perawallet/wallet-core-accounts'
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import type {
    ChainId,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

const {
    networkMock,
    deviceIdMock,
    accountsMock,
    createMultisigAccountMock,
    loggerMock,
    chainIdsMock,
} = vi.hoisted(() => ({
    chainIdsMock: { current: ['algorand'] as string[] },
    networkMock: { current: 'testnet' as 'mainnet' | 'testnet' },
    deviceIdMock: { current: 'device-testnet' as Nullable<string> },
    accountsMock: { current: [] as WalletAccount[] },
    createMultisigAccountMock: vi.fn(),
    loggerMock: { warn: vi.fn(), error: vi.fn() },
}))

// Faithful re-implementation of the real useOnDeploymentSwitch (effect-timed,
// fires once per real switch) driven by the same mocked network value: the
// mainnet network is the live deployment, every other is developer.
vi.mock('@perawallet/wallet-core-chain-shared', async () => {
    const { useEffect, useRef } = await import('react')
    const deploymentOf = (): WalletMode =>
        networkMock.current === 'mainnet' ? 'live' : 'developer'
    return {
        useWalletDeployment: deploymentOf,
        useNetworkStore: <T>(selector: (state: object) => T): T => selector({}),
        selectChainNetworkId: () => networkMock.current,
        useOnDeploymentSwitch: (
            handler: (from: WalletMode, to: WalletMode) => void,
        ) => {
            const deployment = deploymentOf()
            const handlerRef = useRef(handler)
            handlerRef.current = handler
            const previousDeploymentRef = useRef(deployment)
            useEffect(() => {
                const previousDeployment = previousDeploymentRef.current
                if (previousDeployment === deployment) return
                previousDeploymentRef.current = deployment
                handlerRef.current(previousDeployment, deployment)
            }, [deployment])
        },
    }
})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: <T>(selector: (state: object) => T): T => selector({}),
    deviceIdForDeployment: () => deviceIdMock.current,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<object>()),
    deploymentOf: () => 'live',
}))

vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainIds: () => chainIdsMock.current,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isMultisigAccount: (account: { custody?: { kind: string } }) =>
        account.custody?.kind === 'multisig',
    chainAccountOf: (account: WalletAccount, chainId: ChainId) =>
        account.chains[chainId],
    multisigParametersOf: (account: WalletAccount, chainId: ChainId) => {
        const native = account.chains[chainId]?.native
        return native?.family === 'algorand' ? native.multisig : undefined
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

// Inlined: the chain fixtures load packages this spec mocks out.
const ETHEREUM_CHAIN_ID: ChainId = 'ethereum'

const DETAILS: MultisigParameters = {
    threshold: 2,
    addresses: ['P1', 'P2'],
    version: 1,
}

const multisigAccount = (
    address: string,
    multisig: MultisigParameters = DETAILS,
    chainId: ChainId = 'algorand',
): MultiSigAccount => ({
    id: `multisig-${address}`,
    custody: { kind: 'multisig' },
    name: address,
    chains: {
        [chainId]: { address, native: { family: 'algorand', multisig } },
    },
})

const watchAccount = (address: string): WatchAccount => ({
    id: `watch-${address}`,
    custody: { kind: 'watch' },
    chains: { algorand: { address } },
})

const renderSync = () =>
    renderHook(() => useSyncMultisigAccountsOnNetworkSwitch())

describe('useSyncMultisigAccountsOnNetworkSwitch', () => {
    beforeEach(() => {
        networkMock.current = 'testnet'
        chainIdsMock.current = ['algorand']
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
        expect(createMultisigAccountMock).toHaveBeenCalledWith(
            { chainId: 'algorand', networkId: 'mainnet' },
            {
                version: 1,
                threshold: 2,
                participant_addresses: ['P1', 'P2'],
                device_id: 'device-mainnet',
            },
        )
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
            { chainId: 'algorand', networkId: 'mainnet' },
            expect.objectContaining({ device_id: 'device-mainnet' }),
        )
    })

    it('registers each joint account on its own multisig chain, Ethereum included', () => {
        chainIdsMock.current = ['algorand', ETHEREUM_CHAIN_ID]
        accountsMock.current = [
            multisigAccount('MSIG1'),
            multisigAccount('MSIG2', DETAILS, ETHEREUM_CHAIN_ID),
        ]
        const { rerender } = renderSync()

        networkMock.current = 'mainnet'
        deviceIdMock.current = 'device-mainnet'
        rerender()

        expect(createMultisigAccountMock).toHaveBeenCalledTimes(2)
        expect(createMultisigAccountMock).toHaveBeenCalledWith(
            { chainId: 'algorand', networkId: 'mainnet' },
            expect.objectContaining({ device_id: 'device-mainnet' }),
        )
        expect(createMultisigAccountMock).toHaveBeenCalledWith(
            { chainId: ETHEREUM_CHAIN_ID, networkId: 'mainnet' },
            expect.objectContaining({ device_id: 'device-mainnet' }),
        )
    })

    it('skips joint accounts on a chain without multisig', () => {
        chainIdsMock.current = [ETHEREUM_CHAIN_ID]
        accountsMock.current = [multisigAccount('MSIG1')]
        const { rerender } = renderSync()

        networkMock.current = 'mainnet'
        deviceIdMock.current = 'device-mainnet'
        rerender()

        expect(createMultisigAccountMock).not.toHaveBeenCalled()
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
