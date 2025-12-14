import React from 'react'
import { create, act } from 'react-test-renderer'
import { useLanguage } from '../language'
import { useTranslation } from 'react-i18next'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('react-i18next', () => ({
    useTranslation: vi.fn(),
}))

describe('useLanguage', () => {
    const changeLanguageMock = vi.fn()
    const tMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
            ; (useTranslation as any).mockReturnValue({
                t: tMock,
                i18n: {
                    language: 'en',
                    changeLanguage: changeLanguageMock,
                },
            })
    })

    it('returns current language and translation function', () => {
        let hookResult: any
        const TestComponent = () => {
            hookResult = useLanguage()
            return null
        }

        let renderer: any
        act(() => {
            renderer = create(<TestComponent />)
        })

        expect(hookResult).toBeDefined()
        expect(hookResult.currentLanguage).toBe('en')
        expect(hookResult.t).toBe(tMock)
    })

    it('changes language', () => {
        let hookResult: any
        const TestComponent = () => {
            hookResult = useLanguage()
            return null
        }

        let renderer: any
        act(() => {
            renderer = create(<TestComponent />)
        })

        act(() => {
            hookResult.changeLanguage('fr')
        })

        expect(changeLanguageMock).toHaveBeenCalledWith('fr')
    })
})
