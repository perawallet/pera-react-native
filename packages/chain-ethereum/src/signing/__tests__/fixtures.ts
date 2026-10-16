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

import { bytesToHex, hexToBytes, maxUint160 } from 'viem'
import type { Hex, TransactionSerializableEIP1559 } from 'viem'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainKeyStore } from '@perawallet/wallet-core-chain-contract'

/** Hardhat #0, the key the vectors below were made with. */
export const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

export const TRANSFER: TransactionSerializableEIP1559 = {
    type: 'eip1559',
    chainId: 1,
    nonce: 0,
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    value: 10n ** 18n,
    gas: 21000n,
    maxFeePerGas: 20_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
}

// The EIP-712 specification's "Ether Mail" example.
export const MAIL_TYPED_DATA = {
    domain: {
        name: 'Ether Mail',
        version: '1',
        chainId: 1,
        verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
    },
    types: {
        Person: [
            { name: 'name', type: 'string' },
            { name: 'wallet', type: 'address' },
        ],
        Mail: [
            { name: 'from', type: 'Person' },
            { name: 'to', type: 'Person' },
            { name: 'contents', type: 'string' },
        ],
    },
    primaryType: 'Mail',
    message: {
        from: {
            name: 'Cow',
            wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
        },
        to: {
            name: 'Bob',
            wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
        },
        contents: 'Hello, Bob!',
    },
} as const

// 2026-01-01T00:00:00Z. The permit fixtures' deadlines are relative to it.
export const PERMIT_NOW_MS = 1_767_225_600_000

// Addresses are lowercase and uints are decimal strings, the way a dApp's JSON
// arrives, so every vector also exercises checksumming and string parsing.
export const PERMIT_SPENDER = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'
export const PERMIT_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
export const PERMIT_WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
export const PERMIT2_ADDRESS = '0x000000000022d473030f116ddee9f6b43ac78ba3'
/** 30 and 60 days after `PERMIT_NOW_MS`, in Unix seconds. */
export const PERMIT_DEADLINE_30D = '1769817600'
export const PERMIT_DEADLINE_60D = '1772409600'

const PERMIT2_DOMAIN = {
    name: 'Permit2',
    chainId: 1,
    verifyingContract: PERMIT2_ADDRESS,
}
const PERMIT_DETAILS_TYPE = [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
]
const TOKEN_PERMISSIONS_TYPE = [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
]
const permitDetails = (token: string, expiration = PERMIT_DEADLINE_30D) => ({
    token,
    amount: '1000000',
    expiration,
    nonce: '0',
})
const tokenPermissions = (token: string) => ({ token, amount: '1000000' })

export const EIP2612_PERMIT_TYPED_DATA = {
    domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 1,
        verifyingContract: PERMIT_USDC,
    },
    types: {
        Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
        ],
    },
    primaryType: 'Permit',
    message: {
        owner: SENDER,
        spender: PERMIT_SPENDER,
        value: '1000000',
        nonce: '0',
        deadline: PERMIT_DEADLINE_30D,
    },
}

export const PERMIT2_SINGLE_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitSingle: [
            { name: 'details', type: 'PermitDetails' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: PERMIT_DETAILS_TYPE,
    },
    primaryType: 'PermitSingle',
    message: {
        details: permitDetails(PERMIT_USDC),
        spender: PERMIT_SPENDER,
        sigDeadline: PERMIT_DEADLINE_30D,
    },
}

export const PERMIT2_SINGLE_UNLIMITED_TYPED_DATA = {
    ...PERMIT2_SINGLE_TYPED_DATA,
    message: {
        ...PERMIT2_SINGLE_TYPED_DATA.message,
        details: {
            ...PERMIT2_SINGLE_TYPED_DATA.message.details,
            amount: maxUint160.toString(),
        },
    },
}

