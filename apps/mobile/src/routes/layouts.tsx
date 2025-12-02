import FullScreenLayout from "../layouts/FullScreenLayout"
import HeaderedLayout from "../layouts/HeaderedLayout"
import SafeAreaLayout from "../layouts/SafeAreaLayout"

export const headeredLayout = ({ children }: { children: React.ReactNode }) => {
    return <HeaderedLayout>
        {children}
    </HeaderedLayout>
}

export const safeAreaLayout = ({ children }: { children: React.ReactNode }) => {
    return <SafeAreaLayout>
        {children}
    </SafeAreaLayout>
}

export const fullScreenLayout = ({ children }: { children: React.ReactNode }) => {
    return <FullScreenLayout>
        {children}
    </FullScreenLayout>
}
