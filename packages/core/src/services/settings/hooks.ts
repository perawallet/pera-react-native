import { useAppStore } from "../../store/app-store"

export const useSettings = () => {
    const { theme, setTheme } = useAppStore()

    return {
        theme,
        setTheme
    }
}