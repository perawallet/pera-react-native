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

import type { ChainCapability } from '@perawallet/wallet-core-chain-contract'
import type { CapabilityRequirement } from '@hooks/useCapability'

const switchedOff = new Set<ChainCapability>()

const isAllowed = ({ chain, anyChain }: CapabilityRequirement): boolean =>
    !(chain && switchedOff.has(chain.capability)) &&
    !(anyChain && switchedOff.has(anyChain))

/**
 * Stands in for `@hooks/useCapability` in a spec that mocks the remote-config
 * module wholesale: every capability is on until switched off, and the
 * platform part always holds.
 *
 * `vi.mock('@hooks/useCapability', async () => (await import('@test-utils/capability-mock')).capabilityHookMock())`
 */
export const capabilityHookMock = () => ({
    useCapability: isAllowed,
    useCapabilityCheck: () => isAllowed,
})

export const capabilityState = {
    turnOff: (...capabilities: ChainCapability[]): void => {
        capabilities.forEach(capability => switchedOff.add(capability))
    },
    reset: (): void => switchedOff.clear(),
}
