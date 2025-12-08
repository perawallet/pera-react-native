import { useTranslation } from 'react-i18next'
import { useCallback } from 'react'

export const useLanguage = () => {
    const { t, i18n } = useTranslation()

    const changeLanguage = useCallback(
        (language: string) => {
            i18n.changeLanguage(language)
        },
        [i18n]
    )

    return {
        t,
        currentLanguage: i18n.language,
        changeLanguage,
    }
}
