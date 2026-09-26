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

import { ABIType, decodeAddress } from 'algosdk'
import { populateAppCallResources } from '@algorandfoundation/algokit-utils'
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount'
import type { Arc56Contract } from '@algorandfoundation/algokit-utils/types/app-arc56'
import {
    FALLBACK_MIN_TXN_FEE,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { CardEscrowWithdrawals } from '@perawallet/wallet-core-card'
import type { Network } from '@perawallet/wallet-core-shared'
import { cardAlgorandClient } from '../client'
import { isAlgodNotFoundError } from './algod'
import { resolveEscrowChainConfig } from './lsig'
import mainArc56 from './main-arc56.json'

// AppliedBlockchain's W3Card (main) contract. Withdrawal is timelocked and
// two-step: `withdrawalRequest` writes a box under the card address stamped
// with the block time, and `withdraw` releases the funds to the card owner
// once `withdrawal_wait_time` has elapsed since then. Regenerate the vendored
// ARC-56 spec if AB changes the contract.
const MAIN_SPEC = mainArc56 as unknown as Arc56Contract

const WITHDRAWAL_REQUEST_TYPE = ABIType.from(
    '(address,address,uint64,uint64,uint64,uint64)',
)
type WithdrawalRequestTuple = [string, string, bigint, bigint, bigint, bigint]

// The map prefix comes from the spec so a renamed box map fails loudly at
// decode time rather than silently reading as "no pending withdrawal".
const WITHDRAWALS_PREFIX = Uint8Array.from(
    atob(MAIN_SPEC.state.maps.box.withdrawals.prefix ?? ''),
    char => char.charCodeAt(0),
)

// The contract keys `withdrawals` by the requesting owner (`Txn.sender`),
// not by the card, so a card-keyed read always misses the box.
const buildWithdrawalBoxName = (ownerAddress: string): Uint8Array => {
    const name = new Uint8Array(WITHDRAWALS_PREFIX.length + 32)
    name.set(WITHDRAWALS_PREFIX, 0)
    name.set(decodeAddress(ownerAddress).publicKey, WITHDRAWALS_PREFIX.length)
    return name
}

const getAppClient = (network: Network, sender?: string) => {
    const { mainAppId } = resolveEscrowChainConfig(network)
    return cardAlgorandClient(network).client.getAppClientById({
        appId: BigInt(mainAppId),
        appSpec: MAIN_SPEC,
        defaultSender: sender,
    })
}

type AppCallParams = Parameters<
    ReturnType<typeof getAppClient>['params']['call']
>[0]

const buildCall = async (
    network: Network,
    sender: string,
    params: AppCallParams,
): Promise<PeraTransaction[]> => {
    const algokit = cardAlgorandClient(network)
    const appClient = getAppClient(network, sender)
    const composer = algokit.newGroup()
    composer.addAppCallMethodCall(await appClient.params.call(params))
    const { atc } = await composer.build()
    const populated = await populateAppCallResources(atc, algokit.client.algod)
    return populated.buildGroup().map(({ txn }) => txn)
}

export const algorandEscrowWithdrawals: CardEscrowWithdrawals = {
    buildRequest: ({ network, sender, cardAddress, amount }) => {
        const { assetId } = resolveEscrowChainConfig(network)
        return buildCall(network, sender, {
            method: 'withdrawalRequest',
            args: [cardAddress, BigInt(assetId), amount],
            // Named for the same algokit 9.2.x reason as in the Killswitch
            // enable call.
            accountReferences: [cardAddress],
            assetReferences: [BigInt(assetId)],
        })
    },

    buildWithdraw: ({ network, sender, cardAddress, amount }) => {
        const { assetId } = resolveEscrowChainConfig(network)
        return buildCall(network, sender, {
            method: 'withdraw',
            args: [cardAddress, amount],
            accountReferences: [cardAddress],
            assetReferences: [BigInt(assetId)],
            // Pays for the inner asset transfer from the card to the owner.
            extraFee: AlgoAmount.MicroAlgo(Number(FALLBACK_MIN_TXN_FEE)),
        })
    },

    buildCancel: ({ network, sender, cardAddress }) =>
        buildCall(network, sender, {
            method: 'withdrawalCancel',
            args: [cardAddress],
            accountReferences: [cardAddress],
        }),

    getPending: async (network, ownerAddress) => {
        const { mainAppId } = resolveEscrowChainConfig(network)
        try {
            const box = await cardAlgorandClient(network)
                .client.algod.getApplicationBoxByName(
                    BigInt(mainAppId),
                    buildWithdrawalBoxName(ownerAddress),
                )
                .do()
            const [card, recipient, asset, amount, createdAt, nonce] =
                WITHDRAWAL_REQUEST_TYPE.decode(
                    box.value,
                ) as WithdrawalRequestTuple
            return {
                card,
                recipient,
                asset: asset.toString(),
                amount,
                createdAt: Number(createdAt),
                nonce,
            }
        } catch (error) {
            if (isAlgodNotFoundError(error)) return null
            throw error
        }
    },

    getWaitTimeSeconds: async network => {
        const value = await getAppClient(network).state.global.getValue(
            'withdrawal_wait_time',
        )
        return typeof value === 'bigint' ? Number(value) : null
    },
}
