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

import { parseTransaction } from 'viem'
import { describe, expect, it } from 'vitest'
import {
    buildEthereumSendTransaction,
    validateEthereumSendTransaction,
    type EthereumSendTransactionSession,
} from '@perawallet/wallet-core-chain-ethereum/connect/sendTransaction'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import {
    ANVIL_DEV_PRIVATE_KEY,
    castCall,
    castCalldata,
    castSend,
} from '../../harness/cast'
import { deployContract } from '../../harness/contracts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET } from '../../harness/evmnet'
import { signTransactionWithApp } from '../../harness/sign'
import { broadcastAndConfirm } from '../../harness/submit'

const FOREIGN = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'

const sessionOf = (
    authorizedAccounts: readonly string[],
): EthereumSendTransactionSession => ({
    authorizedAccounts,
    eip155ChainId: EVMNET.ethereum.eip155ChainId,
})

const hex = (value: number): string => `0x${value.toString(16)}`

/**
 * Proves the dApp-facing `eth_sendTransaction` rules hold: a request is
 * refused unless it names an account of the session and the active chain with
 * a well-formed value, and an accepted one is built, signed by the app and
 * mined by a real node as the dApp asked, with the sender recovered from the
 * bytes. The session is the one the WalletConnect adapter derives: the
 * authorized accounts and the active network's EIP-155 id.
 */
