import { Link } from 'react-router-dom'
import {
  MenuContainer,
  Header,
  MenuGrid,
  MenuItem,
  MenuItemIcon,
  MenuItemContent,
  VersionInfo
} from './MenuScreen.styles'

const MenuScreen = () => {
  return (
    <MenuContainer>
      <Header>
        <h1>Menu</h1>
        <p>Access settings and more options</p>
      </Header>

      <MenuGrid>
        <Link to="/settings">
          <MenuItem>
            <MenuItemIcon>⚙️</MenuItemIcon>
            <MenuItemContent>
              <h3>Settings</h3>
              <p>Configure your preferences and security options</p>
            </MenuItemContent>
          </MenuItem>
        </Link>

        <MenuItem>
          <MenuItemIcon>🆘</MenuItemIcon>
          <MenuItemContent>
            <h3>Support</h3>
            <p>Get help and contact our support team</p>
          </MenuItemContent>
        </MenuItem>

        <MenuItem>
          <MenuItemIcon>ℹ️</MenuItemIcon>
          <MenuItemContent>
            <h3>About</h3>
            <p>Learn more about Pera Wallet and our mission</p>
          </MenuItemContent>
        </MenuItem>

        <MenuItem>
          <MenuItemIcon>📱</MenuItemIcon>
          <MenuItemContent>
            <h3>Mobile App</h3>
            <p>Download the mobile version for on-the-go access</p>
          </MenuItemContent>
        </MenuItem>
      </MenuGrid>

      <VersionInfo>
        <p>Pera Wallet Desktop v1.0.0</p>
        <p className="copyright">© 2024 Algorand Foundation</p>
      </VersionInfo>
    </MenuContainer>
  );
};

export default MenuScreen;
