/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi } from 'vitest'

// Mock core services and hooks from @perawallet/wallet-core-shared
export const mockCoreServices = () => {
    jest.mock('@perawallet/wallet-core-shared', async () => {
        const actual = await jest.requireActual('@perawallet/wallet-core-shared')
        return {
            ...actual,
            useDeviceInfoService: jest.fn(() => ({
                getDeviceLocale: jest.fn(() => 'en-US'),
                getDeviceInfo: jest.fn(() => ({
                    brand: 'Apple',
                    model: 'iPhone 13',
                    systemVersion: '15.0',
                })),
            })),
            useAllAccounts: jest.fn(() => []),
            useHasAccounts: jest.fn(() => true),
            useHasNoAccounts: jest.fn(() => false),
            useAppStore: jest.fn(selector => {
                const mockState = {
                    network: 'mainnet',
                    fcmToken: null,
                    setFcmToken: jest.fn(),
                }
                return selector ? selector(mockState) : mockState
            }),
            formatCurrency: jest.fn((value, _, currency, __) => {
                return `${value.toString()} ${currency}`
            }),
            Networks: {
                mainnet: 'mainnet',
                testnet: 'testnet',
            },
        }
    })
}

// Mock SVG components
export const mockSvgComponents = () => {
    jest.mock('../../../assets/icons/list-arrow-down.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../../assets/icons/plus-with-border.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../../assets/icons/camera.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../../assets/icons/bell.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../../assets/icons/info.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../../assets/icons/chevron-left.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/list-arrow-down.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/plus-with-border.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/camera.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/bell.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/info.svg', () => ({
        default: jest.fn(() => null),
    }))

    jest.mock('../../assets/icons/chevron-left.svg', () => ({
        default: jest.fn(() => null),
    }))
}

// Mock React Query persister
export const mockQueryPersister = () => ({
    persistClient: jest.fn(),
    restoreClient: jest.fn(),
    removeClient: jest.fn(),
})

// Mock navigation hooks with useful defaults
export const mockNavigation = () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
})

export const mockRoute = () => ({
    key: 'test-route',
    name: 'TestScreen',
    params: {},
})