describe('evm dapp sendTransaction validation', () => {
    describe('refusals', () => {
        const held = '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
        const valid = { from: held, to: RECIPIENT, value: '0x1' }

        it('accepts the valid request, checksumming from and to', () => {
            const result = validateEthereumSendTransaction(
                {
                    ...valid,
                    from: held.toLowerCase(),
                    to: RECIPIENT.toLowerCase(),
                },
                sessionOf([held]),
            )

            expect(result).toEqual({
                ok: true,
                request: { from: held, to: RECIPIENT, value: 1n, data: '0x' },
            })
        })

        it.each([
            ['a from outside the session', { from: FOREIGN }],
            ['a missing from', { from: undefined }],
            ['a from that is not an address', { from: '0x1234' }],
        ])('refuses %s as an unauthorized account', (_label, override) => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, ...override },
                    sessionOf([held]),
                ),
            ).toEqual({
                ok: false,
                failure: 'unauthorized-account',
                message: 'The from address is not an account of this session',
            })
        })

        it('refuses every from when the session authorizes no account', () => {
            expect(
                validateEthereumSendTransaction(valid, sessionOf([])),
            ).toMatchObject({ ok: false, failure: 'unauthorized-account' })
        })

        it.each([
            ['polygon', hex(EVMNET.polygon.eip155ChainId)],
            ['mainnet ethereum', '0x1'],
            ['a decimal string', String(EVMNET.ethereum.eip155ChainId)],
            ['a non-string', EVMNET.ethereum.eip155ChainId],
        ])('refuses a chainId of %s', (_label, chainId) => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, chainId },
                    sessionOf([held]),
                ),
            ).toEqual({
                ok: false,
                failure: 'invalid-params',
                message: 'The chainId is not the active chain',
            })
        })

        it('refuses any chainId when the active network has no EIP-155 id', () => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, chainId: hex(EVMNET.ethereum.eip155ChainId) },
                    { authorizedAccounts: [held], eip155ChainId: undefined },
                ),
            ).toMatchObject({
                ok: false,
                message: 'The chainId is not the active chain',
            })
        })

        it('accepts the active chain id', () => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, chainId: hex(EVMNET.ethereum.eip155ChainId) },
                    sessionOf([held]),
                ),
            ).toMatchObject({ ok: true })
        })

        it.each([
            ['negative hex', '-0x1'],
            ['a negative decimal', '-1'],
            ['a decimal string', '100'],
            ['bare 0x', '0x'],
            ['non-hex digits', '0xzz'],
            ['a number', 1],
            ['a bigint', 1n],
            ['above uint256', `0x1${'0'.repeat(64)}`],
        ])('refuses a value of %s', (_label, value) => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, value },
                    sessionOf([held]),
                ),
            ).toEqual({
                ok: false,
                failure: 'invalid-params',
                message: 'The value is not a valid quantity',
            })
        })

        it('accepts the largest uint256 value', () => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, value: `0x${'f'.repeat(64)}` },
                    sessionOf([held]),
                ),
            ).toMatchObject({ ok: true })
        })

        it.each([
            ['a missing to', { to: undefined }],
            ['a to that is not an address', { to: '0x12' }],
        ])(
            'refuses %s: contract creation is not supported',
            (_label, override) => {
                expect(
                    validateEthereumSendTransaction(
                        { ...valid, ...override },
                        sessionOf([held]),
                    ),
                ).toEqual({
                    ok: false,
                    failure: 'invalid-params',
                    message:
                        'A transaction needs a to address; contract creation is not supported',
                })
            },
        )

        it.each([
            ['an EIP-4844 blob field', { blobVersionedHashes: [] }],
            ['an EIP-7702 authorization list', { authorizationList: [] }],
            ['an EIP-4844 type', { type: '0x3' }],
            ['an EIP-7702 type', { type: '0x4' }],
        ])('refuses %s', (_label, override) => {
            expect(
                validateEthereumSendTransaction(
                    { ...valid, ...override },
                    sessionOf([held]),
                ),
            ).toMatchObject({ ok: false, failure: 'invalid-params' })
        })

        it('refuses calldata that is odd-length or that disagrees between data and input', () => {
            for (const override of [
                { data: '0xabc' },
                { data: '0xab', input: '0xcd' },
            ]) {
                expect(
                    validateEthereumSendTransaction(
                        { ...valid, ...override },
                        sessionOf([held]),
                    ),
                ).toMatchObject({ ok: false, failure: 'invalid-params' })
            }
        })

        it('ignores the nonce and fees a dApp supplies', () => {
            const result = validateEthereumSendTransaction(
                {
                    ...valid,
                    nonce: '0x99',
                    maxFeePerGas: '0xffffffffffff',
                    maxPriorityFeePerGas: '0xffffffffffff',
                },
                sessionOf([held]),
            )

            expect(result).toEqual({
                ok: true,
                request: { from: held, to: RECIPIENT, value: 1n, data: '0x' },
            })
        })
    })

    it('builds, signs and lands an accepted ERC-20 transfer exactly as the dApp asked', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const account = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, account.address, 10n ** 18n)
        const token = await deployContract(
            env.chain,
            'TestToken',
            ['Conformance Token', 'CFT', (10n ** 30n).toString()],
            'constructor(string,string,uint256)',
        )
        const amount = 9_007_199_254_740_993n * 1000n
        await castSend({
            chain: env.chain,
            privateKey: ANVIL_DEV_PRIVATE_KEY,
            to: token,
            sig: 'transfer(address,uint256)',
            args: [account.address, amount.toString()],
        })
        const data = await castCalldata('transfer(address,uint256)', [
            RECIPIENT,
            amount.toString(),
        ])
        const gas = 100_000n

        const validated = validateEthereumSendTransaction(
            {
                from: account.address.toLowerCase(),
                to: token,
                data,
                gas: `0x${gas.toString(16)}`,
                chainId: hex(EVMNET.ethereum.eip155ChainId),
                // A dApp's own price and nonce must not reach the signature.
                nonce: '0x7',
                maxFeePerGas: '0x1',
            },
            sessionOf([account.address]),
        )
        if (!validated.ok) throw new Error(validated.message)

        const unsigned = await buildEthereumSendTransaction(
            env.ctx,
            env.evmChain,
            validated.request,
        )
        const raw = await signTransactionWithApp(env, account, unsigned)
        const parsed = parseTransaction(raw) as {
            maxFeePerGas: bigint
            maxPriorityFeePerGas: bigint
            nonce: number
        }
        // Gas price is the wallet's own choice; only its sanity is checked.
        expect(parsed.maxFeePerGas).toBeGreaterThanOrEqual(
            parsed.maxPriorityFeePerGas,
        )
        expect(parsed.maxFeePerGas).toBeGreaterThan(1n)
        const { hash } = await broadcastAndConfirm(env, raw)

        // Round-trip: the node holds the dApp's call, from the wallet's account.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: account.address,
                nonce: 0,
                to: token,
                data,
                gas,
                maxFeePerGas: parsed.maxFeePerGas,
                maxPriorityFeePerGas: parsed.maxPriorityFeePerGas,
            },
            raw,
            hash,
        })
        const balance = (
            await castCall({
                chain: env.chain,
                to: token,
                sig: 'balanceOf(address)(uint256)',
                args: [RECIPIENT],
            })
        ).split(' ')[0]
        expect(BigInt(balance)).toBe(amount)
    })
})
