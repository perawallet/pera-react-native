import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import SettingsNotificationsScreen from '../SettingsNotificationsScreen'

describe('SettingsNotificationsScreen', () => {
    it('renders correctly', () => {
        const { getAllByText } = render(<SettingsNotificationsScreen />)
        // i18n mocked returns the key - multiple elements contain this
        expect(getAllByText(/common.not_implemented/i).length).toBeGreaterThan(
            0,
        )
    })
})
