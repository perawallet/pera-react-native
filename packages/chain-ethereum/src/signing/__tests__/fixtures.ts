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

import {
    bytesToHex,
    encodeFunctionData,
    erc20Abi,
    hexToBytes,
    maxUint160,
} from 'viem'
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

// USDC `transfer(0x7099…79C8, 1_000_000)`; the calldata is what makes the
// Ledger app ask for clear-signing descriptors.
export const ERC20_TRANSFER: TransactionSerializableEIP1559 = {
    ...TRANSFER,
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    value: 0n,
    data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 1_000_000n],
    }),
    gas: 65_000n,
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
    message: {
        permitted: tokenPermissions(PERMIT_USDC),
        ...transferFromMessage,
    },
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
    '0x3d5f8596f420e506cd72a92f8a0af2f1b751a8629c2accc5e233a1367b7b3b20':
        '0x14a151566889e31a834bcd323d90eba083c2f0010965b909f5969a4481405d2b312ebb7f7c50c4546a4d991d990c7252bed307533bccf21a11f57c1849bd964701',
    // TRANSFER, TRANSFER at nonce 2 and MAIL_TYPED_DATA with each other EVM
    // chain's mainnet EIP-155 id, under the same key.
    // base transfer
    '0xcd30e5ba35ec0fa305fb08c6a491c190db5a6e10aad0c470bb55faf0d641b699':
        '0x1f4c7a27c862b5c6491cdfa74108d050f14f25cb2c2c34a62440d2930518828b57497b1c5316254f4b8bccaedef491792843ab60c3f2c53311ecfb33c6501c9701',
    // base transfer nonce 2
    '0xb764bd7a0054c596591c4cb0cafe68ad3173df5dfd19e9d9d34def18844c5ca8':
        '0x153181bf9fc340e06e1891320c0669b1cfc186936a0cb32bed5dd678f5c99c4a4c2c3025f92cdb64ef9e9405f6e6cf56c15dcfa404ed6bebed9d833da3f7311a01',
    // base mail
    '0x6361fda818e7527caf77cc52f008e23c7f65c25022526b5c810ee0200697d077':
        '0x7a9a465518eaae8e8ecbd3e05302e8b2f243d19f14de312351862aacc3ba5e3f29fddd28dc5e286540d426b0f5895050cbc2aa0e0f4b49f7fc5adfaadb8dc4a100',
    // bsc transfer
    '0xa0863e77dfed7911e880f71aefde2f3359c79cfe1f56cb56196d12404e52a935':
        '0x81e431946154415f3c717b584a609c75bab665a208bd3fc12423ef3bbf2b1bf1568776a85a69514283f06ac3b37c52fd2908019c5437f60105fb4223bbd11cbd00',
    // bsc transfer nonce 2
    '0x84c15287735a0fa932291df7852d3336dacbfa4e992b05331891ba61c60aa32a':
        '0x95d6d54f0b2340514b9b47e680fbdff9ef4a965922c7ffffba0241677e087dd66e64513f2301b6480a2efd7151438b2c7d86efa38f374f0aac5c0437f979e6cd00',
    // bsc mail
    '0xab5db08a8789e7c5039f4434957ad58354b02823bfe1aabd03e5ece5fec24b2b':
        '0xa350a9ff50f72496f82abd99ee31bcaf10e8cf3e57801d2182423b59db664da4437342affb4970799597356b362ef7c0f53cb6a93c96ffd381a78d1cf7e97b5500',
    // arbitrum transfer
    '0x572c3c4b20c6596487aef6f98a3c469098310f617a8a732a638e826f4c01d5bb':
        '0x751defbb01154137934157f248b531880526b50dfa99924440ebc2102c2f414411af2166f3ff7e214f0ff55c6a67bae98fc0220c607ce63c4cf7e0f232ad991b01',
    // arbitrum transfer nonce 2
    '0x0eb223b6a21e4f3dcb80a457a5d1e27fce5a957eabae30c3125568e3be4044d0':
        '0xf44dfc0237cd8cb13eea95e3bf895e6ee08cefcc01141b069ee2a902b7eea10f5531fc6087bd72f63dff3dee13de42b824fe94e34db9c54248233df168fe496000',
    // arbitrum mail
    '0xace1a94f0779822806a57f3e2e668dcaf570ce64ceb4f4dbe7c3b9eaadb0fa61':
        '0xfbf382353166eadb229ac192564d4dd0cc77bf9fabed50d6a46447cbae03ff387ffeeb9886c56fa8369f209e3eec170c595391fbe472eb887d7e3d16352ff0c801',
    // avalanche transfer
    '0x7b76649bc24be0df7da1ffbcb0310d24d197ff6d7aec4af814e4dfb80cca9f54':
        '0x4218e5c53b0a858d11e3760f526d761f15da4a6c36cb33f008e8ca003ee72c5d3cc4d9a06755efaa8a095367abfc2957ca7f6b66dbfd96e53577395f11d5374000',
    // avalanche transfer nonce 2
    '0x1d9c658917b0387fe50b763f1e9c1fd1f5e7db17da9ec5bb3ec38a7dd1a6233a':
        '0x3a75221f949b41dde33226f47b09ac5fbff16527fd7478050fd4ae64ef101ea456d7382afebcb395aaef6d7ad8ed55877451c1461b6d66ae3c4b78aa66cc09f401',
    // avalanche mail
    '0x58b9e28dca96648f9ca1d257b97bfd3936f9efec07340c32b6ed181dabf16e9d':
        '0xfb3ce77b166aa4fb1b4e68e32677cb83ae10c2f3e44fc87af355d6b41674781259b81e776e8f155d021ef21d40bfe72ee4fb07edd7122a75bd54f5447bad7f3001',
    // polygon transfer
    '0xc59a42a2c52c505e63ccbd5f1eafd024bbcabe3a2f8a94ac1b97a053b8baa5f1':
        '0x35ba0cffe9f3923ec952ed6f17ec35b4e1d74309fc10c046b7dac1755f6975166fe4f628619d940c1553f411c0340e2bd0787e753636b090fa6f23516b889c1000',
    // polygon transfer nonce 2
    '0x25bca1008e2c6106cd7aa9b12273b6188150299a1bd8d169604003fcb35c16ba':
        '0xf594953ed48481e326f342fce671405fda49dc5d57e4354d1509aee416ac946261c4a9296683e6e34fe5c6e9a78002cb41810f020c8fad722d6a4a83c45f8f0e00',
    // polygon mail
    '0x53e341aefc7641107dbb3d5af2a67709d7132f5cc532d728b2b610bf1e4ba72e':
        '0x7f3268561a9475c865d78bd7dea415d439938bb29b53d9a77362f1c631052a0c027aa98b6682fc2092e5b341e9893d281c75d585e4123e5f132480e25c740bab00',
}

