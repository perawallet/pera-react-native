import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConnectionView } from '../ConnectionView'
import type { WalletConnectSessionRequest } from '@perawallet/wallet-core-walletconnect'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockApproveSession = vi.fn()
const mockRejectSession = vi.fn()
const mockRemoveSessionRequest = vi.fn()
const mockShowToast = vi.fn()

const mockAccounts: WalletAccount[] = [
    { address: 'ADDR1', name: 'Account 1' },
    { address: 'ADDR2', name: 'Account 2' },
] as unknown as WalletAccount[]

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({
        approveSession: mockApproveSession,
        rejectSession: mockRejectSession,
    }),
    useWalletConnectSessionRequests: () => ({
        removeSessionRequest: mockRemoveSessionRequest,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSigningAccounts: () => mockAccounts,
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('../ConnectionViewHeader', () => ({
    ConnectionViewHeader: () => <div data-testid='ConnectionViewHeader' />,
}))

vi.mock('@modules/accounts/components/AccountDisplay', () => ({
    AccountDisplay: ({ account }: { account: WalletAccount }) => (
        <span data-testid={`AccountDisplay-${account.address}`}>
            {account.name}
        </span>
    ),
}))

vi.mock('@components/core', () => ({
    PWButton: ({
        title,
        onPress,
        isDisabled,
    }: {
        title: string
        onPress: () => void
        isDisabled?: boolean
    }) => (
        <button
            onClick={onPress}
            disabled={isDisabled}
        >
            {title}
        </button>
    ),
    PWCheckbox: ({
        onPress,
        checked,
    }: {
        onPress: () => void
        checked: boolean
    }) => (
        <input
            type='checkbox'
            data-testid='PWCheckbox'
            checked={checked}
            onChange={onPress}
        />
    ),
    PWFlatList: ({
        data,
        renderItem,
        ListHeaderComponent,
    }: {
        data: WalletAccount[]
        renderItem: ({ item }: { item: WalletAccount }) => React.ReactNode
        ListHeaderComponent: React.ReactNode
    }) => (
        <div data-testid='PWFlatList'>
            {ListHeaderComponent}
            {data.map(item => (
                <div key={item.address}>{renderItem({ item })}</div>
            ))}
        </div>
    ),
    PWTouchableOpacity: ({
        children,
        onPress,
    }: {
        children: React.ReactNode
        onPress: () => void
    }) => (
        <button
            data-testid='account-row'
            onClick={onPress}
        >
            {children}
        </button>
    ),
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    bottomSheetNotifier: { current: null },
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        contentContainer: {},
        buttonContainer: {},
        cancelButton: {},
        connectButton: {},
        accountItem: {},
    }),
}))

const mockRequest = {
    peerMeta: {
        name: 'Test dApp',
        url: 'https://test-dapp.com',
        icons: [],
        description: '',
    },
    chainId: 416001,
    permissions: ['algo_getAccounts'],
    clientId: 'client-123',
} as unknown as WalletConnectSessionRequest

const mockOnSuccess = vi.fn()
const mockOnError = vi.fn()

describe('ConnectionView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('renders the header and account list', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        expect(screen.getByTestId('ConnectionViewHeader')).toBeDefined()
        expect(screen.getByTestId('AccountDisplay-ADDR1')).toBeDefined()
        expect(screen.getByTestId('AccountDisplay-ADDR2')).toBeDefined()
    })

    test('connect button is disabled when no accounts are selected', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        const connectButton = screen.getByText('common.connect.label')
        expect(connectButton).toHaveProperty('disabled', true)
    })

    test('connect button is enabled after selecting an account', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        const accountRows = screen.getAllByTestId('account-row')
        fireEvent.click(accountRows[0])

        const connectButton = screen.getByText('common.connect.label')
        expect(connectButton).toHaveProperty('disabled', false)
    })

    test('toggling an account off deselects it', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        const accountRows = screen.getAllByTestId('account-row')
        // Select
        fireEvent.click(accountRows[0])
        expect(screen.getByText('common.connect.label')).toHaveProperty(
            'disabled',
            false,
        )

        // Deselect
        fireEvent.click(accountRows[0])
        expect(screen.getByText('common.connect.label')).toHaveProperty(
            'disabled',
            true,
        )
    })

    test('cancel rejects session and removes request', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        fireEvent.click(screen.getByText('common.cancel.label'))

        expect(mockRejectSession).toHaveBeenCalledWith('client-123')
        expect(mockRemoveSessionRequest).toHaveBeenCalledWith(mockRequest)
    })

    test('connect approves session with selected accounts', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        // Select first account
        const accountRows = screen.getAllByTestId('account-row')
        fireEvent.click(accountRows[0])

        // Click connect
        fireEvent.click(screen.getByText('common.connect.label'))

        expect(mockApproveSession).toHaveBeenCalledWith(
            'client-123',
            mockRequest,
            ['ADDR1'],
        )
        expect(mockOnSuccess).toHaveBeenCalledWith(mockRequest)
        expect(mockRemoveSessionRequest).toHaveBeenCalledWith(mockRequest)
        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        )
    })

    test('connect calls onError when approveSession throws', () => {
        const error = new Error('approval failed')
        mockApproveSession.mockImplementationOnce(() => {
            throw error
        })

        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        const accountRows = screen.getAllByTestId('account-row')
        fireEvent.click(accountRows[0])
        fireEvent.click(screen.getByText('common.connect.label'))

        expect(mockOnError).toHaveBeenCalledWith(error)
        expect(mockOnSuccess).not.toHaveBeenCalled()
    })

    test('selecting multiple accounts sends all to approveSession', () => {
        render(
            <ConnectionView
                request={mockRequest}
                onSuccess={mockOnSuccess}
                onError={mockOnError}
            />,
        )

        const accountRows = screen.getAllByTestId('account-row')
        fireEvent.click(accountRows[0])
        fireEvent.click(accountRows[1])

        fireEvent.click(screen.getByText('common.connect.label'))

        expect(mockApproveSession).toHaveBeenCalledWith(
            'client-123',
            mockRequest,
            ['ADDR1', 'ADDR2'],
        )
    })
})
