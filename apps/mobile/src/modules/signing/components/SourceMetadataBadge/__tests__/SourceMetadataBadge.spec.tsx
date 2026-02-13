import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceMetadataBadge } from '../SourceMetadataBadge'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'

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
})