// viem's own `signTransaction` output for `TRANSFER` and `ERC20_TRANSFER` under
// the same key; never derived from the vectors above.
export const VIEM_TRANSFER_NONCE_0 =
    '0x02f8730180843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c001a00a3a2646d4ad968bb56317fdb15e17fb4d9deec0d03e8b6cb05e7125bda3006da026618ad17cc63cf1979ca75f850c536a073ec88ab1ab7c8db8b8eb129499d9ae'
export const VIEM_TRANSFER_NONCE_2 =
    '0x02f8730102843b9aca008504a817c8008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c080a0082e76302cca13d703850329a812776dd29a70054c6f17ee6a5dff9cfad917cda06bb6ba4e6095246f7cbb722eec394bc5d8b4617bb1d9cb2a9dbdf953d95bd28b'
// `TRANSFER` again at nonce 0, re-priced: 22 gwei and a 1.1 gwei tip is exactly
// the 10% bump a node needs to replace it; 21 gwei falls short on the max fee.
export const VIEM_TRANSFER_NONCE_0_SPED_UP =
    '0x02f8730180844190ab0085051f4d5c008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c001a0e3cc2ebc4f7e0207292797e483ff1aa92368ec2eb8cc8709af52e89265e391faa0586b538366df6cb76c2bbbdb0955d449d5648381a00f5e1c90c9c2ba0db11d2d'
export const VIEM_TRANSFER_NONCE_0_UNDERPRICED =
    '0x02f8730180844190ab008504e3b292008252089470997970c51812dc3a010c7d01b50e0d17dc79c8880de0b6b3a764000080c080a0827cf6d80ee78f38360fb9a15902a83fee02ba0bca2b424ca8a223516ef10530a07fc905870f1cd8a2e8606bb4e2d96cd05ba1074188aee19b1d00a6ae1f2f9ab9'
export const VIEM_ERC20_TRANSFER =
    '0x02f8b00180843b9aca008504a817c80082fde894a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4880b844a9059cbb00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000000f4240c001a014a151566889e31a834bcd323d90eba083c2f0010965b909f5969a4481405d2ba0312ebb7f7c50c4546a4d991d990c7252bed307533bccf21a11f57c1849bd9647'

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
