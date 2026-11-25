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
import {
    decodeFromBase64,
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import { encodeAlgorandAddress } from '../blockchain'
import { fetchNodeJson } from '../blockchain/utils/nodeHttp'
import type {
    NameAddressVerification,
    VerifyForwardResolutionParams,
} from '@perawallet/wallet-core-names'
import { fetchNfdRegistryRecord } from './registry'

const NAME_KEY = 'i.name'
const OWNER_KEY = 'i.owner.a'
const VERIFIED_ADDRESSES = /^v\.caAlgo\.\d+\.as$/
const PUBLIC_KEY_LENGTH = 32

const applicationSchema = z.object({
    params: z.object({
        'global-state': z
            .array(
                z.object({
                    key: z.string(),
                    value: z.object({ bytes: z.string().optional() }),
                }),
            )
            .optional(),
    }),
})
const boxesSchema = z.object({
    boxes: z.array(z.object({ name: z.string() })),
})
const boxSchema = z.object({ value: z.string() })

const utf8 = (base64: string): string =>
    new TextDecoder().decode(decodeFromBase64(base64))

const addressesIn = (base64: string): string[] => {
    const bytes = decodeFromBase64(base64)
    if (bytes.length % PUBLIC_KEY_LENGTH !== 0) return []
    const addresses: string[] = []
    for (
        let offset = 0;
        offset + PUBLIC_KEY_LENGTH <= bytes.length;
        offset += PUBLIC_KEY_LENGTH
    ) {
        const publicKey = bytes.subarray(offset, offset + PUBLIC_KEY_LENGTH)
        if (publicKey.some(byte => byte !== 0)) {
            addresses.push(encodeAlgorandAddress(publicKey))
        }
    }
    return addresses
}

/**
 * Checks a name's backend-asserted address against the NFD contracts on chain:
 * the registry contract says which application holds the name, and the name,
 * the owner and the verified addresses are read from that application, so no
 * off-chain service can vouch for an address.
 */
export const verifyNfdAddress = async ({
    name,
    address,
    scope,
    signal,
}: VerifyForwardResolutionParams): Promise<NameAddressVerification> => {
    const normalizedName = name.toLowerCase()
    try {
        const record = await fetchNfdRegistryRecord({
            name: normalizedName,
            scope,
            signal,
        })
        if (record === null) return 'mismatch'
        const { appId, storage } = record

        const application = applicationSchema.parse(
            await fetchNodeJson(scope, 'algod', `/v2/applications/${appId}`, {
                signal,
            }),
        )
        const state = new Map(
            (application.params['global-state'] ?? []).map(entry => [
                utf8(entry.key),
                entry.value.bytes,
            ]),
        )
        const onChainName = state.get(NAME_KEY)
        const owner = state.get(OWNER_KEY)
        // The application must itself carry the name the user typed.
        if (!onChainName || !owner || utf8(onChainName) !== normalizedName) {
            return 'mismatch'
        }

        const trusted = new Set([
            encodeAlgorandAddress(decodeFromBase64(owner)),
        ])
        // A name the registry maps by box has moved to box storage, so any
        // address left in its global state is stale. Boxes are read for every
        // name: a contract can move to boxes before its registry entry does.
        if (storage === 'global') {
            for (const [key, value] of state) {
                if (!value || !VERIFIED_ADDRESSES.test(key)) continue
                for (const verified of addressesIn(value)) trusted.add(verified)
            }
        }
        if (trusted.has(address)) return 'verified'

        const { boxes } = boxesSchema.parse(
            await fetchNodeJson(
                scope,
                'algod',
                `/v2/applications/${appId}/boxes`,
                { signal },
            ),
        )
        for (const box of boxes) {
            if (!VERIFIED_ADDRESSES.test(utf8(box.name))) continue
            const { value } = boxSchema.parse(
                await fetchNodeJson(
                    scope,
                    'algod',
                    `/v2/applications/${appId}/box`,
                    { params: { name: `b64:${box.name}` }, signal },
                ),
            )
            for (const verified of addressesIn(value)) trusted.add(verified)
        }

        return trusted.has(address) ? 'verified' : 'mismatch'
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        logger.warn('NFD verification unavailable', {
            name: normalizedName,
            error: toError(error).message,
        })
        return 'unavailable'
    }
}
