import PortfolioBalance from '../../components/portfolio/PortfolioBalance'
import PortfolioActions from '../../components/portfolio/PortfolioActions'
import AccountList from '../../components/portfolio/AccountList'
import { PortfolioContainer, Header } from './PortfolioScreen.styles'
import PortfolioChart from '@renderer/components/portfolio/PortfolioChart'

const PortfolioScreen = () => {

  return (
    <PortfolioContainer>
      <Header>
        <h1>Portfolio</h1>
        <p>View your portfolio value and accounts</p>
      </Header>

      <PortfolioBalance />

      <PortfolioChart />

      <PortfolioActions />

      <AccountList />
    </PortfolioContainer>
  )
}

export default PortfolioScreen
