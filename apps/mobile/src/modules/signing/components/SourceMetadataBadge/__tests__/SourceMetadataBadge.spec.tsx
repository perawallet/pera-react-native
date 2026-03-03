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
import { SourceMetadataBadge } from '../SourceMetadataBadge'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { useProjectByUrlQuery } from '@perawallet/wallet-core-projects'

vi.mock('@components/core', () => ({
    PWView: ({ children, ...props }: { children: React.ReactNode }) => (
        <div {...props}>{children}</div>
    ),
    PWText: ({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
    ),
    PWImage: ({ source }: { source: { uri: string } }) => (
        <img
            src={source.uri}
            data-testid='PWImage'
        />
    ),
    PWIcon: ({ name }: { name: string }) => (
        <div data-testid={`PWIcon-${name}`} />
    ),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    stripUrlScheme: (url?: string) => url,
}))

vi.mock('@perawallet/wallet-core-projects', () => ({
    useProjectByUrlQuery: vi.fn(() => ({
        data: null,
        isLoading: false,
        isError: false,
        error: null,
    })),
}))

vi.mock('@perawallet/wallet-extension-network', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet', setNetwork: vi.fn() })),
}))

vi.mock('../styles', () => ({
    useStyles: () => ({
        container: {},
        icon: {},
        iconFallback: {},
        name: {},
        separator: {},
        url: {},
    }),
}))

describe('SourceMetadataBadge', () => {
    test('renders name and url with separator', () => {
        const metadata: SignRequestSource = {
            name: 'Tinyman',
            url: 'www.tinyman.org',
            icons: ['https://tinyman.org/logo.png'],
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByText('Tinyman')).toBeDefined()
        expect(screen.getByText('www.tinyman.org')).toBeDefined()
    })

    test('renders icon from metadata when available', () => {
        const metadata: SignRequestSource = {
            name: 'Tinyman',
            icons: ['https://tinyman.org/logo.png'],
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByTestId('PWImage')).toBeDefined()
    })

    test('renders fallback icon when no icons provided', () => {
        const metadata: SignRequestSource = {
            name: 'Unknown dApp',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByTestId('PWIcon-wallet-connect')).toBeDefined()
    })

    test('renders only name when url is not provided', () => {
        const metadata: SignRequestSource = {
            name: 'Tinyman',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByText('Tinyman')).toBeDefined()
        expect(screen.queryByText('www.tinyman.org')).toBeNull()
    })

    test('renders only url when name is not provided', () => {
        const metadata: SignRequestSource = {
            url: 'www.tinyman.org',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByText('www.tinyman.org')).toBeDefined()
    })

    test('prefers png/jpg icons over other formats', () => {
        const metadata: SignRequestSource = {
            name: 'Test',
            icons: [
                'https://example.com/icon.svg',
                'https://example.com/icon.png',
            ],
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        const img = screen.getByTestId('PWImage')
        expect(img.getAttribute('src')).toBe('https://example.com/icon.png')
    })

    test('shows verified icon when project is verified', () => {
        vi.mocked(useProjectByUrlQuery).mockReturnValue({
            data: {
                name: 'Tinyman',
                verificationTier: 'verified',
            },
        } as ReturnType<typeof useProjectByUrlQuery>)

        const metadata: SignRequestSource = {
            name: 'Tinyman',
            url: 'https://tinyman.org',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByTestId('PWIcon-assets/verified')).toBeDefined()
    })

    test('shows suspicious icon when project is suspicious', () => {
        vi.mocked(useProjectByUrlQuery).mockReturnValue({
            data: {
                name: 'Suspicious App',
                verificationTier: 'suspicious',
            },
        } as ReturnType<typeof useProjectByUrlQuery>)

        const metadata: SignRequestSource = {
            name: 'Suspicious App',
            url: 'https://suspicious.com',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByTestId('PWIcon-assets/suspicious')).toBeDefined()
    })

    test('falls back to project name when metadata name is missing', () => {
        vi.mocked(useProjectByUrlQuery).mockReturnValue({
            data: {
                name: 'Project Name',
                verificationTier: 'unverified',
            },
        } as ReturnType<typeof useProjectByUrlQuery>)

        const metadata: SignRequestSource = {
            url: 'https://example.com',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        expect(screen.getByText('Project Name')).toBeDefined()
    })

    test('falls back to project logo when metadata icons are missing', () => {
        vi.mocked(useProjectByUrlQuery).mockReturnValue({
            data: {
                name: 'Tinyman',
                logoPng: 'https://tinyman.org/project-logo.png',
                verificationTier: 'verified',
            },
        } as ReturnType<typeof useProjectByUrlQuery>)

        const metadata: SignRequestSource = {
            name: 'Tinyman',
            url: 'https://tinyman.org',
        }

        render(<SourceMetadataBadge metadata={metadata} />)

        const img = screen.getByTestId('PWImage')
        expect(img.getAttribute('src')).toBe(
            'https://tinyman.org/project-logo.png',
        )
    })
})
