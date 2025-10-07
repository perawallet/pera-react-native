const NameAccountScreen = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Name Your Account</h1>
      <p>Give your account a memorable name</p>
      {/* Placeholder content */}
      <div className="mt-4">
        <input
          className="w-full p-3 border rounded mb-4"
          placeholder="Enter account name"
        />
        <button className="px-6 py-3 bg-blue-500 text-white rounded-lg">
          Continue
        </button>
      </div>
    </div>
  );
};

export default NameAccountScreen;
