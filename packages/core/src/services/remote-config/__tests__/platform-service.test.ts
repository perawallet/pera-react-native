import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
    RemoteConfigServiceContainerKey,
    useRemoteConfigService,
    type RemoteConfigService,
} from '@services/remote-config'

describe('services/remote-config/platform-service', () => {
    test('useRemoteConfigService resolves the registered RemoteConfigService from the container', () => {
        const dummy: RemoteConfigService = {
            initializeRemoteConfig: vi.fn(),
            getStringValue: vi.fn(() => 'value'),
            getBooleanValue: vi.fn(() => true),
            getNumberValue: vi.fn(() => 42),
        }

        container.register(RemoteConfigServiceContainerKey, { useValue: dummy })

        const svc = useRemoteConfigService()
        expect(svc).toBe(dummy)

        svc.initializeRemoteConfig()
        expect(dummy.initializeRemoteConfig).toHaveBeenCalledTimes(1)
    })
})
