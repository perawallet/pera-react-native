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
import {
    accountPresentationChainAdapters,
    accountsChainAdapters,
} from '@perawallet/wallet-core-accounts'
import { assetsChainAdapters } from '@perawallet/wallet-core-assets'
import { backupChainAdapters } from '@perawallet/wallet-core-backup'
import {
    addressCodecs,
    keyDerivations,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import { migrationChainAdapters } from '@perawallet/wallet-core-migrate'
import { ledgerAppDriverRegistry } from '@perawallet/wallet-extension-hardware-wallet'
import { swapChainAdapters } from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID, registerChain } from '..'
import { algorandDappRequestAdapter } from '../connect'
import {
    historyChainAdapters,
    sendFlowChainAdapters,
} from '@perawallet/wallet-core-transactions'
import {
    algorandHistoryAdapter,
    algorandSendFlowAdapter,
} from '../transactions'
import { nameServiceChainAdapters } from '@perawallet/wallet-core-nfd'
import { algorandLedgerAppDriver } from '../ledger'
import { algorandSwapAdapter } from '../swaps'
import { algorandAssetsAdapter } from '../assets'
import { algorandNameServiceAdapter } from '../nfd'
import { cardChainAdapters } from '@perawallet/wallet-core-card'
import { rampChainAdapters } from '@perawallet/wallet-core-onramp'
import { multisigChainAdapters } from '@perawallet/wallet-core-multisig'
import {
    broadcasterChainAdapters,
    localKeySignerChainAdapters,
    messageSignerChainAdapters,
    plannerChainAdapters,
    reviewerChainAdapters,
} from '@perawallet/wallet-core-signing'
import {
    algorandBroadcasterAdapter,
    algorandLocalKeySignerAdapter,
    algorandMessageSignerAdapter,
    algorandPlannerAdapter,
    algorandReviewerAdapter,
} from '../signing'
import { algorandBackupAdapter, algorandMigrationAdapter } from '../backup'
import { algorandCardAdapter } from '../card'
import { algorandRampAdapter } from '../onramp'
import { algorandMultisigAdapter } from '../multisig'
import { deviceChainAdapters } from '@perawallet/wallet-core-device'
import { algorandDeviceAdapter } from '../device'
import {
    algorandAccountPresentation,
    algorandAccountsAdapter,
    algorandAddressCodec,
    algorandKeyDerivation,
} from '../accounts'

describe('registerChain', () => {
    beforeEach(() => {
        ledgerAppDriverRegistry.reset()
        assetsChainAdapters.reset()
        swapChainAdapters.reset()
        dappRequestChainAdapters.reset()
        sendFlowChainAdapters.reset()
        historyChainAdapters.reset()
        nameServiceChainAdapters.reset()
        cardChainAdapters.reset()
        rampChainAdapters.reset()
        multisigChainAdapters.reset()
        broadcasterChainAdapters.reset()
        reviewerChainAdapters.reset()
        plannerChainAdapters.reset()
        localKeySignerChainAdapters.reset()
        messageSignerChainAdapters.reset()
        addressCodecs.reset()
        keyDerivations.reset()
        accountsChainAdapters.reset()
        accountPresentationChainAdapters.reset()
        backupChainAdapters.reset()
        migrationChainAdapters.reset()
        deviceChainAdapters.reset()
    })

    it('registers the Algorand device adapter', () => {
        registerChain()

        expect(deviceChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandDeviceAdapter,
        )
    })

    it('registers the Algorand accounts adapter, address codec and key derivation', () => {
        registerChain()

        expect(accountsChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandAccountsAdapter,
        )
        expect(addressCodecs.get(ALGORAND_CHAIN_ID)).toBe(algorandAddressCodec)
        expect(keyDerivations.get(ALGORAND_CHAIN_ID)).toBe(
            algorandKeyDerivation,
        )
    })

    it('registers the Algorand account presentation', () => {
        registerChain()

        expect(accountPresentationChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandAccountPresentation,
        )
    })

    it('registers the Algorand assets adapter', () => {
        registerChain()

        expect(assetsChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandAssetsAdapter,
        )
    })

    it('registers the Algorand swap adapter', () => {
        registerChain()

        expect(swapChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandSwapAdapter,
        )
    })

    it('registers the dApp request adapter', () => {
        registerChain()

        expect(dappRequestChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandDappRequestAdapter,
        )
    })

    it('registers the Algorand send-flow adapter', () => {
        registerChain()

        expect(sendFlowChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandSendFlowAdapter,
        )
    })

    it('registers the Algorand reviewer adapter', () => {
        registerChain()

        expect(reviewerChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandReviewerAdapter,
        )
    })

    it('registers the Algorand history adapter', () => {
        registerChain()

        expect(historyChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandHistoryAdapter,
        )
    })

    it('registers the Algorand broadcaster adapter', () => {
        registerChain()

        expect(broadcasterChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandBroadcasterAdapter,
        )
    })

    it('can run more than once, so a repeated bootstrap is harmless', () => {
        expect(() => {
            registerChain()
            registerChain()
        }).not.toThrow()
    })

    it('registers the Algorand Ledger app driver', () => {
        registerChain()

        expect(ledgerAppDriverRegistry.resolve(ALGORAND_CHAIN_ID)).toBe(
            algorandLedgerAppDriver,
        )
    })

    it('registers the Algorand name service adapter', () => {
        registerChain()

        expect(nameServiceChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandNameServiceAdapter,
        )
    })

    it('registers the Algorand card adapter', () => {
        registerChain()

        expect(cardChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandCardAdapter,
        )
    })

    it('registers the Algorand ramp adapter', () => {
        registerChain()

        expect(rampChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandRampAdapter,
        )
    })

    it('registers the Algorand multisig adapter', () => {
        registerChain()

        expect(multisigChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandMultisigAdapter,
        )
    })

    it('registers the Algorand planner adapter', () => {
        registerChain()

        expect(plannerChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandPlannerAdapter,
        )
    })

    it('registers the Algorand local-key signer adapter', () => {
        registerChain()

        expect(localKeySignerChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandLocalKeySignerAdapter,
        )
    })

    it('registers the Algorand backup and migration adapters', () => {
        registerChain()

        expect(backupChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandBackupAdapter,
        )
        expect(migrationChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandMigrationAdapter,
        )
    })

    it('registers the Algorand message signer adapter', () => {
        registerChain()

        expect(messageSignerChainAdapters.get(ALGORAND_CHAIN_ID)).toBe(
            algorandMessageSignerAdapter,
        )
    })
})
