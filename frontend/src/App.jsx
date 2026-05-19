import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserDashboard from './pages/user/UserDashboard';
import { Layers, LogOut } from 'lucide-react';

const PrivateRoute = ({ children, role }) => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    if (!token) return <Navigate to="/" />;
    if (role && userRole !== role) return <Navigate to="/" />;
    
    return children;
};

const Header = () => {
    const location = useLocation();
    const hasToken = !!localStorage.getItem('token');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <header
            className={[
                'fixed top-0 left-0 right-0 z-50 w-full',
                'bg-slate-950/80 backdrop-blur-xl',
                'border-b transition-all duration-300',
                scrolled
                    ? 'border-indigo-500/20 shadow-[0_4px_24px_rgba(99,102,241,0.12)]'
                    : 'border-white/5 shadow-none',
            ].join(' ')}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Layers className="text-white" size={18} />
                    </div>
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-purple-200">
                        TaskFlow <span className="text-indigo-400 font-light text-base sm:text-xl">Pro</span>
                    </h1>
                </div>
                {hasToken && (
                    <button
                        onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Sign Out</span>
                    </button>
                )}
            </div>
        </header>
    );
};

const AdminRoute = () => {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    if (token) {
        if (userRole === 'admin') {
            return <AdminDashboard />;
        } else {
            return <Navigate to="/user" />;
        }
    }
    return <Login defaultRole="admin" />;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col relative overflow-x-hidden">
        {/* Background ambient light */}
        <div className="fixed top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none z-0" />

        <Header />

        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-20 sm:pt-24 pb-12 relative z-10">
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/admin" element={<AdminRoute />} />
                <Route 
                    path="/user" 
                    element={
                        <PrivateRoute role="user">
                            <UserDashboard />
                        </PrivateRoute>
                    } 
                />
            </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
