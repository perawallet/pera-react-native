import { Button } from '../../components/ui/button'
import { ActionsContainer } from './PortfolioActions.styles'

const PortfolioActions = () => {
  return (
    <ActionsContainer>
      <Button size="lg">📤 Send</Button>
      <Button size="lg" variant="secondary">
        📥 Receive
      </Button>
      <Button size="lg" variant="outline">
        🔄 Swap
      </Button>
    </ActionsContainer>
  )
}

export default PortfolioActions
