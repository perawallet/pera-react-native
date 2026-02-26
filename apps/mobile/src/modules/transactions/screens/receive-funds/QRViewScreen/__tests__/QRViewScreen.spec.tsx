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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { QRViewScreen } from '../QRViewScreen'
import { useQRViewScreen } from '../useQRViewScreen'
import { useReceiveFunds } from '@modules/transactions/hooks'

vi.mock('../useQRViewScreen', () => ({
    useQRViewScreen: vi.fn(),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useNavigationHeader', () => ({
    useNavigationHeader: vi.fn(),
}))

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            goBack: vi.fn(),
        }),
    }
})

vi.mock('@rneui/themed', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passthrough = ({ children }: any) => children
    const mockTheme = {
        spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, '4xl': 32 },
        colors: { textGray: '#888' },
    }
    return {
        useThemeMode: () => ({ mode: 'light', setMode: vi.fn() }),
        createTheme: (config: Record<string, unknown>) => config,
        ThemeProvider: passthrough,
        makeStyles:
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (fn: (...args: any[]) => Record<string, unknown>) => () =>
                fn(mockTheme, {}),
        useTheme: () => ({
            theme: mockTheme,
        }),
    }
})

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    return {
        ...actual,
        useWindowDimensions: () => ({ width: 375, height: 812 }),
    }
})

vi.mock('react-native-qrcode-svg', () => ({
    default: () => <div data-testid='qr-code' />,
}))

vi.mock('@components/EmptyView', () => ({
    EmptyView: ({ title, body }: { title: string; body: string }) => (
        <div data-testid='empty-view'>
            {title} {body}
        </div>
    ),
}))

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

const mockHandleCopyAddress = vi.fn()
const mockHandleShareAddress = vi.fn()
const mockOnFinished = vi.fn()

describe('QRViewScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useQRViewScreen as Mock).mockReturnValue({
            account: mockAccount,
            deeplink: 'algorand://test-address-123',
            handleCopyAddress: mockHandleCopyAddress,
            handleShareAddress: mockHandleShareAddress,
        })
        ;(useReceiveFunds as Mock).mockReturnValue({
            canSelectAccount: true,
            onFinished: mockOnFinished,
        })
    })

    it('renders QR code when account is selected', () => {
        render(<QRViewScreen />)

        expect(screen.getByTestId('qr-code')).toBeTruthy()
    })

    it('renders empty view when no account', () => {
        ;(useQRViewScreen as Mock).mockReturnValue({
            account: undefined,
            deeplink: '',
            handleCopyAddress: mockHandleCopyAddress,
            handleShareAddress: mockHandleShareAddress,
        })

        render(<QRViewScreen />)

        expect(screen.getByTestId('empty-view')).toBeTruthy()
    })

    it('calls handleCopyAddress when copy button is pressed', () => {
        render(<QRViewScreen />)

        const copyButton = screen.getByText('receive_funds.qrview.copy_address')
        fireEvent.click(copyButton)

        expect(mockHandleCopyAddress).toHaveBeenCalled()
    })

    it('calls handleShareAddress when share button is pressed', () => {
        render(<QRViewScreen />)

        const shareButton = screen.getByText('receive_funds.qrview.share')
        fireEvent.click(shareButton)

        expect(mockHandleShareAddress).toHaveBeenCalled()
    })

    it('displays account address', () => {
        render(<QRViewScreen />)

        expect(screen.getByText('test-address-123')).toBeTruthy()
    })
})
