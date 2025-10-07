import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const DiscoverScreen = () => {
  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Discover</h1>
        <p className="text-lg text-muted-foreground">Discover new assets and opportunities</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardContent className="p-8">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">📈</div>
            <CardTitle className="mb-3">Trending Assets</CardTitle>
            <p className="text-muted-foreground leading-relaxed">Explore the most popular cryptocurrencies and track their performance</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardContent className="p-8">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">🏊</div>
            <CardTitle className="mb-3">Top Pools</CardTitle>
            <p className="text-muted-foreground leading-relaxed">Find the best liquidity pools for trading with optimal yields</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardContent className="p-8">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">📰</div>
            <CardTitle className="mb-3">News</CardTitle>
            <p className="text-muted-foreground leading-relaxed">Stay updated with the latest cryptocurrency news and market insights</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
          <CardContent className="p-8">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-200">🚀</div>
            <CardTitle className="mb-3">Projects</CardTitle>
            <p className="text-muted-foreground leading-relaxed">Discover innovative blockchain projects and emerging opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Featured Section */}
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-6">Featured This Week</h2>
        <Card className="bg-gradient-to-r from-secondary to-primary text-primary-foreground">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">New DeFi Protocol Launch</h3>
                <p className="text-lg opacity-90 mb-4">Experience the next generation of decentralized finance</p>
                <Button variant="secondary" className="font-semibold">
                  Learn More
                </Button>
              </div>
              <div className="text-6xl">🚀</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiscoverScreen;
