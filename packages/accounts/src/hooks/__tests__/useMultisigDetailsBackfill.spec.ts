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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    multisigChainAdapters,
    type MultisigChainAdapter,
} from '@perawallet/wallet-core-multisig'
import { useMultisigDetailsBackfill } from '../useMultisigDetailsBackfill'
import { withMultisigParameters } from '../../multisig'
import { testAccount } from '../../__tests__/accountFactory'
import { FAKE_CHAIN_ID, MAINNET_SCOPE } from '../../__tests__/fakeAccountsChain'

const mocks = vi.hoisted(() => ({
    updateAccount: vi.fn(),
    useMultisigAccountDetailQuery: vi.fn(),
    deriveAddress: vi.fn(),
    isMultisigEnabled: true,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: () => mocks.isMultisigEnabled,
}))

vi.mock('../useUpdateAccount', () => ({
    useUpdateAccount: () => mocks.updateAccount,
}))

vi.mock('@perawallet/wallet-core-multisig', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-multisig')
    >()),
    useMultisigAccountDetailQuery: mocks.useMultisigAccountDetailQuery,
}))

const fakeMultisigAdapter = {
    chainId: FAKE_CHAIN_ID,
    deriveAddress: mocks.deriveAddress,
    parametersOf: native =>
        native?.multisig
            ? { ...native.multisig, addresses: [...native.multisig.addresses] }
            : undefined,
    toNative: ({ version, threshold, addresses }) => ({
        family: 'algorand',
        multisig: { version, threshold, addresses: [...addresses] },
    }),
} as Partial<MultisigChainAdapter> as MultisigChainAdapter

const PARAMETERS = {
    version: 1,
    threshold: 2,
    addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

const detailLessMultisig = testAccount('multisig', 'MSIG_ADDR', {
    id: 'msig-id',
    name: 'Shared Account #4',
})

const serverDetail = (participantAddresses = PARAMETERS.addresses) => ({
    data: {
        threshold: PARAMETERS.threshold,
        participantAddresses,
        version: PARAMETERS.version,
    },
    isFetching: false,
})

describe('useMultisigDetailsBackfill', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.isMultisigEnabled = true
        multisigChainAdapters.reset()
        multisigChainAdapters.register(fakeMultisigAdapter)
        // Default: the server data legitimately derives the account's address.
        mocks.deriveAddress.mockReturnValue('MSIG_ADDR')
    })

    it('enables the detail query only when a multisig account lacks its parameters', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isFetching: true,
        })

        const { result } = renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith({
            network: 'mainnet',
            address: 'MSIG_ADDR',
            enabled: true,
        })
        expect(result.current.isBackfilling).toBe(true)
    })

    it('does not fetch when the parameters already exist', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
        })
        const complete = withMultisigParameters(
            detailLessMultisig,
            FAKE_CHAIN_ID,
            PARAMETERS,
        )

        renderHook(() => useMultisigDetailsBackfill(complete, MAINNET_SCOPE))

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })

    it('does not fetch for an account that is not a multisig', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isFetching: false,
        })

        renderHook(() =>
            useMultisigDetailsBackfill(
                testAccount('local', 'LOCAL'),
                MAINNET_SCOPE,
            ),
        )

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
    })

    it('stays inert on a chain without the multisig capability', () => {
        mocks.isMultisigEnabled = false
        mocks.useMultisigAccountDetailQuery.mockReturnValue(serverDetail())

        renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })

    it('writes the fetched parameters onto the chain entry once', () => {
        mocks.useMultisigAccountDetailQuery.mockReturnValue(serverDetail())

        const { rerender } = renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.deriveAddress).toHaveBeenCalledWith(PARAMETERS)
        expect(mocks.updateAccount).toHaveBeenCalledTimes(1)
        expect(mocks.updateAccount).toHaveBeenCalledWith({
            ...detailLessMultisig,
            chains: {
                [FAKE_CHAIN_ID]: {
                    address: 'MSIG_ADDR',
                    native: fakeMultisigAdapter.toNative(PARAMETERS),
                },
            },
        })

        rerender()
        expect(mocks.updateAccount).toHaveBeenCalledTimes(1)
    })

    it('refuses to backfill when the participant set does not derive the address', () => {
        mocks.deriveAddress.mockReturnValue('A_DIFFERENT_ADDRESS')
        mocks.useMultisigAccountDetailQuery.mockReturnValue(
            serverDetail(['EVIL1', 'EVIL2']),
        )

        renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })

    it('refuses to backfill when derivation throws on a malformed participant', () => {
        mocks.deriveAddress.mockImplementation(() => {
            throw new Error('invalid address')
        })
        mocks.useMultisigAccountDetailQuery.mockReturnValue(
            serverDetail(['NOT_AN_ADDRESS']),
        )

        renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })

    it('fails closed on a chain with no multisig adapter', () => {
        multisigChainAdapters.reset()
        mocks.useMultisigAccountDetailQuery.mockReturnValue(serverDetail())

        renderHook(() =>
            useMultisigDetailsBackfill(detailLessMultisig, MAINNET_SCOPE),
        )

        expect(mocks.useMultisigAccountDetailQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
        expect(mocks.updateAccount).not.toHaveBeenCalled()
    })
})
