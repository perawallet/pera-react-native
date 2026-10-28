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

// A link routes by its own chain: the sender, network and capability checks
// come from the chain the link names, never from the selected account's.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { render } from '@test-utils/render'
import { OptInAccountSelectionContent } from '@modules/assets'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { ConnectionsProvider } from '@modules/connections/shell'
import { useDeepLink } from '@modules/deeplink/hooks/useDeepLink'
import { useSendFundsStore } from '@modules/transactions'
import { SendFundsContent } from '@modules/transactions/routes'
import { registerAppBottomSheets } from '../bootstrap/bottom-sheet-registrations'
import { ALGO25_TEST_ADDRESS } from './__fixtures__/onboarding'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// Hardhat accounts #0 and #1, from the public test mnemonic.
const ETHEREUM_SENDER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ALGORAND_RECEIVER =
    'GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A'
const OPT_IN_ASSET_ID = '31566704'

const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: {
        ethereum: { address: ETHEREUM_SENDER_ADDRESS, keyPairId: 'eth-key' },
    },
    name: 'Eth sender',
} as WalletAccount

const ALGORAND_SENDER: WalletAccount = {
    id: 'algo-sender',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'algo-key' },
    },
    name: 'Algo sender',
}

type DeepLinkDispatch = ReturnType<typeof useDeepLink>['handleDeepLink']
const captured: { handleDeepLink: Optional<DeepLinkDispatch> } = {
    handleDeepLink: undefined,
}
const DeepLinkProbe = () => {
    captured.handleDeepLink = useDeepLink().handleDeepLink
    return null
}

const mountDeepLinks = async () => {
    render(
        <ConnectionsProvider>
            <DeepLinkProbe />
        </ConnectionsProvider>,
    )
    await waitFor(() => expect(captured.handleDeepLink).toBeTruthy())
}

const holdAccounts = (accounts: WalletAccount[], selectedId: string) => {
    useAccountsStore.getState().setAccounts(accounts)
    useAccountsStore.getState().setSelectedAccountId(selectedId)
}

const scan = async (url: string) => {
    const onError = vi.fn()
    const onSuccess = vi.fn()
    await captured.handleDeepLink!(url, false, 'qr', onError, onSuccess)
    return { onError, onSuccess }
}

const openedSheets = () =>
    useBottomSheetStore
        .getState()
        .requests.map(request => (request.contents as { type: unknown }).type)

const expectToastTitled = (title: string) =>
    waitFor(() =>
        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({ title }),
        ),
    )

describe('Flow: deeplinks route by their own chain', () => {
    beforeAll(() => {
        registerAppBottomSheets()
    })

    beforeEach(async () => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        await mountDeepLinks()
    })

    describe('Given an Algorand account is selected and an Ethereum account is held', () => {
        beforeEach(() => {
            holdAccounts([ALGORAND_SENDER, ETHEREUM_SENDER], 'algo-sender')
        })

        it('When an ethereum: ether link is scanned, then a prefilled send opens from the Ethereum account', async () => {
            const { onSuccess } = await scan(`ethereum:${RECEIVER}@1?value=1`)

            expect(onSuccess).toHaveBeenCalledTimes(1)
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                'eth-sender',
            )
            const send = useSendFundsStore.getState()
            expect(send.selectedAsset).toEqual({
                chainId: 'ethereum',
                assetId: 'native',
            })
            expect(send.chainId).toBe('ethereum')
            expect(send.destination).toBe(RECEIVER)
            expect(openedSheets()).toEqual([SendFundsContent])
        })

        it('When an ERC-20 transfer link is scanned, then a prefilled token send opens from the Ethereum account', async () => {
            await scan(
                `ethereum:${TOKEN}@1/transfer?address=${RECEIVER}&uint256=12500000`,
            )

            expect(useAccountsStore.getState().selectedAccountId).toBe(
                'eth-sender',
            )
            const send = useSendFundsStore.getState()
            expect(send.selectedAsset).toEqual({
                chainId: 'ethereum',
                assetId: TOKEN,
            })
            expect(send.destination).toBe(RECEIVER)
            expect(openedSheets()).toEqual([SendFundsContent])
        })

        it('When a link names a network other than the selected one, then it shows the network error and opens nothing', async () => {
            const { onError } = await scan(
                `ethereum:${RECEIVER}@11155111?value=1`,
            )

            expect(onError).toHaveBeenCalledTimes(1)
            expect(openedSheets()).toEqual([])
            expect(useAccountsStore.getState().selectedAccountId).toBe(
                'algo-sender',
            )
            await expectToastTitled('deeplink.error.title_network_mismatch')
        })

        it('When an Algorand transfer link is scanned, then the send opens from the Algorand account as before', async () => {
            await scan(`algorand://${ALGORAND_RECEIVER}?amount=1000`)

            expect(useAccountsStore.getState().selectedAccountId).toBe(
                'algo-sender',
            )
            const send = useSendFundsStore.getState()
            expect(send.selectedAsset).toEqual({
                chainId: 'algorand',
                assetId: '0',
            })
            expect(send.chainId).toBe('algorand')
            expect(send.destination).toBe(ALGORAND_RECEIVER)
            expect(openedSheets()).toEqual([SendFundsContent])
        })

        it('When an Algorand opt-in link is scanned, then the Algorand account picker opens as before', async () => {
            await scan(`perawallet://?amount=0&asset=${OPT_IN_ASSET_ID}`)

            await waitFor(() =>
                expect(openedSheets()).toEqual([OptInAccountSelectionContent]),
            )
        })
    })

    describe('Given an Ethereum account is selected', () => {
        beforeEach(() => {
            holdAccounts([ALGORAND_SENDER, ETHEREUM_SENDER], 'eth-sender')
        })

        it('When an Algorand account-detail link is scanned, then the Algorand account it names is selected as before', async () => {
            await scan(
                `perawallet://app/account-detail/?address=${ALGO25_TEST_ADDRESS}`,
            )

            expect(useAccountsStore.getState().selectedAccountId).toBe(
                'algo-sender',
            )
        })
    })

    describe('Given only an Algorand account is held', () => {
        beforeEach(() => {
            holdAccounts([ALGORAND_SENDER], 'algo-sender')
        })

        it('When an ethereum: link is scanned, then it shows the no-account error and opens nothing', async () => {
            const { onError } = await scan(`ethereum:${RECEIVER}@1?value=1`)

            expect(onError).toHaveBeenCalledTimes(1)
            expect(openedSheets()).toEqual([])
            expect(useSendFundsStore.getState().destination).toBeUndefined()
            await expectToastTitled('deeplink.error.title_no_account')
        })
    })
})
