import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogIn, UserCircle, ShieldAlert } from 'lucide-react';

const Login = () => {
    const [role, setRole] = useState('user');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
                username,
                password,
                role
            });

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('role', response.data.user.role);
            localStorage.setItem('userId', response.data.user.id);
            localStorage.setItem('userName', response.data.user.name);

            if (role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/user');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center h-[75vh]">
            <div className="glass-card w-full max-w-md p-8 relative overflow-hidden group">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors duration-700" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-700" />

                <div className="relative z-10 text-center mb-8">
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">Welcome Back</h2>
                    <p className="text-slate-400 text-sm">Sign in to access your automation dashboard</p>
                </div>

                {error && (
                    <div className="relative z-10 bg-danger/10 border border-danger/30 text-red-400 p-3 rounded-xl mb-6 text-sm text-center flex items-center justify-center gap-2 animate-pulse">
                        <ShieldAlert size={16} /> {error}
                    </div>
                )}

                <div className="relative z-10 flex p-1.5 bg-slate-900/50 rounded-xl mb-8 border border-slate-700/50">
                    <button 
                        type="button"
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${role === 'user' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setRole('user')}
                    >
                        <UserCircle size={18} /> User
                    </button>
                    <button 
                        type="button"
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${role === 'admin' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setRole('admin')}
                    >
                        <ShieldAlert size={18} /> Admin
                    </button>
                </div>

                <form onSubmit={handleLogin} className="relative z-10 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Enter your username"
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                        <input 
                            type="password" 
                            className="input-field" 
                            placeholder="••••••••"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="btn-primary w-full flex justify-center items-center gap-2"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn size={18} /> Sign In to {role === 'admin' ? 'Dashboard' : 'Portal'}</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
