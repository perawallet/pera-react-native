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

// An NFT send from an Ethereum account: the transfer adapter builds the
// standard's safeTransferFrom against the NFT contract, and the reviewer proves
// it from the calldata, so it signs without a contract-call review.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { Notifier } from 'react-native-notifier'

import {
    insertAssetHolding,
    upsertAccountChainState,
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    nativeAssetFor,
    PeraAssetType,
    PeraAssetVerificationTier,
    upsertAssets,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    DEFAULT_EVM_RPC_RESPONSES,
    EvmRpcErrorFixture,
    evmNftItem,
    evmRpcHandlers,
    peraEvmHandlers,
    type EvmRpcFixtures,
} from '@perawallet/wallet-core-chain-ethereum/test-handlers'
import { kmsCore, SeedScheme } from '@perawallet/wallet-core-kms'
import { getPendingTransactionRecords } from '@perawallet/wallet-core-transactions'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { findEnabledByTestId } from '@test-utils/rnw'
import {
    resetTestDatabase,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import { CollectibleDetailScreen } from '@modules/assets/routes'
import { useSendFundsStore } from '@modules/transactions'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'

const RPC_URL = 'https://mainnet.rpc.test/'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
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
                ? { mainnet: RPC_URL, sepolia: RPC_URL }
                : actual.chainEndpointsFor(chainId),
    }
})

const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// Hardhat accounts #0 and #1, from the public test mnemonic.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const APE_CONTRACT = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
const APE_ID = `${APE_CONTRACT}/1234`
const ITEM_CONTRACT = '0x76BE3b62873462d2142405439777e971754E8E77'
const ITEM_ID = `${ITEM_CONTRACT}/10`

// safeTransferFrom(SENDER, RECEIVER, 1234) and
// safeTransferFrom(SENDER, RECEIVER, 10, 2, '0x'), checked against viem's
// encodeFunctionData with erc721Abi / erc1155Abi. Hard-coded because viem
// isn't an apps/mobile dependency.
const ERC721_CALLDATA =
    '42842e0e000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000000004d2'
const ERC1155_CALLDATA =
    'f242432a000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000'

// An HD account, so its signing scheme resolves without the keystore loading
// the key.
const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: {
        kind: 'local',
        seed: SeedScheme.Bip39,
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: 'eth-key' } },
    name: 'Eth sender',
}

// Signatures Hardhat #0 made over these exact digests, in r‖s‖recovery. The RPC
// fixture defaults make each build deterministic; a digest missing here means
// the build changed and the signature must be regenerated.
const SENDER_SIGNATURES: Record<string, string> = {
    // Bored Ape #1234 to RECEIVER.
    '85487ed74070e3916feb7f7994d442301fb814c58cb91a931130f9e62f3c53d5':
        'ac02abd699d9db4ad01df23e6876ca4be98c7955812c52bc9a9a5c251455719e75285226625e1355f0bc9fed1e6ee130ac1e11b30b3801862bd2b20334af75b801',
    // 2 of Item #10 to RECEIVER.
    ae5eb72e291f323fae8d9d90474a40b0c8ce19cbb1e57673808b21e040a20346:
        '5315bee1dd46fc7fdfea28da09900036e3739a135dbd03eb38d053494c96a15f1adc4f5ee6db7237f73d660b81382fb6d937f7462f398e34755451dba14d86a101',
}
const signWithSenderKey = async (_keyPairId: string, digest: Uint8Array) => {
    const hex = Buffer.from(digest).toString('hex')
    const signature = SENDER_SIGNATURES[hex]
    if (!signature) throw new Error(`No fixture signature for digest ${hex}`)
    return Uint8Array.from(Buffer.from(signature, 'hex'))
}

const nftAsset = ({
    assetId,
    contract,
    standard,
    name,
    collection,
}: {
    assetId: string
    contract: string
    standard: 'erc721' | 'erc1155'
    name: string
    collection: string
}): PeraAsset => ({
    assetId,
    name,
    unitName: collection.slice(0, 4).toUpperCase(),
    decimals: 0,
    totalSupply: new Decimal(0),
    creator: { address: contract },
    peraMetadata: {
        isDeleted: false,
        verificationTier: PeraAssetVerificationTier.verified,
        type: PeraAssetType.collectible,
        isUnique: standard === 'erc721',
        logo: null,
        collectible: {
            title: name,
            standard,
            mediaType: 'image',
            collection: { name: collection },
            traits: [],
            media: [],
        },
    },
})

const seedNfts = async () => {
    await upsertAssets({
        items: [
            nativeAssetFor('ethereum'),
            nftAsset({
                assetId: APE_ID,
                contract: APE_CONTRACT,
                standard: 'erc721',
                name: 'Bored Ape #1234',
                collection: 'Bored Ape Yacht Club',
            }),
            nftAsset({
                assetId: ITEM_ID,
                contract: ITEM_CONTRACT,
                standard: 'erc1155',
                name: 'Item #10',
                collection: 'Items',
            }),
        ],
        scope: ETH_SCOPE,
    })
    await insertAssetHolding({
        accountAddress: SENDER,
        assetId: APE_ID,
        scope: ETH_SCOPE,
        amount: new Decimal(1),
    })
    await insertAssetHolding({
        accountAddress: SENDER,
        assetId: ITEM_ID,
        scope: ETH_SCOPE,
        amount: new Decimal(3),
    })
    await upsertAccountChainState({
        accountAddress: SENDER,
        scope: ETH_SCOPE,
        nativeBalance: new Decimal('10000000000000000000'),
        chainData: { family: 'evm', nonce: { latest: 0, pending: 0 } },
    })
}

