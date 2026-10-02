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

// Other clients restore these exact bytes: a change here is a change to the
// backup wire contract, never a test update. Keys are HMAC'd with an item key
// of 32 × 0x01, and `payload` is the canonical JSON that gets encrypted.

export type GoldenItem = { key: string; type: string; payload: string }

export const GOLDEN_UPDATED_AT = 1719300000000

export const GOLDEN_MNEMONIC = 'abandon ability able'

export const GOLDEN_HD = {
    seedFirstDerivedAddress: 'HDFIRSTADDR',
    publicKeyHex: 'aabb',
    seedHex: 'ccdd',
    entropyHex: 'eeff',
}

export const GOLDEN_ACCOUNT_ITEMS = {
    algo25: [
        {
            key: 'accounts/49682d2215944da6b39a9f4b48dac923ba8decca3907201c8027c6130f63e75b',
            type: 'ACCOUNT',
            payload:
                '{"address":"ALGO25ADDR","customName":"Main","type":"algo25","updatedAt":1719300000000}',
        },
        {
            key: 'secrets/49682d2215944da6b39a9f4b48dac923ba8decca3907201c8027c6130f63e75b',
            type: 'ACCOUNT',
            payload:
                '{"address":"ALGO25ADDR","mnemonic":"abandon ability able","type":"algo25"}',
        },
    ],
    quantum: [
        {
            key: 'accounts/1b1dfc1602a20925036d8e9c20577d7e6fc3c046c4651b4b66ae76048351f049',
            type: 'ACCOUNT',
            payload:
                '{"address":"QUANTUMADDR","customName":"Quantum","type":"quantum","updatedAt":1719300000000}',
        },
        {
            key: 'secrets/1b1dfc1602a20925036d8e9c20577d7e6fc3c046c4651b4b66ae76048351f049',
            type: 'ACCOUNT',
            payload:
                '{"address":"QUANTUMADDR","mnemonic":"abandon ability able","type":"quantum"}',
        },
    ],
    watch: [
        {
            key: 'accounts/097a8eb3fbce322e2b79155f38e869da4a760089406d50978855a9c1c9d86723',
            type: 'ACCOUNT',
            payload:
                '{"address":"WATCHADDR","customName":null,"type":"watch","updatedAt":1719300000000}',
        },
    ],
    hardware: [
        {
            key: 'accounts/11cc0a9231573736e1ead754a4515ff020fe55ca2bbd9fa6d3b4992d07ab2d53',
            type: 'ACCOUNT',
            payload:
                '{"accountIndex":2,"address":"LEDGERADDR","customName":"Ledger","deviceId":"ble-1","deviceName":"Ledger Nano X","manufacturer":"ledger","transportType":"ble","type":"hardware","updatedAt":1719300000000}',
        },
    ],
    multisig: [
        {
            key: 'accounts/fae4808c87c35caf1522823c48a7eaa1452ee241c9871417ec19e47a2d4d5633',
            type: 'ACCOUNT',
            payload:
                '{"address":"MSIGADDR","customName":"Shared","participantAddresses":["MEMBERA","MEMBERB"],"threshold":1,"type":"multisig","updatedAt":1719300000000,"version":1}',
        },
    ],
    hdWallet: [
        {
            key: 'accounts/93e0cbc720a1b0a76c96de12cb3631ab80e24aa839f27e1d65cec09689ed28fc',
            type: 'ACCOUNT',
            payload:
                '{"account":0,"address":"HDCHILDADDR","change":0,"customName":"Child 1","derivationType":9,"keyIndex":1,"publicKey":"aabb","seedFirstDerivedAddress":"HDFIRSTADDR","type":"hdWallet","updatedAt":1719300000000}',
        },
        {
            key: 'secrets/005f4ba4d5215ccd4693df161b41c6ff2140a42b9c75666ec626872a62326db7',
            type: 'ACCOUNT',
            payload:
                '{"address":"HDFIRSTADDR","entropy":"eeff","seed":"ccdd","type":"hdSeed"}',
        },
    ],
} as const satisfies Record<string, readonly GoldenItem[]>
