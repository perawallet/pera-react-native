import { render } from '@test-utils/render'
import { describe, it } from 'vitest'
import { PWTabView } from '../PWTabView'
import { Text } from 'react-native'

describe('PWTabView', () => {
    it('renders correctly', () => {
        render(
            <PWTabView>
                <PWTabView.Item>
                    <Text>Content 1</Text>
                </PWTabView.Item>
            </PWTabView>
        )
    })
})
