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

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'

import {
    chainAccountOf,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { render } from '@test-utils/render'
import { isElementDisabled } from '@test-utils/rnw'
import { BottomSheetManager } from '@modules/bottom-sheet'
import { useViewPassphraseFlow } from '@modules/view-passphrase'

import { seedHdAccount } from './__fixtures__/accountOptions'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { SLOW_WAIT_TIMEOUT_MS } from './__fixtures__/timeouts'

// Display-only: no test signs or derives with it.
const EVM_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

// The integration setup registers whichever chains config enables.
vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    const { EVM_CHAIN_NETWORKS: networks } = await vi.importActual<
        typeof import('@perawallet/wallet-core-chain-contract')
    >('@perawallet/wallet-core-chain-contract')
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
        chainEndpointsFor: (
            chainId: Parameters<typeof actual.chainEndpointsFor>[0],
        ) =>
            chainId === 'ethereum'
                ? Object.fromEntries(
                      networks.ethereum.networks.map(({ id }) => [
                          id,
                          'https://ethereum.rpc.test/',
                      ]),
                  )
                : actual.chainEndpointsFor(chainId),
    }
})

const ViewPassphraseHost = ({ address }: { address: string }) => {
    const { openViewPassphraseFlow } = useViewPassphraseFlow()
    return (
        <>
            <BottomSheetManager />
            <button
                data-testid='open_view_passphrase'
                onClick={() => {
                    void openViewPassphraseFlow(address)
                }}
            >
                Open
            </button>
        </>
    )
}

const seedHdAccountOnEthereum = async (): Promise<WalletAccount> => {
    const account = await seedHdAccount()
    const withEthereum: WalletAccount = {
        ...account,
        chains: {
            ...account.chains,
            ethereum: {
                address: EVM_ADDRESS,
                keyPairId: chainAccountOf(account, 'algorand')?.keyPairId,
            },
        },
    }
    useAccountsStore.getState().setAccounts([withEthereum])
    return withEthereum
}

const seedAlgo25Account = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let key: Algo25KeyResult | null = null
    await act(async () => {
        key = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
    })
    const account: WalletAccount = {
        id: 'algo25',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: key!.seedKey.id ?? '',
            },
        },
        name: 'Algo25',
    }
    useAccountsStore.getState().setAccounts([account])
    return account
}

const openAcknowledgement = async (): Promise<void> => {
    fireEvent.click(screen.getByTestId('open_view_passphrase'))
    await screen.findByTestId('passphrase_acknowledge_bottom_sheet_reveal')
}

const revealWords = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
        fireEvent.click(
            screen.getByTestId(`passphrase_acknowledge_bottom_sheet_row_${i}`),
        )
    }
    const revealButton = () =>
        screen.getByTestId('passphrase_acknowledge_bottom_sheet_reveal')
    await waitFor(() => {
        expect(isElementDisabled(revealButton())).toBe(false)
    })
    fireEvent.click(revealButton())
    await screen.findByTestId(
        'view_passphrase_bottom_sheet_grid',
        {},
        { timeout: SLOW_WAIT_TIMEOUT_MS },
    )
}

describe('Flow: the recovery passphrase names every network it controls', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
    })

    it('Given a Universal Wallet account on Algorand and Ethereum, when the user reveals its passphrase, then both sheets name every network, list each address, and the wallet guide opens over the words', async () => {
        await seedHdAccountOnEthereum()

        render(<ViewPassphraseHost address={HD_TEST_ADDRESS} />)
        await openAcknowledgement()

        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_scope')
                .textContent,
        ).toContain('view_passphrase.acknowledge.scope')
        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_row_1')
                .textContent,
        ).toContain('view_passphrase.acknowledge.row_share_all_networks')
        expect(
            screen.queryByTestId('passphrase_acknowledge_bottom_sheet_row_4'),
        ).toBeNull()

        await revealWords()

        expect(
            screen.getByTestId(
                'view_passphrase_bottom_sheet_reach_algorand_address',
            ).textContent,
        ).toBe(addressCodecs.get('algorand').truncate(HD_TEST_ADDRESS))
        expect(
            screen.getByTestId(
                'view_passphrase_bottom_sheet_reach_ethereum_address',
            ).textContent,
        ).toBe(addressCodecs.get('ethereum').truncate(EVM_ADDRESS))

        fireEvent.click(
            screen.getByTestId('view_passphrase_bottom_sheet_compatibility'),
        )

        expect(
            await screen.findByText('view_passphrase.compatibility.evm'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.compatibility.algorand'),
        ).toBeTruthy()
        expect(
            screen.getByText('view_passphrase.compatibility.warning'),
        ).toBeTruthy()
        expect(
            screen.getByTestId('view_passphrase_bottom_sheet_grid'),
        ).toBeTruthy()
    })

    it('Given an Algo25 account in a multi-network build, when the user reveals its passphrase, then the copy stays Algorand-only with no network list or wallet guide', async () => {
        await seedAlgo25Account()

        render(<ViewPassphraseHost address={ALGO25_TEST_ADDRESS} />)
        await openAcknowledgement()

        expect(
            screen.queryByTestId('passphrase_acknowledge_bottom_sheet_scope'),
        ).toBeNull()
        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_row_1')
                .textContent,
        ).toContain('view_passphrase.acknowledge.row_share')
        expect(
            screen.getByTestId('passphrase_acknowledge_bottom_sheet_row_1')
                .textContent,
        ).not.toContain('row_share_all_networks')

        await revealWords()

        expect(
            screen.queryByTestId('view_passphrase_bottom_sheet_reach'),
        ).toBeNull()
        expect(
            screen.queryByTestId('view_passphrase_bottom_sheet_compatibility'),
        ).toBeNull()
    })
})
