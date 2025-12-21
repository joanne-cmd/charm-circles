import { WalletProvider } from './contexts/WalletContext';
import { Header } from './components/Header';
import { CircleGrid } from './components/CircleGrid';

function App() {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-midnight">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-cool mb-2">
              Welcome to CharmCircle
            </h1>
            <p className="text-gray-cool/80">
              Discover and join Bitcoin ROSCA circles. Connect your wallet to get started.
            </p>
          </div>
          <CircleGrid />
        </main>
      </div>
    </WalletProvider>
  );
}

export default App;

