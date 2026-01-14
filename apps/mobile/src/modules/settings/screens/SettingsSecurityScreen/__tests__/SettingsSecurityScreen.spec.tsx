import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import SettingsSecurityScreen from '../SettingsSecurityScreen'

describe('SettingsSecurityScreen', () => {
    it('renders correctly', () => {
        const { getAllByText } = render(<SettingsSecurityScreen />)
        expect(getAllByText(/common.not_implemented/i).length).toBeGreaterThan(
            0,
        )
    })
})
