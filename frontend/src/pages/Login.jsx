import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogIn, UserCircle, ShieldAlert } from 'lucide-react';

const Login = ({ defaultRole = 'user' }) => {
    const [role, setRole] = useState(defaultRole);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setRole(defaultRole);
    }, [defaultRole]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userRole = localStorage.getItem('role');
        if (token && userRole) {
            navigate(userRole === 'admin' ? '/admin' : '/user');
        }
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '';
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
                window.location.href = '/admin';
            } else {
                window.location.href = '/user';
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
                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                        {role === 'admin' ? 'Admin Portal' : 'Welcome Back'}
                    </h2>
                    <p className="text-slate-400 text-sm">
                        {role === 'admin' ? 'Sign in to manage the automation system' : 'Sign in to access your automation dashboard'}
                    </p>
                </div>

                {error && (
                    <div className="relative z-10 bg-danger/10 border border-danger/30 text-red-400 p-3 rounded-xl mb-6 text-sm text-center flex items-center justify-center gap-2 animate-pulse">
                        <ShieldAlert size={16} /> {error}
                    </div>
                )}

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
