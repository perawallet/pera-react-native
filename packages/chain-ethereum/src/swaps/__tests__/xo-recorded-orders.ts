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

/** One XO v4 order answer, cut to what the wallet's check reads. `amount` is in whole units of `fromAsset`. */
export type XoRecordedOrder = {
    name: string
    id: string
    pairId: string
    fromAsset: string
    amount: string
    fromAddress: string
    payInAddress: string
    unsignedTransactions: readonly string[]
}

/**
 * Live `POST /v4/orders` answers of XO's staging server (https://exchange-server-s.exodus.io), recorded
 * 2026-11-19 for the public Hardhat #0 address and never funded. Every one is a single legacy transaction to the
 * order's own `payInAddress`: a token `transfer` or a plain native send, for exactly the amount.
 */
export const XO_RECORDED_ORDERS: readonly XoRecordedOrder[] = [
    {
        name: 'USDC_TO_ETH',
        id: 'xmdPlwZL7Lj5w0J',
        pairId: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48_eip155:1/slip44:60',
        fromAsset: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '10',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0xa2ed3dd4cd507038bf9b665dffab760a1aaf3fb0',
        unsignedTransactions: [
            '0xf869808408442014830186a094a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb000000000000000000000000a2ed3dd4cd507038bf9b665dffab760a1aaf3fb00000000000000000000000000000000000000000000000000000000000989680018080',
        ],
    },
    {
        name: 'USDT_TO_ETH',
        id: 'yZoD8JaRDRelL61',
        pairId: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7_eip155:1/slip44:60',
        fromAsset: 'eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        amount: '25',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x01fd3ba7634c2ebbfa0e5ebb065f5e421d1e3b5a',
        unsignedTransactions: [
            '0xf869808408442014830186a094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb00000000000000000000000001fd3ba7634c2ebbfa0e5ebb065f5e421d1e3b5a00000000000000000000000000000000000000000000000000000000017d7840018080',
        ],
    },
    {
        name: 'USDC_TO_USDT',
        id: 'oz3G8arMXMyNKjp',
        pairId: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48_eip155:1/erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
        fromAsset: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '20',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0xef952a5b9e4831ade4e3cd1fe3f6a36f99d0a4af',
        unsignedTransactions: [
            '0xf869808408442014830186a094a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb000000000000000000000000ef952a5b9e4831ade4e3cd1fe3f6a36f99d0a4af0000000000000000000000000000000000000000000000000000000001312d00018080',
        ],
    },
    {
        name: 'ETH_TO_USDC',
        id: 'vA2PNXPbdbPNBeO',
        pairId: 'eip155:1/slip44:60_eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        fromAsset: 'eip155:1/slip44:60',
        amount: '0.01',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x6325a350cc03f0eaea95e48d451abee958f78b2f',
        unsignedTransactions: [
            '0xeb808408442014830186a0946325a350cc03f0eaea95e48d451abee958f78b2f872386f26fc1000080018080',
        ],
    },
    {
        name: 'ETH_TO_BASE_ETH',
        id: 'Gb0D8dgWmWQl3eE',
        pairId: 'eip155:1/slip44:60_eip155:8453/slip44:60',
        fromAsset: 'eip155:1/slip44:60',
        amount: '0.02',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x2d0bf57fd86e23747854aba95c7184e7288b63fd',
        unsignedTransactions: [
            '0xeb808408442014830186a0942d0bf57fd86e23747854aba95c7184e7288b63fd87470de4df82000080018080',
        ],
    },
    {
        name: 'ETH_TO_ALGO',
        id: 'ROzE5p4vEvL5J1n',
        pairId: 'eip155:1/slip44:60_algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/slip44:283',
        fromAsset: 'eip155:1/slip44:60',
        amount: '0.02',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x5f7e5d6d5602138aa62a8b48907034e6201f6254',
        unsignedTransactions: [
            '0xeb808408442014830186a0945f7e5d6d5602138aa62a8b48907034e6201f625487470de4df82000080018080',
        ],
    },
    {
        name: 'USDC_TO_ALGO',
        id: 'vj29NZVvpv6NZ34',
        pairId: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48_algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/slip44:283',
        fromAsset: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '20',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x84401d8f3a7418739a421fc08b6095f1bcc1f821',
        unsignedTransactions: [
            '0xf869808408442014830186a094a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb00000000000000000000000084401d8f3a7418739a421fc08b6095f1bcc1f8210000000000000000000000000000000000000000000000000000000001312d00018080',
        ],
    },
    {
        name: 'BASE_ETH_TO_ETH',
        id: 'vmPY5qWJ0J48V6G',
        pairId: 'eip155:8453/slip44:60_eip155:1/slip44:60',
        fromAsset: 'eip155:8453/slip44:60',
        amount: '0.02',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x28c2d94e31a71024e9ef245f38925fde0a5bf615',
        unsignedTransactions: [
            '0xec80837704c0830186a09428c2d94e31a71024e9ef245f38925fde0a5bf61587470de4df820000808221058080',
        ],
    },
    {
        name: 'BSC_BNB_TO_ETH',
        id: '92GVlKgRvRZloYW',
        pairId: 'eip155:56/slip44:60_eip155:1/slip44:60',
        fromAsset: 'eip155:56/slip44:60',
        amount: '0.05',
        fromAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        payInAddress: '0x6f0aa7949ee26ede998df7874b75d9101b393ac4',
        unsignedTransactions: [
            '0xeb80844d7c6d00830186a0946f0aa7949ee26ede998df7874b75d9101b393ac487b1a2bc2ec5000080388080',
        ],
    },
]
