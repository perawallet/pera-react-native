import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, fireEvent, screen } from '@test-utils/render'
import SearchInput from '../SearchInput'

describe('SearchInput', () => {
    it('calls onChangeText when text changes', () => {
        const onChangeText = vi.fn()
        render(<SearchInput onChangeText={onChangeText} placeholder="Search coins" />)
        
        fireEvent.change(screen.getByPlaceholderText('Search coins'), { target: { value: 'Algorand' } })
        expect(onChangeText).toHaveBeenCalledWith('Algorand')
    })
})
