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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { getAddress, maxUint160, maxUint256, maxUint48 } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createEvmMessageSignerAdapter,
    typedDataMessageRequest,
} from '../messages'
import {
    DAI_PERMIT_TYPED_DATA,
    EIP2612_PERMIT_TYPED_DATA,
    ERC721_PERMIT_TYPED_DATA,
    MAIL_TYPED_DATA,
    PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_BATCH_TYPED_DATA,
    PERMIT2_BATCH_WITNESS_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_SINGLE_TYPED_DATA,
    PERMIT2_SINGLE_UNLIMITED_TYPED_DATA,
    PERMIT2_TRANSFER_FROM_TYPED_DATA,
    PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA,
    PERMIT_NOW_MS,
    PERMIT_POSITIONS,
    PERMIT_SPENDER,
    PERMIT_USDC,
    PERMIT_WETH,
    SENDER,
} from './fixtures'
import { ETHEREUM } from '../../__tests__/evm-chains'

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const DAY_MS = 24 * 60 * 60 * 1000
const USDC = getAddress(PERMIT_USDC)
const WETH = getAddress(PERMIT_WETH)

const describeTyped = (typedData: unknown) =>
    createEvmMessageSignerAdapter(ETHEREUM).describe(
        typedDataMessageRequest(MAINNET, SENDER, typedData),
    )

const asset = (assetId: string, amount?: string) => ({
    assetRef: { chainId: 'ethereum', assetId },
    ...(amount !== undefined && { amount: new Decimal(amount) }),
})

// A deep copy, so a vector can edit the fixture it starts from.
const edit = <T>(fixture: T, change: (copy: any) => void): T => {
    const copy = structuredClone(fixture)
    change(copy)
    return copy
}

