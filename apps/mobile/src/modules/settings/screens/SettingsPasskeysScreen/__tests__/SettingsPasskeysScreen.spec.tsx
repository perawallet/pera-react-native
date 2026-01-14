import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import SettingsPasskeysScreen from '../SettingsPasskeysScreen'

describe('SettingsPasskeysScreen', () => {
    it('renders correctly', () => {
        const { getAllByText } = render(<SettingsPasskeysScreen />)
        expect(getAllByText(/common.not_implemented/i).length).toBeGreaterThan(
            0,
        )
    })
})