export const PERMIT2_BATCH_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitBatch: [
            { name: 'details', type: 'PermitDetails[]' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
        ],
        PermitDetails: PERMIT_DETAILS_TYPE,
    },
    primaryType: 'PermitBatch',
    message: {
        details: [
            permitDetails(PERMIT_USDC),
            permitDetails(PERMIT_WETH, PERMIT_DEADLINE_60D),
        ],
        spender: PERMIT_SPENDER,
        sigDeadline: PERMIT_DEADLINE_60D,
    },
}

const transferFromTail = [
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
]
const transferFromMessage = {
    spender: PERMIT_SPENDER,
    nonce: '0',
    deadline: PERMIT_DEADLINE_30D,
}
// Permit2's own test witness.
const WITNESS_TYPE = [
    { name: 'value', type: 'uint256' },
    { name: 'person', type: 'address' },
    { name: 'test', type: 'bool' },
]
const witness = { value: '42', person: PERMIT_SPENDER, test: true }

export const PERMIT2_TRANSFER_FROM_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitTransferFrom: [
            { name: 'permitted', type: 'TokenPermissions' },
            ...transferFromTail,
        ],
        TokenPermissions: TOKEN_PERMISSIONS_TYPE,
    },
    primaryType: 'PermitTransferFrom',
    message: { permitted: tokenPermissions(PERMIT_USDC), ...transferFromMessage },
}

export const PERMIT2_BATCH_TRANSFER_FROM_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitBatchTransferFrom: [
            { name: 'permitted', type: 'TokenPermissions[]' },
            ...transferFromTail,
        ],
        TokenPermissions: TOKEN_PERMISSIONS_TYPE,
    },
    primaryType: 'PermitBatchTransferFrom',
    message: {
        permitted: [
            tokenPermissions(PERMIT_USDC),
            tokenPermissions(PERMIT_WETH),
        ],
        ...transferFromMessage,
    },
}

export const PERMIT2_WITNESS_TRANSFER_FROM_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitWitnessTransferFrom: [
            { name: 'permitted', type: 'TokenPermissions' },
            ...transferFromTail,
            { name: 'witness', type: 'MockWitness' },
        ],
        TokenPermissions: TOKEN_PERMISSIONS_TYPE,
        MockWitness: WITNESS_TYPE,
    },
    primaryType: 'PermitWitnessTransferFrom',
    message: {
        permitted: tokenPermissions(PERMIT_USDC),
        ...transferFromMessage,
        witness,
    },
}

export const PERMIT2_BATCH_WITNESS_TRANSFER_FROM_TYPED_DATA = {
    domain: PERMIT2_DOMAIN,
    types: {
        PermitBatchWitnessTransferFrom: [
            { name: 'permitted', type: 'TokenPermissions[]' },
            ...transferFromTail,
            { name: 'witness', type: 'MockWitness' },
        ],
        TokenPermissions: TOKEN_PERMISSIONS_TYPE,
        MockWitness: WITNESS_TYPE,
    },
    primaryType: 'PermitBatchWitnessTransferFrom',
    message: {
        permitted: [
            tokenPermissions(PERMIT_USDC),
            tokenPermissions(PERMIT_WETH),
        ],
        ...transferFromMessage,
        witness,
    },
}

