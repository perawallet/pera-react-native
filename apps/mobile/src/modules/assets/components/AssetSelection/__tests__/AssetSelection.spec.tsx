import { render } from '@test-utils/render'
import { describe, it, expect } from 'vitest'
import AssetSelection from '../AssetSelection'

const mockAsset = {
    id: 1,
    unitName: 'ALGO',
    name: 'Algorand',
    decimals: 6,
}

describe('AssetSelection', () => {
    it('renders correctly with asset', () => {
        const { getByText } = render(
            <AssetSelection asset={mockAsset as any} />,
        )
        expect(getByText('ALGO')).toBeTruthy()
    })
})
