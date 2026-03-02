import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PermissionItem } from '../PermissionItem'
import { AlgorandPermission } from '@perawallet/wallet-core-walletconnect'

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
    }),
}))

vi.mock('@components/core', () => ({
    PWIcon: () => <div data-testid='PWIcon' />,
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWView: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        permissionItemContainer: {},
    }),
}))

describe('PermissionItem', () => {
    test('renders transaction permission label', () => {
        render(<PermissionItem permission={AlgorandPermission.TX_PERMISSION} />)

        expect(
            screen.getByText(
                'walletconnect.request.permissions_sign_transaction',
            ),
        ).toBeDefined()
    })

    test('renders data permission label', () => {
        render(
            <PermissionItem permission={AlgorandPermission.DATA_PERMISSION} />,
        )

        expect(
            screen.getByText('walletconnect.request.permissions_sign_data'),
        ).toBeDefined()
    })

    test('renders account permission label', () => {
        render(
            <PermissionItem
                permission={AlgorandPermission.ACCOUNT_PERMISSION}
            />,
        )

        expect(
            screen.getByText(
                'walletconnect.request.permissions_request_accounts',
            ),
        ).toBeDefined()
    })

    test('renders unknown permission as raw value', () => {
        render(
            <PermissionItem
                permission={'algo_unknown' as AlgorandPermission}
            />,
        )

        expect(screen.getByText('algo_unknown')).toBeDefined()
    })

    test('renders check icon for each permission', () => {
        render(<PermissionItem permission={AlgorandPermission.TX_PERMISSION} />)

        expect(screen.getByTestId('PWIcon')).toBeDefined()
    })
})
