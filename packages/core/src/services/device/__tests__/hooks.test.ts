import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '@test-utils'

// Hoisted spies for API composables
const api = vi.hoisted(() => {
    return {
        createSpy: vi.fn(),
        updateSpy: vi.fn(),
    }
})

// Mock generated API composables used by the hook
vi.mock('@api/generated/composables/useV1DevicesCreate', () => {
    return {
        useV1DevicesCreate: () => ({ mutateAsync: api.createSpy }),
    }
})
vi.mock('@api/generated/composables/useV1DevicesPartialUpdate', () => {
    return {
        useV1DevicesPartialUpdate: () => ({ mutateAsync: api.updateSpy }),
    }
})

// Hoisted Zustand store stub to avoid real persistence/container
const storeMock = vi.hoisted(() => {
    return {
        create() {
            let state: any = {
                accounts: [],
                deviceID: null,
                fcmToken: null,
            }
            const setState = (partial: any) => {
                state = { ...state, ...partial }
            }
            const useAppStore: any = (selector: any) => selector(state)
            ;(useAppStore as any).getState = () => state
            ;(useAppStore as any).setState = setState
            // slice updaters that our hook selects
            state = {
                ...state,
                setDeviceID: (id: string | null) => setState({ deviceID: id }),
                setFcmToken: (token: string | null) =>
                    setState({ fcmToken: token }),
            }
            return { useAppStore }
        },
    }
})
vi.mock('../../../store', () => storeMock.create())

describe('services/device/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('registerDevice creates when no deviceID and persists id', async () => {
        vi.resetModules()
        api.createSpy.mockResolvedValue({ id: 'NEW_ID' })
        api.updateSpy.mockResolvedValue({})

        // Ensure device info service is registered with defaults (web/testModel)
        registerTestPlatform()

        const { useAppStore } = await import('../../../store')
        const { useDevice } = await import('../hooks')

        ;(useAppStore as any).setState({
            accounts: [{ address: 'A1' }, { address: 'A2' }],
            fcmToken: 'FCM123',
            deviceID: null,
        })

        const { result } = renderHook(() => useDevice())
        await act(async () => {
            await result.current.registerDevice()
        })

        expect(api.createSpy).toHaveBeenCalledTimes(1)
        expect(api.updateSpy).not.toHaveBeenCalled()
        expect(api.createSpy).toHaveBeenCalledWith({
            data: {
                accounts: ['A1', 'A2'],
                platform: 'web',
                push_token: 'FCM123',
                model: 'testModel',
                application: 'pera',
                locale: 'testLocale',
            },
        })
        expect((useAppStore as any).getState().deviceID).toBe('NEW_ID')
    })

    test('registerDevice updates when deviceID exists', async () => {
        vi.resetModules()
        api.createSpy.mockResolvedValue({})
        api.updateSpy.mockResolvedValue({})
        registerTestPlatform()

        const { useAppStore } = await import('../../../store')
        const { useDevice } = await import('../hooks')

        ;(useAppStore as any).setState({
            accounts: [{ address: 'X' }],
            fcmToken: 'TOKEN',
            deviceID: 'DEV1',
        })

        const { result } = renderHook(() => useDevice())
        await act(async () => {
            await result.current.registerDevice()
        })

        expect(api.createSpy).not.toHaveBeenCalled()
        expect(api.updateSpy).toHaveBeenCalledTimes(1)
        expect(api.updateSpy).toHaveBeenCalledWith({
            device_id: 'DEV1',
            data: {
                accounts: ['X'],
                platform: 'web',
                push_token: 'TOKEN',
                model: 'testModel',
                locale: 'testLocale',
            },
        })
        expect((useAppStore as any).getState().deviceID).toBe('DEV1')
    })
})