// Hardhat account #0 (`m/44'/60'/0'/0/0` of `test test test test test test
// test test test test test junk`). This package's tests may not hold a
// secp256k1 key (see `firewall.spec.ts`), so the key store answers from
// signatures generated with viem's `sign`, keyed by the digest they sign.
export const KMS_SIGNATURES: Record<Hex, Hex> = {
    '0x82afed965c7aa87b5689c5eb049f2b77e23ae7819f6e081b8a3198c1ed5195f8':
        '0x0a3a2646d4ad968bb56317fdb15e17fb4d9deec0d03e8b6cb05e7125bda3006d26618ad17cc63cf1979ca75f850c536a073ec88ab1ab7c8db8b8eb129499d9ae01',
    '0xf2eee62b3b68eff7c15e0808683e7762c85051cceebe641f4b77b026788a98c1':
        '0x082e76302cca13d703850329a812776dd29a70054c6f17ee6a5dff9cfad917cd6bb6ba4e6095246f7cbb722eec394bc5d8b4617bb1d9cb2a9dbdf953d95bd28b00',
    '0xd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68':
        '0xa461f509887bd19e312c0c58467ce8ff8e300d3c1a90b608a760c5b80318eaf15fe57c96f9175d6cd4daad4663763baa7e78836e067d0163e9a2ccf2ff753f5b00',
    '0x8921f2eb8a76968e7210d7a56c38b3acf933ccc72e8c50db48cc55aaf1a6fe0d':
        '0xe04588d881d59ef43990fd1bdd2e05bce76c3052620432089e1d632b6d4bc3884930cf24da1dda4ff05d7dffee6605f6ab807db2cfe2ff01dd73054883b6e81601',
    '0xbe609aee343fb3c4b28e1df9e632fca64fcfaede20f02e86244efddf30957bd2':
        '0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a00',
}

// viem's own `signTransaction` output for `TRANSFER` under the same key; never
// derived from the vectors above.
export const VIEM_TRANSFER_NONCE_0 =
    '0x02f8730180843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c001a00a3a2646d4ad968bb56317fdb15e17fb4d9deec0d03e8b6cb05e7125bda3006da026618ad17cc63cf1979ca75f850c536a073ec88ab1ab7c8db8b8eb129499d9ae'
export const VIEM_TRANSFER_NONCE_2 =
    '0x02f8730102843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c080a0082e76302cca13d703850329a812776dd29a70054c6f17ee6a5dff9cfad917cda06bb6ba4e6095246f7cbb722eec394bc5d8b4617bb1d9cb2a9dbdf953d95bd28b'

// viem's own `signMessage` and `signTypedData` output under the same key as the
// transaction vectors above; never derived from them.
export const VIEM_HELLO_WORLD =
    '0xa461f509887bd19e312c0c58467ce8ff8e300d3c1a90b608a760c5b80318eaf15fe57c96f9175d6cd4daad4663763baa7e78836e067d0163e9a2ccf2ff753f5b1b'
export const VIEM_PERA =
    '0xe04588d881d59ef43990fd1bdd2e05bce76c3052620432089e1d632b6d4bc3884930cf24da1dda4ff05d7dffee6605f6ab807db2cfe2ff01dd73054883b6e8161c'
export const VIEM_MAIL =
    '0x6ea8bb309a3401225701f3565e32519f94a0ea91a5910ce9229fe488e773584c0390416a2190d9560219dab757ecca2029e63fa9d1c2aebf676cc25b9f03126a1b'

export const SIGNER_KEY_PAIR_ID = 'kms-entry-1'

export const ETHEREUM_SIGNER_ACCOUNT: WalletAccount = {
    id: 'eth-signer',
    custody: { kind: 'local', seed: null },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
}

/** The key store's `r‖s‖recovery` signature over `digest`, synchronously. */
export const vectorSignature = (digest: Uint8Array): Uint8Array => {
    const signature = KMS_SIGNATURES[bytesToHex(digest)]
    if (!signature) throw new Error(`no vector for ${bytesToHex(digest)}`)
    return hexToBytes(signature)
}

export type SignCall = {
    keyPairId: string
    payload: Uint8Array
    domain: string
}

export const createVectorKeyStore = (
    override?: (digest: Hex) => Uint8Array | undefined,
) => {
    const calls: SignCall[] = []
    const kms: Pick<ChainKeyStore, 'sign'> = {
        sign: async (keyPairId, payload, domain) => {
            calls.push({ keyPairId, payload, domain })
            const digest = bytesToHex(payload)
            const overridden = override?.(digest)
            if (overridden) return overridden
            const signature = KMS_SIGNATURES[digest]
            if (!signature) throw new Error(`no vector for ${digest}`)
            return hexToBytes(signature)
        },
    }
    return { kms, calls }
}
