const StakingScreen = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Staking</h1>
      <p>Earn rewards by staking your assets</p>
      {/* Placeholder content */}
      <div className="grid grid-cols-1 gap-4 mt-4">
        <div className="p-4 border rounded">
          <h3 className="font-semibold">Available Pools</h3>
          <p>View and participate in staking pools</p>
        </div>
        <div className="p-4 border rounded">
          <h3 className="font-semibold">My Stakes</h3>
          <p>Manage your active stakes</p>
        </div>
      </div>
    </div>
  );
};

export default StakingScreen;
