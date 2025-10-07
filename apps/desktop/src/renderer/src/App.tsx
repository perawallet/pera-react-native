import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryProvider } from './providers/QueryProvider'
import Sidebar from './components/Sidebar'
import PortfolioScreen from './screens/portfolio/PortfolioScreen'
import DiscoverScreen from './screens/discover/DiscoverScreen'
import SwapScreen from './screens/swap/SwapScreen'
import StakingScreen from './screens/staking/StakingScreen'
import MenuScreen from './screens/menu/MenuScreen'
import AccountScreen from './screens/account/AccountScreen'
import AssetDetailsScreen from './screens/asset-details/AssetDetailsScreen'
import SettingsScreen from './screens/settings/SettingsScreen'
import SettingsSubPageScreen from './screens/settings-sub-page/SettingsSubPageScreen'
import OnboardingScreen from './screens/onboarding/OnboardingScreen'
import NameAccountScreen from './screens/name-account/NameAccountScreen'
import ImportAccountScreen from './screens/import-account/ImportAccountScreen'

const App = () => {
  return (
    <QueryProvider>
      <BrowserRouter>
        <div className="h-screen w-screen bg-white text-gray-900 flex">
          <Sidebar />
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<PortfolioScreen />} />
              <Route path="/discover" element={<DiscoverScreen />} />
              <Route path="/swap" element={<SwapScreen />} />
              <Route path="/staking" element={<StakingScreen />} />
              <Route path="/menu" element={<MenuScreen />} />
              <Route path="/account" element={<AccountScreen />} />
              <Route path="/asset-details" element={<AssetDetailsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/settings-sub-page" element={<SettingsSubPageScreen />} />
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route path="/name-account" element={<NameAccountScreen />} />
              <Route path="/import-account" element={<ImportAccountScreen />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </QueryProvider>
  )
}

export default App
