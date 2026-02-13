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

import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApplicationDisplay } from '../ApplicationDisplay'
import { useApplicationQuery } from '@perawallet/wallet-core-projects'

vi.mock('@components/core', () => ({
    PWView: ({ children, ...props }: { children: React.ReactNode }) => (
        <div {...props}>{children}</div>
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
}))

vi.mock('@perawallet/wallet-core-projects', () => ({
    useApplicationQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        row: {},
        caption: {},
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params?.id ? `#${params.id}` : key,
    }),
}))

vi.mock('@components/LoadingView', () => ({
    LoadingView: ({
        children,
        isLoading,
    }: {
        children: React.ReactNode
        isLoading: boolean
    }) => (isLoading ? <div data-testid='skeleton' /> : <div>{children}</div>),
}))

vi.mock('../../ProjectVerificationIcon', () => ({
    ProjectVerificationIcon: ({ tier }: { tier: string }) => (
        <span data-testid='verification-icon'>{tier}</span>
    ),
}))

describe('ApplicationDisplay', () => {
    test('renders application ID when no application data is available', () => {
        render(<ApplicationDisplay applicationId='123456' />)

        expect(screen.getByText('#123456')).toBeDefined()
    })

    test('renders application name and ID when data is available', () => {
        vi.mocked(useApplicationQuery).mockReturnValue({
            data: {
                applicationId: 123456,
                name: 'Tinyman AMM',
                project: {
                    name: 'Tinyman',
                    verificationTier: 'verified',
                },
            },
            isLoading: false,
        } as ReturnType<typeof useApplicationQuery>)

        render(<ApplicationDisplay applicationId='123456' />)

        expect(screen.getByText('Tinyman AMM')).toBeDefined()
        expect(screen.getByText('#123456')).toBeDefined()
    })

    test('renders application ID as fallback when application has no name', () => {
        vi.mocked(useApplicationQuery).mockReturnValue({
            data: null,
            isLoading: false,
        } as ReturnType<typeof useApplicationQuery>)

        render(<ApplicationDisplay applicationId='789' />)

        expect(screen.getByText('#789')).toBeDefined()
    })

    test('renders skeleton when loading', () => {
        vi.mocked(useApplicationQuery).mockReturnValue({
            data: null,
            isLoading: true,
        } as ReturnType<typeof useApplicationQuery>)

        render(<ApplicationDisplay applicationId='123' />)

        expect(screen.getByTestId('skeleton')).toBeDefined()
    })

    test('renders verification icon when project is verified', () => {
        vi.mocked(useApplicationQuery).mockReturnValue({
            data: {
                applicationId: 123,
                name: 'Verified App',
                project: {
                    name: 'Verified Project',
                    verificationTier: 'verified',
                },
            },
            isLoading: false,
        } as ReturnType<typeof useApplicationQuery>)

        render(<ApplicationDisplay applicationId='123' />)

        expect(screen.getByTestId('verification-icon')).toBeDefined()
        expect(screen.getByText('verified')).toBeDefined()
    })

    test('renders raw ID when valueOnlyOnFallback is true and no data', () => {
        vi.mocked(useApplicationQuery).mockReturnValue({
            data: null,
            isLoading: false,
        } as ReturnType<typeof useApplicationQuery>)

        render(
            <ApplicationDisplay
                applicationId='999'
                valueOnlyOnFallback
            />,
        )

        expect(screen.getByText('999')).toBeDefined()
    })

    test('passes applicationId to useApplicationQuery', () => {
        render(<ApplicationDisplay applicationId='55555' />)

        expect(useApplicationQuery).toHaveBeenCalledWith({
            applicationId: '55555',
            isEnabled: true,
        })
    })
})
