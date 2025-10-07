import { Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'

const Sidebar = () => {
  const location = useLocation()

  const menuItems = [
    { path: '/', label: 'Portfolio', icon: '📊' },
    { path: '/discover', label: 'Discover', icon: '🔍' },
    { path: '/swap', label: 'Swap', icon: '🔄' },
    { path: '/staking', label: 'Staking', icon: '💰' },
    { path: '/menu', label: 'Menu', icon: '⚙️' },
  ]

  return (
    <div className="w-64 bg-gray-50 h-full border-r p-6 flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Pera Wallet</h2>
        <p className="text-sm text-gray-500 mt-1">Desktop</p>
      </div>
      <nav className="space-y-2 flex-1">
        {menuItems.map(item => (
          <Link key={item.path} to={item.path}>
            <Button
              variant={location.pathname === item.path ? 'default' : 'ghost'}
              className="w-full justify-start h-12 text-base"
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Button>
          </Link>
        ))}
      </nav>
      <div>
        <Button variant="outline" className="w-full justify-start h-12 text-base">
          <span className="mr-3 text-lg">🚪</span>
          <span>Logout</span>
        </Button>
      </div>
    </div>
  )
}

export default Sidebar
