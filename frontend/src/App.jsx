import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
    const isLogin = location.pathname === '/';
    
    return (
        <header className="sticky top-0 z-50 glass-card mx-4 mt-4 mb-8 px-6 py-4 flex justify-between items-center rounded-2xl">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Layers className="text-white" size={20} />
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-white to-purple-200">
                    TaskFlow <span className="text-indigo-400 font-light text-xl">Pro</span>
                </h1>
            </div>
            {!isLogin && (
                <button 
                    onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Sign Out</span>
                </button>
            )}
        </header>
    );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col relative">
        {/* Background ambient light */}
        <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

        <Header />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 pb-12 relative z-10">
            <Routes>
                <Route path="/" element={<Login />} />
                <Route 
                    path="/admin" 
                    element={
                        <PrivateRoute role="admin">
                            <AdminDashboard />
                        </PrivateRoute>
                    } 
                />
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
