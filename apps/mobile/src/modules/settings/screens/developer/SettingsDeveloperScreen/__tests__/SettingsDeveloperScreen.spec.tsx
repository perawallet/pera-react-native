import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import SettingsDeveloperScreen from '../SettingsDeveloperScreen'

describe('SettingsDeveloperScreen', () => {
    it('renders correctly', () => {
        const { getByText } = render(<SettingsDeveloperScreen />)
        expect(
            getByText(/settings.developer.node_settings_title/i),
        ).toBeTruthy()
    })
})
