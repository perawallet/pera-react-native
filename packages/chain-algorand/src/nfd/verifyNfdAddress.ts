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
    Networks,
    queryClient,
    type Network,
} from '@perawallet/wallet-core-shared'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import type {
    NfdAddressVerification,
    VerifyForwardResolutionParams,
} from '@perawallet/wallet-core-nfd'
import { fetchNfdAppId } from './registry'

// NFD contract (v2) layout: the name and owner sit in global state; verified
// addresses live in `v.caAlgo.<n>.as` boxes as back-to-back 32-byte keys.
const NAME_KEY = 'i.name'
const OWNER_KEY = 'i.owner.a'
const VERIFIED_BOX = /^v\.caAlgo\.\d+\.as$/
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
    const addresses: string[] = []
    for (
        let offset = 0;
        offset + PUBLIC_KEY_LENGTH <= bytes.length;
        offset += PUBLIC_KEY_LENGTH
    ) {
        addresses.push(
            encodeAlgorandAddress(
                bytes.subarray(offset, offset + PUBLIC_KEY_LENGTH),
            ),
        )
    }
    return addresses
}

const algodGet = async (
    network: Network,
    url: string,
    params: object | undefined,
    signal: AbortSignal | undefined,
): Promise<unknown> => {
    const response = await queryClient<unknown>({
        backend: 'algod',
        network,
        method: 'GET',
        url,
        params,
        signal,
    })
    return response.data
}

// Algorand's network ids are the legacy `Network` values (see
// scopeForLegacyNetwork), so anything else is a scope this chain never issued.
const toNetwork = (networkId: string): Network => {
    const network = Object.values(Networks).find(value => value === networkId)
    if (!network) throw new Error(`Not an Algorand network: ${networkId}`)
    return network
}

/**
 * Checks a name's backend-asserted address against the NFD contract itself.
 * The registry only says which application holds the name; the name, the
 * owner and the verified addresses are read from that application on chain,
 * so neither Pera's backend nor the registry can vouch for an address.
 */
export const verifyNfdAddress = async ({
    name,
    address,
    scope,
    signal,
}: VerifyForwardResolutionParams): Promise<NfdAddressVerification> => {
    const normalizedName = name.toLowerCase()
    try {
        const network = toNetwork(scope.networkId)
        const appId = await fetchNfdAppId({
            name: normalizedName,
            network,
            signal,
        })
        if (appId === null) return 'mismatch'

        const application = applicationSchema.parse(
            await algodGet(
                network,
                `/v2/applications/${appId}`,
                undefined,
                signal,
            ),
        )
        const state = new Map(
            (application.params['global-state'] ?? []).map(entry => [
                utf8(entry.key),
                entry.value.bytes,
            ]),
        )
        const onChainName = state.get(NAME_KEY)
        const owner = state.get(OWNER_KEY)
        // The registry could point at any application; the name the app
        // itself carries is what ties it to what the user typed.
        if (!onChainName || !owner || utf8(onChainName) !== normalizedName) {
            return 'mismatch'
        }

        const trusted = new Set([
            encodeAlgorandAddress(decodeFromBase64(owner)),
        ])
        const { boxes } = boxesSchema.parse(
            await algodGet(
                network,
                `/v2/applications/${appId}/boxes`,
                undefined,
                signal,
            ),
        )
        for (const box of boxes) {
            if (!VERIFIED_BOX.test(utf8(box.name))) continue
            const { value } = boxSchema.parse(
                await algodGet(
                    network,
                    `/v2/applications/${appId}/box`,
                    { name: `b64:${box.name}` },
                    signal,
                ),
            )
            for (const verified of addressesIn(value)) trusted.add(verified)
        }

        return trusted.has(address) ? 'verified' : 'mismatch'
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error
        logger.warn('NFD verification unavailable', {
            name: normalizedName,
            error: error instanceof Error ? error.message : String(error),
        })
        return 'unavailable'
    }
}
