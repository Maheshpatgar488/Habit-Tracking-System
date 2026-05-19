import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UserPlus, CalendarPlus, Users, Loader, ListTodo, CheckCircle, Clock, XCircle, Activity, BarChart2, PieChart as PieChartIcon, TrendingUp, X, Trash2, Calendar, ChevronDown } from 'lucide-react';

const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('today');
    const [customDate, setCustomDate] = useState(''); // for custom date picker
    
    // Manage Routine State
    const [manageRoutines, setManageRoutines] = useState([]);
    const [selectedManageUser, setSelectedManageUser] = useState(null);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    
    // User creation state
    const [newUserName, setNewUserName] = useState('');
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    
    // Routine creation state
    const [selectedUser, setSelectedUser] = useState('');
    const [taskName, setTaskName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState('');

    const fetchData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';

            // Compute local date string (IST-aware)
            const localDate = new Date();
            const offset = localDate.getTimezoneOffset();
            const localNow = new Date(localDate.getTime() - (offset * 60 * 1000));
            const todayStr = localNow.toISOString().split('T')[0];

            // For custom filter use the picked date; for all others use today as anchor
            const dateParam = dateFilter === 'custom' ? customDate : todayStr;

            const [usersRes, tasksRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/admin/users`, { headers }),
                axios.get(`${API_BASE_URL}/api/admin/tasks?filter=${dateFilter}&date=${dateParam}`, { headers })
            ]);

            setUsers(usersRes.data);
            setTasks(tasksRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch admin data', error);
            setLoading(false);
        }
    }, [dateFilter, customDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            await axios.post(`${API_BASE_URL}/api/admin/users`, {
                name: newUserName,
                username: newUserUsername,
                password: newUserPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('User created successfully!');
            setNewUserName('');
            setNewUserUsername('');
            setNewUserPassword('');
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create user');
        }
    };

    const handleCreateRoutine = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            await axios.post(`${API_BASE_URL}/api/admin/routines`, {
                user_id: selectedUser,
                task_name: taskName,
                start_time: startTime,
                duration_minutes: duration
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Routine created successfully!');
            setTaskName('');
            setStartTime('');
            setDuration('');
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to create routine');
        }
    };

    const loadUserRoutines = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            const res = await axios.get(`${API_BASE_URL}/api/admin/routines/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const user = users.find(u => u.id === userId);
            setSelectedManageUser(user);
            setManageRoutines(res.data);
            setIsManageModalOpen(true);
        } catch (error) {
            console.error('Failed to load user routines', error);
            alert('Failed to load user routines');
        }
    };

    const handleDeleteRoutine = async (routineId) => {
        if (!window.confirm('Are you sure you want to delete this routine? It will prevent future tasks from generating.')) return;
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            await axios.delete(`${API_BASE_URL}/api/admin/routines/${routineId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setManageRoutines(prev => prev.filter(r => r.id !== routineId));
        } catch (error) {
            console.error('Failed to delete routine', error);
            alert('Failed to delete routine');
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-primary" size={48} /></div>;

    // Compute the real visual status of a task (same logic as user dashboard)
    // A pending task whose end time has passed is treated as 'missed' in the UI
    const getVisualStatus = (task) => {
        if (task.status === 'pending') {
            const scheduledTime = new Date(task.scheduled_time);
            const endTime = new Date(scheduledTime.getTime() + task.duration_minutes * 60000);
            if (new Date() > endTime) return 'missed';
        }
        return task.status;
    };

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => getVisualStatus(t) === 'completed').length;
    const missedTasks = tasks.filter(t => getVisualStatus(t) === 'missed').length;
    const pendingTasks = tasks.filter(t => getVisualStatus(t) === 'pending').length;
    const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const userTaskCounts = {};
    tasks.forEach(task => {
        const vs = getVisualStatus(task);
        if (!userTaskCounts[task.user_name]) {
            userTaskCounts[task.user_name] = { name: task.user_name, completed: 0, missed: 0, pending: 0, total: 0 };
        }
        userTaskCounts[task.user_name].total += 1;
        if (vs === 'completed') userTaskCounts[task.user_name].completed += 1;
        if (vs === 'missed') userTaskCounts[task.user_name].missed += 1;
        if (vs === 'pending') userTaskCounts[task.user_name].pending += 1;
    });
    
    const userPerformanceList = Object.values(userTaskCounts).sort((a, b) => b.total - a.total);

    const completedPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    const pendingPercent = totalTasks === 0 ? 0 : Math.round((pendingTasks / totalTasks) * 100);
    const missedPercent = totalTasks === 0 ? 0 : Math.round((missedTasks / totalTasks) * 100);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/30 transition-colors" />
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-white">{users.length}</p>
                </div>
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/30 transition-colors" />
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Tasks {dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)}</p>
                    <p className="text-3xl font-bold text-white">{totalTasks}</p>
                </div>
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/30 transition-colors" />
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Completed</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-white">{completedTasks}</p>
                        <span className="text-sm text-emerald-400 font-bold mb-1">({completionRate}%)</span>
                    </div>
                </div>
                <div className="glass-card p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/30 transition-colors" />
                    <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Missed</p>
                    <p className="text-3xl font-bold text-white">{missedTasks}</p>
                </div>
            </div>

            {/* Professional Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* System-Wide Task Distribution */}
                <div className="glass-card p-4 sm:p-6 lg:p-8 lg:col-span-1">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-700/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700"><TrendingUp size={20} /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-wide">Task Distribution</h2>
                                <p className="text-xs text-slate-400">System-wide breakdown</p>
                            </div>
                        </div>
                        {/* Full Date Filter Bar */}
                        <div className="flex flex-col gap-2 w-full md:w-auto">
                            <div className="flex flex-wrap gap-1 bg-slate-900 rounded-lg p-1 border border-slate-700">
                                {[
                                    { key: 'today', label: 'Today' },
                                    { key: 'yesterday', label: 'Yesterday' },
                                    { key: 'last7', label: 'Last 7 Days' },
                                    { key: 'last30', label: 'Last 30 Days' },
                                    { key: 'all', label: 'All Time' },
                                    { key: 'custom', label: '📅 Pick Date' },
                                ].map(({ key, label }) => (
                                    <button
                                        key={key}
                                        onClick={() => setDateFilter(key)}
                                        className={`flex-1 text-xs px-2.5 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                                            dateFilter === key
                                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Custom date picker — only shown when 'custom' is selected */}
                            {dateFilter === 'custom' && (
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={e => setCustomDate(e.target.value)}
                                    className="input-field text-xs py-1.5 border-indigo-500/40 focus:border-indigo-500"
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            )}
                        </div>
                    </div>
                    
                    <div className="space-y-8">
                        {/* Segmented Progress Bar */}
                        <div className="w-full h-4 flex rounded-full overflow-hidden bg-slate-800 border border-slate-700 shadow-inner">
                            <div style={{ width: `${completedPercent}%` }} className="h-full bg-emerald-500 transition-all duration-1000"></div>
                            <div style={{ width: `${pendingPercent}%` }} className="h-full bg-indigo-500 transition-all duration-1000 border-l border-slate-900/50"></div>
                            <div style={{ width: `${missedPercent}%` }} className="h-full bg-red-500 transition-all duration-1000 border-l border-slate-900/50"></div>
                        </div>

                        {/* Legend / Stats */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div><span className="text-sm font-semibold text-slate-300">Completed</span></div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-white block">{completedTasks}</span>
                                    <span className="text-xs text-emerald-400 font-bold">{completedPercent}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div><span className="text-sm font-semibold text-slate-300">Pending</span></div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-white block">{pendingTasks}</span>
                                    <span className="text-xs text-indigo-400 font-bold">{pendingPercent}%</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div><span className="text-sm font-semibold text-slate-300">Missed</span></div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-white block">{missedTasks}</span>
                                    <span className="text-xs text-red-400 font-bold">{missedPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Performance List */}
                <div className="glass-card p-4 sm:p-6 lg:p-8 lg:col-span-2 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-700/50 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 flex-shrink-0"><Users size={20} /></div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">User Performance Leaderboard</h2>
                                    <p className="text-xs text-slate-400 font-medium">Real-time habit completion scores and ranks</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse w-fit self-start sm:self-auto">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Live Performance
                            </span>
                        </div>

                        <div className={`grid grid-cols-1 ${userPerformanceList.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'} gap-6 overflow-y-auto pr-2 custom-scrollbar max-h-[420px]`}>
                            {userPerformanceList.length > 0 ? (
                                userPerformanceList.map((user, index) => {
                                    const userCompletionPercent = user.total === 0 ? 0 : Math.round((user.completed / user.total) * 100);
                                    
                                    // Tiering system
                                    let tierLabel = "Improver";
                                    let tierColor = "from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30";
                                    let trophy = "🥉";
                                    let glowColor = "hover:shadow-red-500/5";
                                    
                                    if (userCompletionPercent >= 90) {
                                        tierLabel = "Elite Member";
                                        tierColor = "from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30";
                                        trophy = "🥇";
                                        glowColor = "hover:shadow-amber-500/5";
                                    } else if (userCompletionPercent >= 75) {
                                        tierLabel = "Habit Pro";
                                        tierColor = "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30";
                                        trophy = "🥈";
                                        glowColor = "hover:shadow-emerald-500/5";
                                    } else if (userCompletionPercent >= 50) {
                                        tierLabel = "Consistent";
                                        tierColor = "from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30";
                                        trophy = "✨";
                                        glowColor = "hover:shadow-blue-500/5";
                                    }

                                    return (
                                        <div key={index} className={`group bg-slate-900/40 border border-slate-800/80 p-5 rounded-2xl hover:bg-slate-800/40 hover:border-slate-700/80 transition-all duration-300 shadow-md ${glowColor} hover:shadow-xl relative overflow-hidden flex flex-col justify-between`}>
                                            {/* Glow Background Gradient */}
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-xl group-hover:from-indigo-500/10 group-hover:to-purple-500/10 transition-all duration-300" />
                                            
                                            <div>
                                                <div className="flex justify-between items-start gap-2 mb-4 relative z-10">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-600/10 group-hover:scale-105 transition-transform duration-300">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-extrabold text-white text-base tracking-wide truncate max-w-[120px]">{user.name}</h3>
                                                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{tierLabel}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`text-xs font-black px-2.5 py-1 rounded-lg bg-gradient-to-r border ${tierColor} flex items-center gap-1`}>
                                                        <span>{trophy}</span>
                                                        <span>{userCompletionPercent}%</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-1 mb-4 relative z-10">
                                                    <div className="flex justify-between text-xs text-slate-400 font-semibold mb-1">
                                                        <span>Progress</span>
                                                        <span>{user.completed}/{user.total} Tasks</span>
                                                    </div>
                                                    <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden p-0.5 border border-slate-800/60 shadow-inner">
                                                        <div style={{ width: `${userCompletionPercent}%` }} className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${userCompletionPercent >= 80 ? 'from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : (userCompletionPercent >= 50 ? 'from-yellow-500 to-amber-400 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'from-red-500 to-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]')}`}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center mt-2 relative z-10">
                                                <div className="bg-slate-950/60 border border-slate-800/50 px-2 py-2 rounded-xl text-emerald-400 shadow-sm">
                                                    <div className="text-white text-xs font-extrabold">{user.completed}</div>
                                                    Done
                                                </div>
                                                <div className="bg-slate-950/60 border border-slate-800/50 px-2 py-2 rounded-xl text-indigo-400 shadow-sm">
                                                    <div className="text-white text-xs font-extrabold">{user.pending}</div>
                                                    Pending
                                                </div>
                                                <div className="bg-slate-950/60 border border-slate-800/50 px-2 py-2 rounded-xl text-red-400 shadow-sm">
                                                    <div className="text-white text-xs font-extrabold">{user.missed}</div>
                                                    Missed
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-14 text-slate-500 border border-dashed border-slate-800 rounded-2xl col-span-2">
                                    <Activity className="mx-auto text-slate-600 mb-3" size={32} />
                                    <p className="font-semibold text-sm">No active user performance logs yet today.</p>
                                    <p className="text-xs text-slate-600 mt-1">Pending logs will register once users check-in.</p>
                                </div>
                            )}
                        </div>

                        {/* Leaderboard Insight Banner for single user systems */}
                        {userPerformanceList.length === 1 && (
                            <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                                <span className="text-lg">💡</span>
                                <div>
                                    <p className="text-xs font-bold text-indigo-300">Leaderboard Insight</p>
                                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                                        You currently have 1 active tracking user. When you register more users (like team members, friends, or family) using the <strong className="text-white">Create New User</strong> panel below, their real-time performance scores, tier levels, and task completion cards will automatically populate this grid side-by-side!
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Management Forms Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Create User Section */}
                <div className="glass-card p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4 relative z-10">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400"><UserPlus size={20} /></div>
                        <h2 className="text-xl font-bold text-white tracking-wide">Create New User</h2>
                    </div>
                    <form onSubmit={handleCreateUser} className="space-y-4 relative z-10">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                            <input type="text" className="input-field" placeholder="John Doe" value={newUserName} onChange={e => setNewUserName(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                            <input type="text" className="input-field" placeholder="johndoe" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                            <input type="password" className="input-field" placeholder="••••••••" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-secondary w-full mt-2">Create Account</button>
                    </form>
                </div>

                {/* Routine Builder Section */}
                <div className="glass-card p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-700/50 pb-4 relative z-10">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><CalendarPlus size={20} /></div>
                        <h2 className="text-xl font-bold text-white tracking-wide">Assign Routine</h2>
                    </div>
                    <form onSubmit={handleCreateRoutine} className="space-y-4 relative z-10">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Select User</label>
                            <select className="input-field appearance-none w-full max-w-full truncate block pr-10" value={selectedUser} onChange={e => setSelectedUser(e.target.value)} required>
                                <option value="" className="bg-slate-900 text-slate-400">-- Choose User --</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id} className="bg-slate-900 text-slate-100">
                                        {user.name} ({user.username})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Task Name</label>
                            <input type="text" className="input-field" placeholder="e.g. Morning Meditation" value={taskName} onChange={e => setTaskName(e.target.value)} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Start Time</label>
                                <input type="time" className="input-field" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Duration (min)</label>
                                <input type="number" className="input-field" min="1" value={duration} onChange={e => setDuration(e.target.value)} required />
                            </div>
                        </div>
                        <button type="submit" className="btn-primary w-full mt-2">Add to Routine</button>
                    </form>
                </div>
            </div>

            {/* Users List & Live Tasks Tracking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Registered Users */}
                <div className="glass-card p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 flex-shrink-0"><Users size={20} /></div>
                        <h2 className="text-xl font-bold text-white">Registered Users</h2>
                    </div>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {users.map((user) => (
                            <div key={user.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-900/50 border border-slate-800 p-4 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer group" onClick={() => loadUserRoutines(user.id)}>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-white text-base sm:text-lg truncate">{user.name}</p>
                                        <p className="text-sm text-slate-400 truncate">@{user.username}</p>
                                    </div>
                                </div>
                                <div className="text-indigo-400 text-xs sm:text-sm font-bold group-hover:translate-x-1 transition-transform self-end sm:self-auto flex-shrink-0">
                                    Manage Routine &rarr;
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Selected Date's Tasks Output */}
                <div className="glass-card p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800/60 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0"><ListTodo size={20} /></div>
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold text-white">
                                    {dateFilter === 'today' && "Today's Tasks"}
                                    {dateFilter === 'yesterday' && "Yesterday's Tasks"}
                                    {dateFilter === 'last7' && 'Last 7 Days — Tasks'}
                                    {dateFilter === 'last30' && 'Last 30 Days — Tasks'}
                                    {dateFilter === 'all' && 'All-Time Task History'}
                                    {dateFilter === 'custom' && (customDate ? `Tasks for ${customDate}` : 'Pick a Date')}
                                </h2>
                                <p className="text-xs text-slate-500">{tasks.length} total entries</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700 w-fit">Live Sync</span>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {tasks.length > 0 ? (() => {
                            // Group tasks by date
                            const byDate = {};
                            tasks.forEach(task => {
                                // Extract only YYYY-MM-DD if date contains 'T' or a time component
                                const rawDate = task.date || '';
                                const d = typeof rawDate === 'string' && rawDate.includes('T') ? rawDate.split('T')[0] : rawDate;
                                if (!byDate[d]) byDate[d] = {};
                                if (!byDate[d][task.user_name]) byDate[d][task.user_name] = [];
                                byDate[d][task.user_name].push(task);
                            });

                            const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

                            return sortedDates.map(date => {
                                const allForDate = Object.values(byDate[date]).flat();
                                const dCompleted = allForDate.filter(t => getVisualStatus(t) === 'completed').length;
                                const dMissed    = allForDate.filter(t => getVisualStatus(t) === 'missed').length;
                                const dPending   = allForDate.filter(t => getVisualStatus(t) === 'pending').length;

                                // Human-readable date label
                                const dateLabel = (() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                                    if (date === today) return `Today — ${date}`;
                                    if (date === yesterday) return `Yesterday — ${date}`;
                                    return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                })();

                                return (
                                    <div key={date} className="bg-slate-900/30 border border-slate-700/50 rounded-xl overflow-hidden">
                                        {/* Date header with summary */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-800/40 border-b border-slate-700/40">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-indigo-400" />
                                                <span className="text-sm font-bold text-indigo-300">{dateLabel}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">✅ {dCompleted}</span>
                                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">⏳ {dPending}</span>
                                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">❌ {dMissed}</span>
                                            </div>
                                        </div>

                                        {/* Tasks grouped by user under each date */}
                                        <div className="p-3 space-y-3">
                                            {Object.keys(byDate[date]).map(userName => (
                                                <div key={userName}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">{userName.charAt(0).toUpperCase()}</div>
                                                        <h3 className="text-xs font-bold text-indigo-300">{userName}'s Schedule</h3>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {byDate[date][userName].map(task => {
                                                            const timeStr = new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                            const vs = getVisualStatus(task);
                                                            return (
                                                                <div key={task.id} className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-700/40 transition-colors">
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-white text-sm truncate">{task.task_name}</p>
                                                                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                                                            <span className="flex items-center gap-1"><Clock size={11} /> {timeStr}</span>
                                                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{task.duration_minutes}m</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex sm:justify-end flex-shrink-0">
                                                                        {vs === 'completed' && <span className="inline-flex items-center justify-center w-24 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wide gap-1.5"><CheckCircle size={11}/> Done</span>}
                                                                        {vs === 'missed'    && <span className="inline-flex items-center justify-center w-24 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wide gap-1.5"><XCircle size={11}/> Missed</span>}
                                                                        {vs === 'pending'   && <span className="inline-flex items-center justify-center w-24 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-bold uppercase tracking-wide gap-1.5"><Clock size={11}/> Pending</span>}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })() : (
                            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                                {dateFilter === 'custom' && !customDate
                                    ? 'Please pick a date using the date picker above.'
                                    : 'No tasks found for this period.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Manage Routine Modal */}
            {isManageModalOpen && selectedManageUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-2xl overflow-hidden shadow-2xl shadow-indigo-500/10 border-slate-700/50 relative">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/20">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <CalendarPlus size={20} className="text-indigo-400"/> 
                                    Manage Routine
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    Editing schedule for <span className="text-indigo-300 font-semibold">{selectedManageUser.name}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsManageModalOpen(false)}
                                className="p-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {manageRoutines.length > 0 ? (
                                <div className="space-y-3">
                                    {manageRoutines.map(routine => {
                                        // Format time strictly for display
                                        const timeParts = routine.start_time.split(':');
                                        const dateObj = new Date();
                                        dateObj.setHours(timeParts[0], timeParts[1], 0);
                                        const displayTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div key={routine.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-colors">
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-white text-base sm:text-lg truncate">{routine.task_name}</h4>
                                                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                                                        <span className="flex items-center gap-1"><Clock size={14}/> {displayTime}</span>
                                                        <span className="bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-700">{routine.duration_minutes} min</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteRoutine(routine.id)}
                                                    className="p-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20 shadow-lg flex-shrink-0 self-end sm:self-auto"
                                                    title="Delete Routine"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-slate-900/30 rounded-xl border border-dashed border-slate-700">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                                        <CalendarPlus size={24} />
                                    </div>
                                    <p className="text-slate-400 font-medium">No active routines found.</p>
                                    <p className="text-xs text-slate-500 mt-1">Use the "Assign Routine" panel to create one.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
