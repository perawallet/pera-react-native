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

import { z } from 'zod'
import { LogicSigAccount } from 'algosdk'
import { sha256 } from '@noble/hashes/sha2.js'
import type {
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    decodeFromBase64,
    encodeToBase64,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { fetchNodeJson } from '../blockchain/utils/nodeHttp'
import { isAlgodNotFoundError } from '../blockchain/utils/algodErrors'

/**
 * NFD's registry application, per network, as published at
 * https://api-docs.nf.domains/reference/on-chain-reference/registry-application-ids
 */
export const NFD_REGISTRY_APP_IDS: Partial<Record<NetworkId, number>> = {
    mainnet: 760_937_186,
    testnet: 84_366_825,
}

// Registry box value: the NFD's ASA id then its application id, each a
// big-endian uint64.
const REGISTRY_BOX_LENGTH = 16
const registryBoxSchema = z.object({ value: z.string() })
const legacyRegistrySchema = z.object({
    'app-local-state': z
        .object({
            id: z.number(),
            'key-value': z
                .array(
                    z.object({
                        key: z.string(),
                        value: z.object({
                            type: z.number(),
                            bytes: z.string().optional(),
                        }),
                    }),
                )
                .optional(),
        })
        .optional(),
})

type RegistryLookup = {
    name: string
    scope: ChainScope
    signal?: AbortSignal
}

type RegistryRecord = { appId: bigint; storage: 'global' | 'boxes' }

// TxnLab's V1 name lookup program has a reserved uint64 for the registry at
// byte 6 and ends in a byte constant block holding the UTF-8 lookup name.
// https://github.com/TxnLab/nfd-cli-examples/blob/main/main.go
const V1_NAME_LOOKUP_PROGRAM =
    'BSABAYAIAQIDBAUGBwgXNQAxGDQAEjEQgQYSEDEZIhIxGYEAEhEQQAABACJDJgE='
const REGISTRY_ID_OFFSET = 6

const legacyLookupAddress = (registryAppId: number, name: string): string => {
    const template = decodeFromBase64(V1_NAME_LOOKUP_PROGRAM)
    new DataView(template.buffer, template.byteOffset).setBigUint64(
        REGISTRY_ID_OFFSET,
        BigInt(registryAppId),
    )
    const nameBytes = new TextEncoder().encode(`name/${name}`)
    const lengthBytes: number[] = []
    let length = nameBytes.length
    while (length >= 128) {
        lengthBytes.push((length % 128) + 128)
        length = Math.floor(length / 128)
    }
    lengthBytes.push(length)
    const program = new Uint8Array(
        template.length + lengthBytes.length + nameBytes.length,
    )
    program.set(template)
    program.set(lengthBytes, template.length)
    program.set(nameBytes, template.length + lengthBytes.length)
    return new LogicSigAccount(program).address().toString()
}

/**
 * The V1 lookup account holds the registry's name mapping for domains
 * registered before box storage that have not migrated.
 */
const fetchLegacyRegistryRecord = async (
    registryAppId: number,
    { name, scope, signal }: RegistryLookup,
): Promise<Nullable<RegistryRecord>> => {
    const address = legacyLookupAddress(registryAppId, name)
    let response: unknown
    try {
        response = await fetchNodeJson(
            scope,
            'algod',
            `/v2/accounts/${address}/applications/${registryAppId}`,
            { signal },
        )
    } catch (error) {
        if (isAlgodNotFoundError(error)) return null
        throw error
    }

    const state = legacyRegistrySchema.parse(response)['app-local-state']
    if (state?.id !== registryAppId) return null
    const appIdEntry = state['key-value']?.find(
        ({ key }) =>
            new TextDecoder().decode(decodeFromBase64(key)) === 'i.appid',
    )
    if (appIdEntry?.value.type !== 1 || !appIdEntry.value.bytes) return null
    const value = decodeFromBase64(appIdEntry.value.bytes)
    if (value.length !== 8) throw new Error('Invalid NFD registry app ID')
    const appId = new DataView(value.buffer, value.byteOffset).getBigUint64(0)
    return appId === 0n ? null : { appId, storage: 'global' }
}

/** Reads the registry's name box first, then the V1 lookup account. */
export const fetchNfdRegistryRecord = async ({
    name,
    scope,
    signal,
}: RegistryLookup): Promise<Nullable<RegistryRecord>> => {
    const registryAppId = NFD_REGISTRY_APP_IDS[scope.networkId]
    if (!registryAppId) {
        throw new Error(`NFD registry not configured for ${scope.networkId}`)
    }

    const boxName = sha256(new TextEncoder().encode(`name/${name}`))
    let response: unknown
    try {
        response = await fetchNodeJson(
            scope,
            'algod',
            `/v2/applications/${registryAppId}/box`,
            { params: { name: `b64:${encodeToBase64(boxName)}` }, signal },
        )
    } catch (error) {
        if (isAlgodNotFoundError(error)) {
            return fetchLegacyRegistryRecord(registryAppId, {
                name,
                scope,
                signal,
            })
        }
        throw error
    }

    const value = decodeFromBase64(registryBoxSchema.parse(response).value)
    if (value.length !== REGISTRY_BOX_LENGTH) {
        throw new Error('NFD registry box has an unexpected length')
    }
    const appId = new DataView(value.buffer, value.byteOffset).getBigUint64(8)
    return appId === 0n ? null : { appId, storage: 'boxes' }
}
