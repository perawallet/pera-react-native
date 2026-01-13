import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import PWListItem from '../PWListItem'

describe('PWListItem', () => {
    it('calls onPress when pressed', () => {
        const onPress = vi.fn()
        render(<PWListItem icon="wallet" title="My Accounts" onPress={onPress} />)
        
        fireEvent.click(screen.getByText('My Accounts'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})