const prefillSend = (assetId: string, amount: number) => {
    useSendFundsStore
        .getState()
        .setSelectedAsset({ chainId: 'ethereum', assetId })
    useSendFundsStore.getState().setAmount(new Decimal(amount))
    useSendFundsStore.getState().setDestination(RECEIVER)
    useSendFundsStore.getState().setSendMode('normal')
}

const renderSendConfirmationStack = () =>
    renderWithNavigation(TransactionConfirmationScreen, 'ConfirmTransaction', {
        additionalScreens: [
            {
                name: 'TransactionProcessing',
                component: TransactionProcessingScreen,
            },
            {
                name: 'TransactionSuccess',
                component: TransactionSuccessScreen,
            },
        ],
    })

const confirmSend = async () => {
    await findEnabledByTestId('send_confirm_button', { timeout: 5000 })
    // Confirm waits on the balance, fee and recipient reads; press until it answers.
    await waitFor(
        () => {
            // A press that lands navigates away, so the button may be gone.
            const confirmButton = screen.queryByTestId('send_confirm_button')
            if (confirmButton) fireEvent.click(confirmButton)
            expect(kmsCore.sign).toHaveBeenCalled()
        },
        { timeout: 5000 },
    )
    await waitFor(
        () => expect(screen.getByTestId('send_success')).toBeTruthy(),
        { timeout: 10_000 },
    )
}

const sentRecord = async () => {
    const [record] = await getPendingTransactionRecords({
        address: SENDER,
        scope: ETH_SCOPE,
        listedIds: new Set(),
    })
    return record
}

describe('Flow: send an NFT from an Ethereum account', () => {
    const sentRawTransactions: string[] = []

    const useRpc = (responses: NonNullable<EvmRpcFixtures['responses']> = {}) =>
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC_URL,
                responses: {
                    eth_sendRawTransaction: params => {
                        sentRawTransactions.push(params[0] as string)
                        const respond =
                            DEFAULT_EVM_RPC_RESPONSES.eth_sendRawTransaction
                        return typeof respond === 'function'
                            ? respond(params)
                            : respond
                    },
                    ...responses,
                },
            }),
        )

    beforeAll(async () => {
        await setupTestDatabase()
    })

    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedNfts()
        useAccountsStore.getState().setAccounts([ETHEREUM_SENDER])
        useAccountsStore.getState().setSelectedAccountId(ETHEREUM_SENDER.id)
        useAccountChainStateStore.getState().resetState()
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        sentRawTransactions.length = 0
        vi.spyOn(kmsCore, 'sign').mockImplementation(signWithSenderKey)
        server.use(
            ...peraEvmHandlers({
                nfts: {
                    [`eip155:1/erc721:${APE_CONTRACT.toLowerCase()}/1234`]:
                        evmNftItem(),
                },
            }),
        )
        useRpc()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('Given the sender holds an ERC-721, when its detail screen opens, then Send is offered', async () => {
        renderWithNavigation(CollectibleDetailScreen, 'CollectibleDetails', {
            initialParams: { assetId: APE_ID, chainId: 'ethereum' },
        })

        await waitFor(
            () =>
                expect(
                    screen.queryAllByText(
                        (_, node) =>
                            (node?.textContent ?? '') === 'common.send',
                    ).length,
                ).toBeGreaterThan(0),
            { timeout: 5000 },
        )
    })

    it('Given an ERC-721 send, when the user confirms, then safeTransferFrom to the NFT contract reaches the node without a contract-call review', async () => {
        prefillSend(APE_ID, 1)

        renderSendConfirmationStack()
        // The amount row shows the NFT itself and no fiat value beside it:
        // the amount is followed directly by the network chip.
        await waitFor(() =>
            expect(
                screen.getByTestId('send_confirm_network')
                    .previousElementSibling?.textContent,
            ).toMatch(/BORE1$/),
        )
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        const raw = sentRawTransactions[0].toLowerCase()
        expect(raw).toContain(APE_CONTRACT.toLowerCase().slice(2))
        expect(raw).toContain(ERC721_CALLDATA)
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'nft-transfer',
            counterparty: RECEIVER,
            subtitle: {
                key: 'transactions.list_item.nft_subtitle',
                params: { collection: 'Bored Ape Yacht Club', tokenId: '1234' },
            },
            amount: {
                assetRef: { chainId: 'ethereum', assetId: APE_ID },
                value: new Decimal(1),
            },
        })
    })

    it('Given 2 of an ERC-1155 holding of 3, when the user confirms, then safeTransferFrom of 2 reaches the node', async () => {
        prefillSend(ITEM_ID, 2)

        renderSendConfirmationStack()
        await confirmSend()

        expect(sentRawTransactions).toHaveLength(1)
        expect(sentRawTransactions[0].toLowerCase()).toContain(ERC1155_CALLDATA)
        expect((await sentRecord())?.summary).toMatchObject({
            kind: 'nft-transfer',
            amount: { value: new Decimal(2) },
        })
    })

    it('Given a recipient that reverts the gas estimate, when the user confirms, then the fee error shows and nothing is signed', async () => {
        useRpc({
            eth_estimateGas: new EvmRpcErrorFixture(
                3,
                'execution reverted: ERC721: transfer to non ERC721Receiver implementer',
            ),
        })
        prefillSend(APE_ID, 1)

        renderSendConfirmationStack()
        await screen.findByTestId('send_confirm_button', {}, { timeout: 5000 })
        await waitFor(() => {
            fireEvent.click(screen.getByTestId('send_confirm_button'))
            expect(Notifier.showNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'send_funds.confirmation.fee_unavailable.title',
                }),
            )
        })

        expect(screen.queryByTestId('send_success')).toBeNull()
        expect(kmsCore.sign).not.toHaveBeenCalled()
        expect(sentRawTransactions).toHaveLength(0)
    })
})
