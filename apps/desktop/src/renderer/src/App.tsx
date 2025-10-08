import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryProvider } from './providers/QueryProvider'
import { AppContainer, MainContent } from './App.styles'
import { useBootstrapper } from './bootstrap/bootstrap';
import { useKeyValueStorageService, useAppStore } from '@perawallet/core';
import Sidebar from './components/Sidebar'
import PortfolioScreen from './screens/portfolio/PortfolioScreen'
import DiscoverScreen from './screens/discover/DiscoverScreen'
import SwapScreen from './screens/swap/SwapScreen'
import StakingScreen from './screens/staking/StakingScreen'
import MenuScreen from './screens/menu/MenuScreen'
import AccountScreen from './screens/account/AccountScreen'
import AssetDetailsScreen from './screens/asset-details/AssetDetailsScreen'
import SettingsScreen from './screens/settings/SettingsScreen'
import OnboardingScreen from './screens/onboarding/OnboardingScreen'
import NameAccountScreen from './screens/name-account/NameAccountScreen'
import ImportAccountScreen from './screens/import-account/ImportAccountScreen'
import { useEffect, useState } from 'react'
import { Persister } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { StyleSheetManager } from 'styled-components'


const App = () => {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [persister, setPersister] = useState<Persister>();

  const bootstrap = useBootstrapper();
  const kvService = useKeyValueStorageService();
  const accounts = useAppStore(state => state.accounts);

  useEffect(() => {
    if (!bootstrapped) {
      bootstrap().then(() => {
        const reactQueryPersistor = createAsyncStoragePersister({
          storage: kvService,
        });

        setPersister(reactQueryPersistor);
        setBootstrapped(true);
      });
    }
  }, [bootstrapped, bootstrap, kvService]);

  if (persister) {
    if (accounts.length === 0) {
      return <StyleSheetManager shouldForwardProp={(prop) => !['variant', 'asChild'].includes(prop)}>
        <QueryProvider persister={persister}>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <OnboardingScreen />
          </BrowserRouter>
        </QueryProvider>
      </StyleSheetManager>
    }

    return <StyleSheetManager shouldForwardProp={(prop) => !['variant', 'asChild'].includes(prop)}>
      <QueryProvider persister={persister}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContainer>
            <Sidebar />
            <MainContent>
              <Routes>
                <Route path="/" element={<PortfolioScreen />} />
                <Route path="/discover" element={<DiscoverScreen />} />
                <Route path="/swap" element={<SwapScreen />} />
                <Route path="/staking" element={<StakingScreen />} />
                <Route path="/menu" element={<MenuScreen />} />
                <Route path="/account" element={<AccountScreen />} />
                <Route path="/asset-details" element={<AssetDetailsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/onboarding" element={<OnboardingScreen />} />
                <Route path="/name-account" element={<NameAccountScreen />} />
                <Route path="/import-account" element={<ImportAccountScreen />} />
              </Routes>
            </MainContent>
          </AppContainer>
        </BrowserRouter>
      </QueryProvider>
    </StyleSheetManager>
  }

  return <></>
}

export default App
