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

import { Decimal } from 'decimal.js'
import { hexToBytes, keccak256, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { createEvmBroadcasterAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/broadcaster'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'
import { getDatabase } from '@perawallet/wallet-core-database'
import { getOpenSubmissionAttempts } from '@perawallet/wallet-core-signing/db/repository'

import {
    createHdEvmAccount,
    createRawKeyEvmAccount,
    fundEvmAccount,
    type EvmConformanceAccount,
} from '../accounts'
import {
    createEvmConformanceEnv,
    createEvmConformanceSession,
    envFor,
    installedKms,
    resetEvmConformanceSession,
    type EvmConformanceEnv,
} from '../context'
import { signTransactionWithApp } from '../sign'

const ONE_ETHER = 10n ** 18n

// Through the broadcaster's own submit-and-record path, so the ledger row is
// written where the app writes it: the database singleton.
const sendAndRecord = async (
    env: EvmConformanceEnv,
    sender: EvmConformanceAccount,
    to: string,
): Promise<Hex> => {
    const [unsigned] = await createEvmTransferAdapter(
        env.ctx,
        env.evmChain,
    ).build(
        {
            kind: 'transfer',
            from: sender.address,
            to,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: new Decimal(1000),
        },
        { scope: env.scope },
    )
    const raw = await signTransactionWithApp(env, sender, unsigned)
    const broadcaster = createEvmBroadcasterAdapter(env.ctx, env.evmChain)
    const [hash] = (await broadcaster.submitAndAutoRefresh(env.scope, [
        { scope: env.scope, id: keccak256(raw), bytes: hexToBytes(raw) },
    ])) as Hex[]
    await broadcaster.waitForConfirmation(env.scope, [hash])
    return hash
}

const openTxIds = async (
    reader: EvmConformanceEnv,
    written: EvmConformanceEnv,
): Promise<string[]> =>
    (
        await getOpenSubmissionAttempts({ db: reader.db, scope: written.scope })
    ).flatMap(attempt => attempt.txIds)

describe('conformance sessions', () => {
    it('shares one keystore and one ledger across chains, as the app does', async () => {
        const session = await createEvmConformanceSession()
        const ethereum = envFor(session, 'ethereum')
        const polygon = envFor(session, 'polygon')
        const onEthereum = await createHdEvmAccount(ethereum)
        const onPolygon = await createHdEvmAccount(polygon)
        const recipient = await createRawKeyEvmAccount(polygon)
        await fundEvmAccount(ethereum, onEthereum.address, ONE_ETHER)
        await fundEvmAccount(polygon, onPolygon.address, ONE_ETHER)

        const ethereumHash = await sendAndRecord(
            ethereum,
            onEthereum,
            recipient.address,
        )
        const polygonHash = await sendAndRecord(
            polygon,
            onPolygon,
            recipient.address,
        )

        expect(getDatabase()).toBe(session.db)
        expect(await openTxIds(polygon, ethereum)).toEqual([ethereumHash])
        expect(await openTxIds(ethereum, polygon)).toEqual([polygonHash])
        expect(session.keyStore.store.state.keys.map(key => key.id)).toEqual(
            expect.arrayContaining([
                onEthereum.keyPairId,
                onPolygon.keyPairId,
                recipient.keyPairId,
            ]),
        )
    })

    it('refuses every read through a retired session', async () => {
        const retired = await createEvmConformanceEnv('ethereum')
        const { kms } = retired

        const current = await createEvmConformanceSession()

        expect(() => retired.db).toThrow(/stale conformance session/)
        expect(() => retired.keyStore).toThrow(/stale conformance session/)
        expect(() => retired.kms).toThrow(/stale conformance session/)
        expect(() => retired.session.db).toThrow(/stale conformance session/)
        await expect(
            kms.sign('any-key', new Uint8Array(32), 'pera.accounts'),
        ).rejects.toThrow(/stale conformance session/)
        await expect(
            retired.ctx.kms.sign(
                'any-key',
                new Uint8Array(32),
                'pera.accounts',
            ),
        ).rejects.toThrow(/stale conformance session/)
        expect(getDatabase()).toBe(current.db)
    })

    it('leaves nothing installed once the session is retired', async () => {
        await createEvmConformanceSession()

        resetEvmConformanceSession()

        expect(() => getDatabase()).toThrow(/not initialized/)
        await expect(
            installedKms.sign('any-key', new Uint8Array(32), 'pera.accounts'),
        ).rejects.toThrow(/no conformance session is installed/)
    })
})
