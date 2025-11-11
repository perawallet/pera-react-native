/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { SidebarContainer, LogoContainer, LogoTitle, Nav, ButtonContainer } from './Sidebar.styles'
import { MenuItem } from './ui/menuitem'
import React from 'react'

const Sidebar = (): React.ReactElement => {
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
