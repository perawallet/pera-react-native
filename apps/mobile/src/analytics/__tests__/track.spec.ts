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

// @vitest-environment node

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'

const logEvent = vi.fn()
let currentNetwork = 'mainnet'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ analytics: { logEvent } }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: (chainId: string) => ({
        chainId,
        networkId: currentNetwork,
    }),
    getSelectedScope: (chainId: string) => ({
        chainId,
        networkId: currentNetwork,
    }),
    useNetworkStore: {
        getState: () => ({
            mode: currentNetwork === 'mainnet' ? 'live' : 'developer',
        }),
    },
}))

import { trackEvent, trackScreen } from '../track'
import { HomeEvent } from '../events/contexts/home'
import { OnboardingEvent } from '../events/contexts/onboarding'
import { NotificationsEvent } from '../events/contexts/notifications'
import { AnalyticsMetadataKey } from '../events/metadata-keys'
import { AnalyticsScreenName } from '../events/screen-names'

describe('trackEvent', () => {
    beforeEach(() => {
        logEvent.mockClear()
        currentNetwork = 'mainnet'
    })

    it('forwards the raw event name unchanged on mainnet for a parameterless event', () => {
        trackEvent(HomeEvent.Sort)

        expect(logEvent).toHaveBeenCalledWith('homescr_sort_tap', undefined)
    })

    it('forwards the payload using raw metadata keys, the chain beside the rest', () => {
        trackEvent(OnboardingEvent.RegisterAccount, {
            [AnalyticsMetadataKey.AccountCreationType]: 'create',
            [AnalyticsMetadataKey.ChainId]: 'ethereum',
        })

        expect(logEvent).toHaveBeenCalledWith('register', {
            type: 'create',
            chain_id: 'ethereum',
        })
    })

    it('prepends the testnet prefix when the active network is testnet', () => {
        currentNetwork = 'testnet'

        trackEvent(HomeEvent.Sort)

        expect(logEvent).toHaveBeenCalledWith('t_homescr_sort_tap', undefined)
    })

    it('omits the payload for an optional-payload event when none is given', () => {
        trackEvent(NotificationsEvent.Open)

        expect(logEvent).toHaveBeenCalledWith('notification_open', undefined)
    })

    it('never throws when the underlying logEvent fails — analytics must not crash the app', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
        logEvent.mockImplementationOnce(() => {
            throw new Error('analytics backend exploded')
        })

        expect(() => trackEvent(HomeEvent.Sort)).not.toThrow()
        expect(warnSpy).toHaveBeenCalledWith(
            '[analytics] Failed to track event',
            { error: expect.any(Error) },
        )

        warnSpy.mockRestore()
    })
})

describe('trackScreen', () => {
    beforeEach(() => {
        logEvent.mockClear()
        currentNetwork = 'mainnet'
    })

    it('forwards the screen name and metadata', () => {
        trackScreen(AnalyticsScreenName.AssetDetail, {
            [AnalyticsMetadataKey.AssetId]: '123',
        })

        expect(logEvent).toHaveBeenCalledWith('screen_asset_detail', {
            asset_id: '123',
        })
    })

    it('applies the testnet prefix to screen names too', () => {
        currentNetwork = 'testnet'

        trackScreen(AnalyticsScreenName.AccountList)

        expect(logEvent).toHaveBeenCalledWith('t_screen_accounts', undefined)
    })
})
