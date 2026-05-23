import { render, screen } from '@test-utils/render'
import { ScreenHeader } from '../ScreenHeader'

describe('ScreenHeader', () => {
    it('renders the title', () => {
        render(<ScreenHeader title='Import an account' />)

        expect(screen.getByText('Import an account')).toBeTruthy()
    })

    it('renders the description when provided', () => {
        render(
            <ScreenHeader
                title='Import from Pera Web'
                description='Open the Pera Web Wallet on your computer.'
            />,
        )

        expect(
            screen.getByText('Open the Pera Web Wallet on your computer.'),
        ).toBeTruthy()
    })

    it('renders a hero icon when the icon prop is provided', () => {
        render(
            <ScreenHeader
                title='Import from Pera Web'
                icon='globe'
            />,
        )

        expect(screen.getByTestId('screen-header-icon')).toBeTruthy()
    })

    it('does not render a hero icon when icon is omitted', () => {
        render(<ScreenHeader title='No icon' />)

        expect(screen.queryByTestId('screen-header-icon')).toBeNull()
    })
})
