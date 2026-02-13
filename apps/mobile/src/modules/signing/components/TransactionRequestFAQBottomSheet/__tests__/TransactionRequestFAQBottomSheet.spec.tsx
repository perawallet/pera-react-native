import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TransactionRequestFAQBottomSheet } from '../TransactionRequestFAQBottomSheet'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'

const mockSetPreference = vi.fn()
const mockGetPreference = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        pendingSignRequests: [],
    })),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(() => ({
        getPreference: mockGetPreference,
        setPreference: mockSetPreference,
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (cb: () => void) => setTimeout(cb, 0),
}))

vi.mock('@components/core', () => ({
    PWBottomSheet: ({
        children,
        isVisible,
    }: {
        children: React.ReactNode
        isVisible: boolean
    }) =>
        isVisible ? <div data-testid='PWBottomSheet'>{children}</div> : null,
    PWButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
        <button onClick={onPress}>{title}</button>
    ),
    PWIcon: () => <div data-testid='PWIcon' />,
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        icon: {},
        message: {},
        warning: {},
    }),
}))

describe('TransactionRequestFAQBottomSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('does not render when no pending sign requests', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [],
        } as unknown as ReturnType<typeof useSigningRequest>)

        vi.mocked(usePreferences).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        } as unknown as ReturnType<typeof usePreferences>)

        render(<TransactionRequestFAQBottomSheet />)

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('does not render when preference is already set', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [{ id: 'req-1' }],
        } as unknown as ReturnType<typeof useSigningRequest>)

        mockGetPreference.mockReturnValue(true)
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        } as unknown as ReturnType<typeof usePreferences>)

        render(<TransactionRequestFAQBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        expect(screen.queryByTestId('PWBottomSheet')).toBeNull()
    })

    test('renders when pending sign requests exist and preference is not set', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [{ id: 'req-1' }],
        } as unknown as ReturnType<typeof useSigningRequest>)

        mockGetPreference.mockReturnValue(undefined)
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        } as unknown as ReturnType<typeof usePreferences>)

        render(<TransactionRequestFAQBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        expect(screen.getByTestId('PWBottomSheet')).toBeDefined()
        expect(
            screen.getByText('signing.transaction_request_faq.title'),
        ).toBeDefined()
        expect(
            screen.getByText('signing.transaction_request_faq.body'),
        ).toBeDefined()
        expect(
            screen.getByText('signing.transaction_request_faq.warning'),
        ).toBeDefined()
    })

    test('calls setPreference on Close button press', () => {
        vi.mocked(useSigningRequest).mockReturnValue({
            pendingSignRequests: [{ id: 'req-1' }],
        } as unknown as ReturnType<typeof useSigningRequest>)

        mockGetPreference.mockReturnValue(undefined)
        vi.mocked(usePreferences).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        } as unknown as ReturnType<typeof usePreferences>)

        render(<TransactionRequestFAQBottomSheet />)
        act(() => {
            vi.runAllTimers()
        })

        fireEvent.click(screen.getByText('common.close.label'))

        expect(mockSetPreference).toHaveBeenCalledWith(
            'transaction-request-faq-shown',
            true,
        )
    })
})
