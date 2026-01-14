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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import { RootComponent } from '../RootComponent'

// Mock Providers that might cause issues in shallow render
vi.mock('@providers/NetworkStatusProvider', () => ({
    NetworkStatusProvider: ({ children }: any) => children,
    NetworkStatusContext: { Provider: ({ children }: any) => children },
}))

vi.mock('@providers/WebViewProvider', () => ({
    default: ({ children }: any) => children,
}))

vi.mock('@modules/transactions/providers/SigningProvider', () => ({
    SigningProvider: ({ children }: any) => children,
}))

vi.mock('@modules/walletconnect/providers/WalletConnectProvider', () => ({
    WalletConnectProvider: ({ children }: any) => children,
}))

describe('RootComponent', () => {
    it('renders correctly', () => {
        render(<RootComponent />)
        expect(screen.toJSON()).toBeDefined()
    })
})
