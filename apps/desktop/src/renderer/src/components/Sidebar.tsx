import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { SidebarContainer, LogoContainer, LogoTitle, Nav, ButtonContainer } from './Sidebar.styles'
import { MenuItem } from './ui/menuitem'

const Sidebar = () => {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Portfolio', icon: '📊' },
    { path: '/discover', label: 'Discover', icon: '🔍' },
    { path: '/swap', label: 'Swap', icon: '🔄' },
    { path: '/staking', label: 'Staking', icon: '💰' },
    { path: '/menu', label: 'Menu', icon: '⚙️' }
  ]

  return (
    <SidebarContainer>
      <LogoContainer>
        <LogoTitle>Pera Wallet</LogoTitle>
      </LogoContainer>
      <Nav>
        {menuItems.map((item) => (
          <Link key={item.path} to={item.path}>
            <MenuItem active={location.pathname === item.path}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </MenuItem>
          </Link>
        ))}
      </Nav>
      <ButtonContainer>
        <Button variant="outline">
          <span>🚪</span>
          <span>Logout</span>
        </Button>
      </ButtonContainer>
    </SidebarContainer>
  )
}

export default Sidebar

