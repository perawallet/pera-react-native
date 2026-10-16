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
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRemoteConfig } from '@perawallet/wallet-core-remote-config'
import { useCapability, type CapabilityRequirement } from '@hooks/useCapability'
import { useIsCardAutoFundingEnabled } from '../useIsCardAutoFundingEnabled'
import { useIsCardPushProvisioningEnabled } from '../useIsCardPushProvisioningEnabled'
import { useIsCloudBackupEnabled } from '../useIsCloudBackupEnabled'
import { useIsGiftCardsEnabled } from '../useIsGiftCardsEnabled'
import { useIsLanguageSelectionEnabled } from '../useIsLanguageSelectionEnabled'
import { useIsPeraCardEnabled } from '../useIsPeraCardEnabled'
import { useIsQuantumDappWarningEnabled } from '../useIsQuantumDappWarningEnabled'

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-remote-config')
    >()),
    useRemoteConfig: vi.fn(),
}))

vi.mock('@hooks/useCapability', () => ({ useCapability: vi.fn() }))

const buildFlags = vi.hoisted(() => ({
    appEnvironment: 'production',
    isDebug: false,
    isStaging: false,
}))
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        get appEnvironment() {
            return buildFlags.appEnvironment
        },
    },
    get isDebug() {
        return buildFlags.isDebug
    },
    get isStaging() {
        return buildFlags.isStaging
    },
}))

const BUILD_ENVS = {
    production: () => {},
    __DEV__: () => vi.stubGlobal('__DEV__', true),
    'appEnvironment staging': () => {
        buildFlags.appEnvironment = 'staging'
    },
    isDebug: () => {
        buildFlags.isDebug = true
    },
    isStaging: () => {
        buildFlags.isStaging = true
    },
}
type BuildEnv = keyof typeof BUILD_ENVS
const ALL_BUILD_ENVS = Object.keys(BUILD_ENVS) as BuildEnv[]

type FlagHookCase = {
    name: string
    hook: () => boolean
    key: string
    enabledWhenUnsetIn: BuildEnv[]
    capability?: CapabilityRequirement
}

const FLAG_HOOKS: FlagHookCase[] = [
    {
        name: 'useIsCloudBackupEnabled',
        hook: useIsCloudBackupEnabled,
        key: 'enable_cloud_backup',
        enabledWhenUnsetIn: [],
    },
    {
        name: 'useIsLanguageSelectionEnabled',
        hook: useIsLanguageSelectionEnabled,
        key: 'enable_language_selection',
        enabledWhenUnsetIn: [],
    },
    {
        name: 'useIsCardAutoFundingEnabled',
        hook: useIsCardAutoFundingEnabled,
        key: 'enable_card_auto_funding',
        enabledWhenUnsetIn: ['__DEV__', 'appEnvironment staging'],
    },
    {
        name: 'useIsCardPushProvisioningEnabled',
        hook: useIsCardPushProvisioningEnabled,
        key: 'enable_card_push_provisioning',
        enabledWhenUnsetIn: ['__DEV__', 'appEnvironment staging'],
    },
    {
        name: 'useIsGiftCardsEnabled',
        hook: useIsGiftCardsEnabled,
        key: 'enable_gift_cards',
        enabledWhenUnsetIn: [],
        capability: { platform: 'giftCards', anyChain: 'giftCards' },
    },
    {
        name: 'useIsPeraCardEnabled',
        hook: useIsPeraCardEnabled,
        key: 'enable_pera_card',
        enabledWhenUnsetIn: ['isDebug', 'isStaging'],
        capability: { platform: 'peraCard', anyChain: 'card' },
    },
    {
        name: 'useIsQuantumDappWarningEnabled',
        hook: useIsQuantumDappWarningEnabled,
        key: 'enable_quantum_dapp_warning',
        enabledWhenUnsetIn: ALL_BUILD_ENVS,
        capability: { platform: 'quantum' },
    },
]

const mockGetBooleanValue = vi.fn()

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('__DEV__', false)
    buildFlags.appEnvironment = 'production'
    buildFlags.isDebug = false
    buildFlags.isStaging = false
    vi.mocked(useCapability).mockReturnValue(true)
    ;(useRemoteConfig as Mock).mockReturnValue({
        getBooleanValue: mockGetBooleanValue,
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe.each(FLAG_HOOKS)(
    '$name',
    ({ hook, key, enabledWhenUnsetIn, capability }) => {
        it.each([true, false])(
            'returns the remote value %s when set',
            value => {
                mockGetBooleanValue.mockReturnValue(value)

                const { result } = renderHook(() => hook())

                expect(result.current).toBe(value)
            },
        )

        it.each(ALL_BUILD_ENVS)(
            'falls back to the %s build default when the flag is unset',
            env => {
                // Echo the fallback the hook passes, i.e. an unset remote value.
                mockGetBooleanValue.mockImplementation(
                    (_key: string, fallback?: boolean) => fallback,
                )
                BUILD_ENVS[env]()
                const expected = enabledWhenUnsetIn.includes(env)

                const { result } = renderHook(() => hook())

                expect(mockGetBooleanValue).toHaveBeenCalledWith(key, expected)
                expect(result.current).toBe(expected)
            },
        )

        if (capability) {
            it('stays off when the capability is off, even with the remote flag on', () => {
                mockGetBooleanValue.mockReturnValue(true)
                vi.mocked(useCapability).mockReturnValue(false)

                const { result } = renderHook(() => hook())

                expect(useCapability).toHaveBeenCalledWith(capability)
                expect(result.current).toBe(false)
            })
        }
    },
)
