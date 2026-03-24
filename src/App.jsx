import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar    from './components/Navbar';
import Landing   from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Verify    from './pages/Verify';
import Forum     from './pages/Forum';
import { WalletProvider } from './context/WalletContext';
import { I18nProvider }   from './context/i18nContext';

export default function App() {
  return (
    <I18nProvider>
      <WalletProvider>
        <BrowserRouter>
          <div
            className="min-h-screen"
            style={{
              background: 'linear-gradient(180deg, #f8fbfe 0%, #ffffff 22%, #ffffff 100%)',
            }}
          >
            <Navbar />
            <Routes>
              <Route path="/"           element={<Landing />} />
              <Route path="/dashboard"  element={<Dashboard />} />
              <Route path="/verify"     element={<Verify />} />
              <Route path="/forum"      element={<Forum />} />
            </Routes>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </I18nProvider>
  );
}
