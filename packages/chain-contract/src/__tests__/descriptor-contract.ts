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

import { describe, expect, it } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
} from '../models/capabilities'
import type { ChainDescriptor, ExplorerUrlBuilders } from '../models/descriptor'
import { CUSTOM_NETWORK_ID, NETWORK_TIERS } from '../models/identity'

type Rule = 'tiers' | 'caip2' | 'explorer' | 'capabilities' | 'uriSchemes'

// RFC 3986 scheme syntax, with no trailing `:`.
const URI_SCHEME = /^[a-z][a-z0-9+.-]*$/

type Violation = { rule: Rule; message: string }

const EXPLORER_SAMPLES: Record<keyof ExplorerUrlBuilders, string> = {
    accountUrl: 'sample-address',
    transactionUrl: 'sample-tx-id',
    assetUrl: '1',
}

const isUrl = (value: string | undefined): boolean => {
    if (value === undefined) {
        return false
    }
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

const collectViolations = (
    descriptor: ChainDescriptor,
    capabilityDefaults: ChainCapabilities,
): Violation[] => {
    const violations: Violation[] = []
    const declared = descriptor.networks.filter(
        network => network.id !== CUSTOM_NETWORK_ID,
    )

    // Every tier, declared or not: each mode resolves to one tier's default.
    for (const tier of NETWORK_TIERS) {
        const defaults = descriptor.networks.filter(
            n => n.tier === tier && n.isDefaultForTier,
        ).length
        if (defaults !== 1) {
            violations.push({
                rule: 'tiers',
                message: `tier "${tier}" has ${defaults} default networks; expected exactly 1`,
            })
        }
    }

    for (const network of declared) {
        if (!network.caip2) {
            violations.push({
                rule: 'caip2',
                message: `network "${network.id}" has no CAIP-2 id`,
            })
        }
    }

    const builders = Object.keys(EXPLORER_SAMPLES) as Array<
        keyof ExplorerUrlBuilders
    >
    for (const builder of builders) {
        for (const network of declared) {
            const url = descriptor.explorer[builder](
                network.id,
                EXPLORER_SAMPLES[builder],
            )
            if (!isUrl(url)) {
                violations.push({
                    rule: 'explorer',
                    message: `explorer.${builder} returned no URL for network "${network.id}"`,
                })
            }
        }
    }

    if (descriptor.uriSchemes.length === 0) {
        violations.push({
            rule: 'uriSchemes',
            message: 'uriSchemes is empty',
        })
    }
    for (const scheme of descriptor.uriSchemes) {
        if (!URI_SCHEME.test(scheme)) {
            violations.push({
                rule: 'uriSchemes',
                message: `uri scheme "${scheme}" is not a bare lower-case scheme`,
            })
        }
    }

    for (const capability of CHAIN_CAPABILITIES) {
        if (typeof capabilityDefaults[capability] !== 'boolean') {
            violations.push({
                rule: 'capabilities',
                message: `capabilityDefaults is missing "${capability}"`,
            })
        }
    }

    return violations
}

/** One message per broken rule, each naming the tier, network, builder or key at fault. */
export const descriptorContractViolations = (
    descriptor: ChainDescriptor,
    capabilityDefaults: ChainCapabilities,
): string[] =>
    collectViolations(descriptor, capabilityDefaults).map(v => v.message)

const messagesFor = (
    descriptor: ChainDescriptor,
    capabilityDefaults: ChainCapabilities,
    rule: Rule,
): string[] =>
    collectViolations(descriptor, capabilityDefaults)
        .filter(v => v.rule === rule)
        .map(v => v.message)

/** Every chain package runs this against its own descriptor and `capabilityDefaults`. */
export const descriptorContractTests = (
    descriptor: ChainDescriptor,
    capabilityDefaults: ChainCapabilities,
): void => {
    describe(`ChainDescriptor contract: ${descriptor.id}`, () => {
        it('has exactly one default network per tier', () => {
            expect(
                messagesFor(descriptor, capabilityDefaults, 'tiers'),
            ).toEqual([])
        })

        it('has a CAIP-2 id on every non-custom network', () => {
            expect(
                messagesFor(descriptor, capabilityDefaults, 'caip2'),
            ).toEqual([])
        })

        it('builds explorer URLs for every non-custom network', () => {
            expect(
                messagesFor(descriptor, capabilityDefaults, 'explorer'),
            ).toEqual([])
        })

        it('declares bare URI schemes', () => {
            expect(
                messagesFor(descriptor, capabilityDefaults, 'uriSchemes'),
            ).toEqual([])
        })

        it('declares a default for every capability', () => {
            expect(
                messagesFor(descriptor, capabilityDefaults, 'capabilities'),
            ).toEqual([])
        })
    })
}
