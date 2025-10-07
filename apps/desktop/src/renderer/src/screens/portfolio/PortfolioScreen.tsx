import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const PortfolioScreen = () => {
  // Mock data for now
  const accounts = [
    { address: 'ABC123...', name: 'Main Account', balance: '50.25' },
    { address: 'DEF456...', name: 'Savings', balance: '50.25' },
  ];

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Portfolio</h1>
        <p className="text-lg text-muted-foreground">View your portfolio value and accounts</p>
      </div>

      {/* Balance Section */}
      <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-xl text-muted-foreground">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <span className="text-6xl font-bold text-foreground">₳100.50</span>
              <span className="text-2xl text-muted-foreground">≈ $25.75 USD</span>
            </div>
          </div>

          {/* Chart Placeholder */}
          <div className="h-48 bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <p className="text-muted-foreground">Portfolio Chart</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-4">
        <Button size="lg" className="flex-1">
          📤 Send
        </Button>
        <Button size="lg" variant="secondary" className="flex-1">
          📥 Receive
        </Button>
        <Button size="lg" variant="outline" className="flex-1">
          🔄 Swap
        </Button>
      </div>

      {/* Account list */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">Accounts</h2>
        <div className="grid gap-4">
          {accounts.map(account => (
            <Link key={account.address} to="/account">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{account.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">{account.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">₳{account.balance}</p>
                      <p className="text-sm text-muted-foreground">≈ ${(parseFloat(account.balance) * 0.51).toFixed(2)} USD</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortfolioScreen;