describe('spend approval recognition', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(PERMIT_NOW_MS)
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('reads a PermitSingle and keeps the plain tree', () => {
        const summary = describeTyped(PERMIT2_SINGLE_TYPED_DATA)

        expect(summary.spendApproval).toEqual({
            spender: getAddress(PERMIT_SPENDER),
            allowances: [asset(USDC, '1000000')],
            deadline: 1769817600000,
            isLongLived: false,
        })
        expect(summary.tree?.map(node => node.label)).toEqual([
            'domain',
            'message',
        ])
    })

    it('leaves the amount off an unlimited PermitSingle', () => {
        const approval = describeTyped(
            PERMIT2_SINGLE_UNLIMITED_TYPED_DATA,
        ).spendApproval

        expect(approval?.allowances).toEqual([asset(USDC)])
        expect(approval?.allowances[0]).not.toHaveProperty('amount')
    })

    it('uses the signature deadline when a PermitSingle expiration is 0', () => {
        const typed = edit(PERMIT2_SINGLE_TYPED_DATA, copy => {
            copy.message.details.expiration = '0'
            copy.message.sigDeadline = '1767312000'
        })

        expect(describeTyped(typed).spendApproval?.deadline).toBe(1767312000000)
    })

    it('lists a PermitBatch in message order, ending at the latest expiration', () => {
        const approval = describeTyped(PERMIT2_BATCH_TYPED_DATA).spendApproval

        expect(approval?.allowances).toEqual([
            asset(USDC, '1000000'),
            asset(WETH, '1000000'),
        ])
        expect(approval?.deadline).toBe(1772409600000)
    })

    it('treats a PermitBatch with one never-expiring entry as never expiring', () => {
        const typed = edit(PERMIT2_BATCH_TYPED_DATA, copy => {
            copy.message.details[1].expiration = maxUint48.toString()
        })

        const approval = describeTyped(typed).spendApproval

        expect(approval).toBeDefined()
        expect(approval).not.toHaveProperty('deadline')
        expect(approval?.isLongLived).toBe(true)
    })

    it('reads a PermitTransferFrom, with hex amounts and unlimited as maxUint256', () => {
        const hex = edit(PERMIT2_TRANSFER_FROM_TYPED_DATA, copy => {
            copy.message.permitted.amount = '0xf4240'
        })
        const unlimited = edit(PERMIT2_TRANSFER_FROM_TYPED_DATA, copy => {
            copy.message.permitted.amount = maxUint256.toString()
        })

        expect(
            describeTyped(PERMIT2_TRANSFER_FROM_TYPED_DATA).spendApproval,
        ).toEqual({
            spender: getAddress(PERMIT_SPENDER),
            allowances: [asset(USDC, '1000000')],
            deadline: 1769817600000,
            isLongLived: false,
        })
        expect(describeTyped(hex).spendApproval?.allowances).toEqual([
            asset(USDC, '1000000'),
        ])
        expect(describeTyped(unlimited).spendApproval?.allowances).toEqual([
            asset(USDC),
        ])
    })

    it('reads a PermitBatchTransferFrom and rejects an empty batch', () => {
        const empty = edit(PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA, copy => {
            copy.message.permitted = []
        })

        expect(
            describeTyped(PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA).spendApproval
                ?.allowances,
        ).toEqual([asset(USDC, '1000000'), asset(WETH, '1000000')])
        expect(describeTyped(empty)).not.toHaveProperty('spendApproval')
    })

    it('rejects a PermitBatch with no details', () => {
        const empty = edit(PERMIT2_BATCH_TYPED_DATA, copy => {
            copy.message.details = []
        })

        expect(describeTyped(empty)).not.toHaveProperty('spendApproval')
    })

    it.each([
        [
            'PermitWitnessTransferFrom',
            PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA,
            PERMIT2_TRANSFER_FROM_TYPED_DATA,
        ],
        [
            'PermitBatchWitnessTransferFrom',
            PERMIT2_BATCH_WITNESS_TRANSFER_FROM_TYPED_DATA,
            PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA,
        ],
    ])(
        'reads a %s like its plain twin and still shows the witness',
        (_name, witnessed, plain) => {
            const summary = describeTyped(witnessed)

            expect(summary.spendApproval).toEqual(
                describeTyped(plain).spendApproval,
            )
            const message = summary.tree?.find(node => node.label === 'message')
            expect(message).toMatchObject({
                children: expect.arrayContaining([
                    expect.objectContaining({ label: 'witness' }),
                ]),
            })
        },
    )

    it('reads an EIP-2612 Permit from the token that verifies it', () => {
        const asNumber = edit(EIP2612_PERMIT_TYPED_DATA, copy => {
            copy.message.value = 1000000
        })
        const unlimited = edit(EIP2612_PERMIT_TYPED_DATA, copy => {
            copy.message.value = maxUint256.toString()
        })

        expect(describeTyped(EIP2612_PERMIT_TYPED_DATA).spendApproval).toEqual({
            spender: getAddress(PERMIT_SPENDER),
            allowances: [asset(USDC, '1000000')],
            deadline: 1769817600000,
            isLongLived: false,
        })
        expect(describeTyped(asNumber).spendApproval?.allowances).toEqual([
            asset(USDC, '1000000'),
        ])
        expect(describeTyped(unlimited).spendApproval?.allowances).toEqual([
            asset(USDC),
        ])
    })

    it('reads a DAI-style Permit with allowed true as an unlimited allowance to the spender, its expiry the deadline', () => {
        expect(describeTyped(DAI_PERMIT_TYPED_DATA).spendApproval).toEqual({
            spender: getAddress(PERMIT_SPENDER),
            allowances: [
                asset(
                    getAddress(DAI_PERMIT_TYPED_DATA.domain.verifyingContract),
                ),
            ],
            deadline: 1769817600000,
            isLongLived: false,
        })
    })

    it('reads a DAI-style Permit with expiry 0 as never expiring', () => {
        const typed = edit(DAI_PERMIT_TYPED_DATA, copy => {
            copy.message.expiry = '0'
        })

        const approval = describeTyped(typed).spendApproval

        expect(approval).toBeDefined()
        expect(approval).not.toHaveProperty('deadline')
        expect(approval?.isLongLived).toBe(true)
    })

    it.each([false, 'true'])(
        'adds no approval to a DAI-style Permit unless allowed is true (%s)',
        allowed => {
            const typed = edit(DAI_PERMIT_TYPED_DATA, copy => {
                copy.message.allowed = allowed
            })

            expect(describeTyped(typed)).not.toHaveProperty('spendApproval')
        },
    )

    it('reads an ERC-721 Permit as access to that token id for the spender', () => {
        expect(describeTyped(ERC721_PERMIT_TYPED_DATA).spendApproval).toEqual({
            spender: getAddress(PERMIT_SPENDER),
            allowances: [
                {
                    assetRef: {
                        chainId: 'ethereum',
                        assetId: `${getAddress(PERMIT_POSITIONS)}/123456`,
                    },
                    amount: new Decimal(1),
                },
            ],
            deadline: 1769817600000,
            isLongLived: false,
        })
    })

    it('treats amounts of max uint160 and above as unlimited', () => {
        const nearMax = edit(PERMIT2_TRANSFER_FROM_TYPED_DATA, copy => {
            copy.message.permitted.amount = (maxUint160 + 5n).toString()
        })

        expect(describeTyped(nearMax).spendApproval?.allowances).toEqual([
            asset(USDC),
        ])
    })

    it('flags a deadline more than a year out as long-lived', () => {
        const typed = edit(EIP2612_PERMIT_TYPED_DATA, copy => {
            copy.message.deadline = String(PERMIT_NOW_MS / 1000 + 400 * 86400)
        })

        expect(describeTyped(typed).spendApproval).toMatchObject({
            deadline: PERMIT_NOW_MS + 400 * DAY_MS,
            isLongLived: true,
        })
    })

    it('reads a max uint256 deadline as no deadline', () => {
        const typed = edit(EIP2612_PERMIT_TYPED_DATA, copy => {
            copy.message.deadline = maxUint256.toString()
        })

        const approval = describeTyped(typed).spendApproval

        expect(approval).toBeDefined()
        expect(approval).not.toHaveProperty('deadline')
        expect(approval?.isLongLived).toBe(true)
    })

    it('reads a max uint48 expiration as no deadline', () => {
        const typed = edit(PERMIT2_SINGLE_TYPED_DATA, copy => {
            copy.message.details.expiration = maxUint48.toString()
        })

        const approval = describeTyped(typed).spendApproval

        expect(approval).toBeDefined()
        expect(approval).not.toHaveProperty('deadline')
    })

    describe('lookalikes', () => {
        const lookalikes: [string, unknown][] = [
            [
                'a PermitSingle on another contract',
                edit(PERMIT2_SINGLE_TYPED_DATA, copy => {
                    copy.domain.verifyingContract =
                        MAIL_TYPED_DATA.domain.verifyingContract
                }),
            ],
            [
                'a PermitTransferFrom on the USDC domain',
                edit(PERMIT2_TRANSFER_FROM_TYPED_DATA, copy => {
                    copy.domain.verifyingContract = PERMIT_USDC
                }),
            ],
            [
                'a Permit with no verifyingContract',
                edit(EIP2612_PERMIT_TYPED_DATA, copy => {
                    delete copy.domain.verifyingContract
                }),
            ],
            [
                'a DAI-style Permit with allowed typed uint256',
                edit(DAI_PERMIT_TYPED_DATA, copy => {
                    copy.types.Permit[4].type = 'uint256'
                }),
            ],
            [
                'an ERC-721 Permit with tokenId and nonce swapped',
                edit(ERC721_PERMIT_TYPED_DATA, copy => {
                    const { Permit } = copy.types
                    ;[Permit[1], Permit[2]] = [Permit[2], Permit[1]]
                }),
            ],
            [
                'an ERC-721 Permit with no verifyingContract',
                edit(ERC721_PERMIT_TYPED_DATA, copy => {
                    delete copy.domain.verifyingContract
                }),
            ],
            [
                'an ERC-721 Permit whose tokenId is past uint256',
                edit(ERC721_PERMIT_TYPED_DATA, copy => {
                    copy.message.tokenId = (maxUint256 + 1n).toString()
                }),
            ],
            [
                'a Permit with an extra field',
                edit(EIP2612_PERMIT_TYPED_DATA, copy => {
                    copy.types.Permit.push({ name: 'memo', type: 'string' })
                    copy.message.memo = 'hi'
                }),
            ],
            [
                'a Permit with two fields swapped',
                edit(EIP2612_PERMIT_TYPED_DATA, copy => {
                    const { Permit } = copy.types
                    ;[Permit[3], Permit[4]] = [Permit[4], Permit[3]]
                }),
            ],
            [
                'PermitDetails.amount typed uint256',
                edit(PERMIT2_SINGLE_TYPED_DATA, copy => {
                    copy.types.PermitDetails[1].type = 'uint256'
                }),
            ],
            [
                'a PermitWitnessTransferFrom with only the four base fields',
                edit(PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA, copy => {
                    copy.types.PermitWitnessTransferFrom.pop()
                }),
            ],
            [
                'a PermitWitnessTransferFrom with two extra fields',
                edit(PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA, copy => {
                    copy.types.PermitWitnessTransferFrom.push({
                        name: 'extra',
                        type: 'uint256',
                    })
                    copy.message.extra = '1'
                }),
            ],
            [
                'Mail on the Permit2 domain',
                {
                    ...MAIL_TYPED_DATA,
                    domain: PERMIT2_SINGLE_TYPED_DATA.domain,
                },
            ],
        ]

        it.each(lookalikes)(
            '%s gets the plain tree and no approval',
            (_n, typed) => {
                const summary = describeTyped(typed)

                expect(summary.kind).toBe('typed-data')
                expect(summary).not.toHaveProperty('spendApproval')
            },
        )
    })

    it('adds nothing to typed data that is not a permit', () => {
        expect(describeTyped(MAIL_TYPED_DATA)).not.toHaveProperty(
            'spendApproval',
        )
    })
})
