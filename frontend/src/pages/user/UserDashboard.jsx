import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    CheckCircle, 
    Clock, 
    XCircle, 
    Bell, 
    Loader, 
    Activity, 
    Zap, 
    Lock, 
    Search, 
    Grid, 
    List, 
    Flame, 
    TrendingUp, 
    Calendar,
    ChevronRight,
    Award,
    Sun,
    Sunrise,
    Moon
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const publicVapidKey = 'BG-mulIt1eT9GfRLGI4GsyMgvJ9vwOk-N3w95EyxHxpVNJ7smMtC8cTEWTYcr2W3vztatc5yV1D-ccUPY9v8oDo';

// Function to convert Base64 string to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

const UserDashboard = () => {
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    
    // UI states
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'timeline'
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'completed' | 'missed'
    const [searchQuery, setSearchQuery] = useState('');
    
    // Get the user's name from localStorage
    const userName = localStorage.getItem('userName') || 'User';

    const checkSubscription = async () => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                let registration = await navigator.serviceWorker.getRegistration();
                if (!registration) {
                    registration = await navigator.serviceWorker.register('/service-worker.js');
                }
                await navigator.serviceWorker.ready;

                const existingSub = await registration.pushManager.getSubscription();
                if (existingSub) {
                    setIsSubscribed(true);
                    
                    const token = localStorage.getItem('token');
                    if (token) {
                        const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
                        const subscriptionData = {
                            endpoint: existingSub.endpoint,
                            keys: {
                                p256dh: existingSub.toJSON().keys?.p256dh,
                                auth: existingSub.toJSON().keys?.auth
                            },
                            timezoneOffset: new Date().getTimezoneOffset()
                        };
                        await axios.post(`${API_BASE_URL}/api/user/subscribe`, subscriptionData, {
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(() => {});
                    }
                }
            } catch (error) {
                console.error('Error checking subscription:', error);
            }
        }
    };

    const fetchTimeline = async () => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            
            const localDate = new Date();
            const offset = localDate.getTimezoneOffset();
            const localNow = new Date(localDate.getTime() - (offset * 60 * 1000));
            const todayStr = localNow.toISOString().split('T')[0];

            const response = await axios.get(`${API_BASE_URL}/api/user/timeline?date=${todayStr}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTimeline(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch timeline', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeline();
        checkSubscription();

        // Poll every 60s when tab is active
        const interval = setInterval(() => {
            if (!document.hidden) fetchTimeline();
        }, 60000);

        // Immediately re-fetch when user comes back to the tab or laptop wakes from sleep
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchTimeline();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const markCompleted = async (taskId) => {
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            await axios.put(`${API_BASE_URL}/api/user/tasks/${taskId}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTimeline();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to complete task');
        }
    };

    const subscribeToNotifications = async () => {
        setSubscribing(true);
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
                alert('Your browser does not support Push Notifications.');
                setSubscribing(false);
                return;
            }

            if (Notification.permission === 'denied') {
                alert('Notifications are blocked in your browser. Please allow them in your site settings to enable alerts.');
                setSubscribing(false);
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('You need to grant permission to receive notifications.');
                setSubscribing(false);
                return;
            }

            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                registration = await navigator.serviceWorker.register('/service-worker.js');
            }
            
            await navigator.serviceWorker.ready;
            
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
            }

            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5000';
            const subscriptionData = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.toJSON().keys?.p256dh,
                    auth: subscription.toJSON().keys?.auth
                },
                timezoneOffset: new Date().getTimezoneOffset()
            };
            await axios.post(`${API_BASE_URL}/api/user/subscribe`, subscriptionData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setIsSubscribed(true);
            alert('Successfully subscribed to notifications!');
        } catch (error) {
            console.error('Subscription error', error);
            alert('Failed to subscribe: ' + error.message);
        } finally {
            setSubscribing(false);
        }
    };

    // Helper to get visual status (consistent with individual cards)
    const getVisualStatus = (task) => {
        if (task.status === 'pending') {
            const scheduledTime = new Date(task.scheduled_time);
            const endTime = new Date(scheduledTime.getTime() + task.duration_minutes * 60000);
            if (new Date() > endTime) {
                return 'missed';
            }
        }
        return task.status;
    };

    const getGreetingText = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getGreetingIcon = () => {
        const hour = new Date().getHours();
        if (hour < 12) return <Sunrise className="w-8 h-8 md:w-10 md:h-10 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />;
        if (hour < 17) return <Sun className="w-8 h-8 md:w-10 md:h-10 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />;
        return <Moon className="w-8 h-8 md:w-10 md:h-10 text-indigo-300 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" />;
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-primary" size={48} /></div>;

    // Calculate Progress
    const completedTasks = timeline.filter(t => getVisualStatus(t) === 'completed').length;
    const missedTasksCount = timeline.filter(t => getVisualStatus(t) === 'missed').length;
    const pendingTasksCount = timeline.filter(t => getVisualStatus(t) === 'pending').length;
    const totalTasks = timeline.length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Dynamic Streak Metric (Gamification)
    const streakDays = completedTasks > 0 ? Math.min(Math.floor(completedTasks / 2) + 1, 5) : 0;
    
    // Find the next pending task that has not expired yet
    const nextTask = timeline.find(t => {
        if (getVisualStatus(t) !== 'pending') return false;
        const endTime = new Date(new Date(t.scheduled_time).getTime() + t.duration_minutes * 60000);
        return new Date() < endTime;
    });

    const getStatusIcon = (status, isUpcoming) => {
        if (status === 'pending' && isUpcoming) return <Lock size={18} />;
        switch(status) {
            case 'completed': return <CheckCircle size={18} />;
            case 'missed': return <XCircle size={18} />;
            default: return <Clock size={18} />;
        }
    };

    // Filtering logic
    const filteredTimeline = timeline.filter(task => {
        const visualStatus = getVisualStatus(task);
        
        // Status filter
        if (statusFilter !== 'all' && visualStatus !== statusFilter) return false;
        
        // Search query
        if (searchQuery && !task.task_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        
        return true;
    });
    
    const chartData = timeline.map(task => {
        const scheduledTime = new Date(task.scheduled_time);
        return {
            time: scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            duration: task.duration_minutes,
            name: task.task_name,
            isCompleted: task.status === 'completed'
        };
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 relative">
            {/* Ambient Background Lights - Clipped to prevent horizontal body overflow and viewport scaling bugs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[20%] w-[15rem] h-[15rem] md:w-[35rem] md:h-[35rem] bg-indigo-500/10 rounded-full blur-[80px] md:blur-[120px]" />
                <div className="absolute top-[30%] right-[10%] w-[10rem] h-[10rem] md:w-[25rem] md:h-[25rem] bg-fuchsia-500/5 rounded-full blur-[60px] md:blur-[100px]" />
            </div>

            {/* Premium Header Section */}
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between relative z-10">
                <div className="text-center md:text-left">
                    <h2 className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 text-2xl sm:text-3xl md:text-5xl font-black mb-2">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-300">
                            {getGreetingText()}, {userName.split(' ')[0]}
                        </span>
                        <span className="inline-block select-none">
                            {getGreetingIcon()}
                        </span>
                    </h2>
                    <p className="text-slate-400 font-medium text-sm md:text-base">Keep crushing your routines. Consistency is key.</p>
                </div>
                
                <div className="flex items-center gap-3 bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-2 md:p-3 rounded-2xl self-start md:self-auto">
                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-xl">
                        <Calendar size={14} />
                        <span>Today</span>
                    </div>
                    <button 
                        onClick={subscribeToNotifications} 
                        disabled={subscribing || isSubscribed}
                        className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                            isSubscribed 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-105 active:scale-95'
                        }`}
                    >
                        <Bell size={18} className={subscribing ? 'animate-ping' : (isSubscribed ? '' : 'group-hover:animate-swing')} />
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900 text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-800 shadow-xl">
                            {isSubscribed ? 'Alerts Active' : 'Enable Alerts'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Advanced Analytics & Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                {/* Progress & Next Task (Hero) */}
                <div className="glass-card p-8 rounded-3xl lg:col-span-1 flex flex-col justify-between relative overflow-hidden group border-indigo-500/10">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 z-0" />
                    
                    <div className="relative z-10 flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Daily Completion</h3>
                            <p className="text-sm text-indigo-300/80 font-medium">{completedTasks} of {totalTasks} finished</p>
                        </div>
                        {/* Glowing Circular Progress */}
                        <div className="relative w-18 h-18 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-900" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)] transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="absolute text-base font-extrabold text-white">{progressPercent}%</span>
                        </div>
                    </div>

                    {/* Next Task Card */}
                    <div className="relative z-10 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider mb-2">
                            <Zap size={14} className="animate-pulse" /> Next Activity
                        </div>
                        {nextTask ? (
                            <>
                                <h4 className="text-xl font-bold text-white mb-1">{nextTask.task_name}</h4>
                                <p className="text-slate-400 text-xs font-semibold">
                                    {new Date(nextTask.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {nextTask.duration_minutes} mins
                                </p>
                            </>
                        ) : (
                            <div className="text-slate-400 text-xs font-medium italic">All caught up! No active pending tasks left.</div>
                        )}
                    </div>
                </div>

                {/* Daily Workload Chart */}
                <div className="glass-card p-6 rounded-3xl lg:col-span-2 border-slate-800/80">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-indigo-400" />
                            <h3 className="text-base font-bold text-white">Daily Routine Workload Curve</h3>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                            <TrendingUp size={12} /> Active Schedule
                        </span>
                    </div>
                    <div className="h-52 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: -30, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="#334155" tick={{fill: '#64748b', fontSize: 9, fontWeight: 600}} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                    <YAxis stroke="#334155" tick={{fill: '#64748b', fontSize: 9, fontWeight: 600}} tickLine={false} axisLine={false} width={28} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.3)" vertical={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)' }}
                                        labelStyle={{ color: '#818cf8', fontWeight: 700, fontSize: 11, marginBottom: '4px' }}
                                        itemStyle={{ color: '#f1f5f9', fontSize: 11 }}
                                    />
                                    <Area type="monotone" dataKey="duration" name="Duration (mins)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorDuration)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-600 italic text-sm">No scheduling data recorded.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Metrics & Interactive Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10">
                {/* Tab: Scheduled / All */}
                <div 
                    onClick={() => setStatusFilter('all')}
                    className={`glass-card p-4 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 active:scale-95 border-slate-800/80 hover:scale-[1.02] ${
                        statusFilter === 'all' 
                            ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500/30' 
                            : 'hover:border-indigo-500/20'
                    }`}
                >
                    <p className="text-3xl font-black text-indigo-400 mb-0.5">{totalTasks}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">All Scheduled</p>
                </div>
                
                {/* Tab: Completed */}
                <div 
                    onClick={() => setStatusFilter('completed')}
                    className={`glass-card p-4 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 active:scale-95 border-slate-800/80 hover:scale-[1.02] ${
                        statusFilter === 'completed' 
                            ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/30' 
                            : 'hover:border-emerald-500/20'
                    }`}
                >
                    <p className="text-3xl font-black text-emerald-400 mb-0.5">{completedTasks}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Completed</p>
                </div>
                
                {/* Tab: Missed */}
                <div 
                    onClick={() => setStatusFilter('missed')}
                    className={`glass-card p-4 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 active:scale-95 border-slate-800/80 hover:scale-[1.02] ${
                        statusFilter === 'missed' 
                            ? 'border-red-500 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30' 
                            : 'hover:border-red-500/20'
                    }`}
                >
                    <p className="text-3xl font-black text-red-400 mb-0.5">{missedTasksCount}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Missed</p>
                </div>
                
                {/* Tab: Pending */}
                <div 
                    onClick={() => setStatusFilter('pending')}
                    className={`glass-card p-4 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 active:scale-95 border-slate-800/80 hover:scale-[1.02] ${
                        statusFilter === 'pending' 
                            ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30' 
                            : 'hover:border-amber-500/20'
                    }`}
                >
                    <p className="text-3xl font-black text-amber-400 mb-0.5">{pendingTasksCount}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Pending</p>
                </div>
                
                {/* Streak card (Static metric, non-clickable) */}
                <div className="glass-card p-4 flex flex-col items-center justify-center col-span-1 md:col-span-1 border-slate-800/80 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/10 hover:border-amber-500/30 transition-colors">
                    <div className="flex items-center gap-1.5 text-amber-500 font-black">
                        <Flame size={20} className="animate-pulse text-amber-400" />
                        <span className="text-3xl">{streakDays}</span>
                    </div>
                    <p className="text-[10px] font-extrabold text-amber-500/80 uppercase tracking-widest">Active Streak</p>
                </div>
            </div>

            {/* Premium Controls Row */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between relative z-10 border-slate-800/80 bg-slate-900/20">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Search daily routine..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 text-sm placeholder-slate-500 transition-all"
                    />
                </div>

                {/* View Mode Switcher */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                    <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Grid Layout"
                        >
                            <Grid size={16} />
                        </button>
                        <button 
                            onClick={() => setViewMode('timeline')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Timeline Layout"
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Daily Schedule Display Area */}
            <div className="relative z-10">
                {filteredTimeline.length > 0 ? (
                    viewMode === 'grid' ? (
                        /* GRID VIEW */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredTimeline.map((task) => {
                                const now = new Date();
                                const scheduledTime = new Date(task.scheduled_time);
                                const timeString = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                
                                const endTime = new Date(scheduledTime.getTime() + task.duration_minutes * 60000);
                                const endTimeString = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                
                                const isUpcoming = now < scheduledTime;
                                const isExpired = now > endTime;
                                
                                const visualStatus = getVisualStatus(task);
                                
                                const isPending = visualStatus === 'pending';
                                const isCompleted = visualStatus === 'completed';
                                const isMissed = visualStatus === 'missed';
                                
                                // Glowing borders & color mappings with beautiful ambient shadows
                                const cardBorder = isPending
                                    ? (isUpcoming 
                                        ? 'border-slate-800/80 hover:border-slate-700/80 bg-slate-900/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]' 
                                        : 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-950/10 shadow-[0_0_20px_rgba(99,102,241,0.08)] hover:shadow-[0_0_30px_rgba(99,102,241,0.22)] ring-1 ring-indigo-500/20')
                                    : (isCompleted 
                                        ? 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-950/5 shadow-[0_0_20px_rgba(16,185,129,0.08)] hover:shadow-[0_0_30px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/10' 
                                        : 'border-red-500/20 hover:border-red-500/50 bg-red-950/5 shadow-[0_0_20px_rgba(239,68,68,0.08)] hover:shadow-[0_0_30px_rgba(239,68,68,0.22)] ring-1 ring-red-500/10');
                                    
                                const badgeClass = isPending 
                                    ? (isUpcoming ? 'bg-slate-800/80 text-slate-400 border border-slate-700/50' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse')
                                    : (isCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20');

                                return (
                                    <div 
                                        key={task.id} 
                                        className={`glass-card rounded-[24px] p-6 border transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between group shadow-xl ${cardBorder}`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-center mb-6">
                                                <div className={`p-2.5 rounded-xl ${
                                                    isPending 
                                                        ? (isUpcoming ? 'bg-slate-800/60 text-slate-500' : 'bg-indigo-500/10 text-indigo-400')
                                                        : (isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')
                                                }`}>
                                                    {getStatusIcon(visualStatus, isUpcoming)}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${badgeClass}`}>
                                                    {isPending && isUpcoming ? 'Locked' : visualStatus}
                                                </span>
                                            </div>

                                            <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-indigo-300 transition-colors">
                                                {task.task_name}
                                            </h3>
                                            
                                            <div className="flex flex-col gap-1 text-slate-400 text-xs font-semibold mb-6">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={14} className={isPending && !isUpcoming ? 'text-indigo-400' : 'text-slate-500'} />
                                                    <span>{timeString} - {endTimeString}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                                                    Duration: {task.duration_minutes} mins
                                                </span>
                                            </div>
                                        </div>

                                        {isPending ? (
                                            isUpcoming ? (
                                                <button 
                                                    disabled
                                                    className="w-full bg-slate-900/40 text-slate-600 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-800/50 cursor-not-allowed text-xs"
                                                >
                                                    <Lock size={14} /> Opens at {timeString}
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => markCompleted(task.id)}
                                                    className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-[1.01]"
                                                >
                                                    <CheckCircle size={16} /> Mark Completed
                                                </button>
                                            )
                                        ) : (
                                            <div className={`w-full py-3 rounded-xl font-bold text-center border text-xs ${
                                                isCompleted 
                                                    ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' 
                                                    : 'bg-red-500/5 text-red-400 border-red-500/10'
                                            }`}>
                                                {isCompleted ? 'Task Finished 🎉' : 'Task Missed ❌'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* TIMELINE VIEW (Vertical flow layout) */
                        <div className="relative pl-8 md:pl-10 space-y-4 md:space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800/60 before:border-dashed before:border-slate-800">
                            {filteredTimeline.map((task, idx) => {
                                const now = new Date();
                                const scheduledTime = new Date(task.scheduled_time);
                                const timeString = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                
                                const endTime = new Date(scheduledTime.getTime() + task.duration_minutes * 60000);
                                const endTimeString = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                
                                const isUpcoming = now < scheduledTime;
                                const visualStatus = getVisualStatus(task);
                                
                                const isPending = visualStatus === 'pending';
                                const isCompleted = visualStatus === 'completed';
                                const isMissed = visualStatus === 'missed';

                                // Color definitions for dots and lines
                                let dotColor = 'bg-slate-800 border-slate-700 text-slate-500';
                                if (isPending && !isUpcoming) dotColor = 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse';
                                if (isCompleted) dotColor = 'bg-emerald-600 border-emerald-400 text-white';
                                if (isMissed) dotColor = 'bg-red-600 border-red-400 text-white';

                                // Glowing borders & color mappings with beautiful ambient shadows
                                const rowBorder = isPending
                                    ? (isUpcoming 
                                        ? 'border-slate-800/80 hover:border-slate-700/80 bg-slate-900/30' 
                                        : 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-950/5 shadow-[0_0_20px_rgba(99,102,241,0.06)] hover:shadow-[0_0_25px_rgba(99,102,241,0.18)]')
                                    : (isCompleted 
                                        ? 'border-emerald-500/20 hover:border-emerald-500/50 bg-emerald-950/5 shadow-[0_0_20px_rgba(16,185,129,0.06)] hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]' 
                                        : 'border-red-500/20 hover:border-red-500/50 bg-red-950/5 shadow-[0_0_20px_rgba(239,68,68,0.06)] hover:shadow-[0_0_25px_rgba(239,68,68,0.15)]');

                                return (
                                    <div key={task.id} className="relative group animate-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                        {/* Step Indicator Dot */}
                                        <div className={`absolute left-[-26px] md:left-[-37px] top-4 w-5 h-5 md:w-8 md:h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 ${dotColor}`}>
                                            {getStatusIcon(visualStatus, isUpcoming)}
                                        </div>

                                        {/* Step Details Box */}
                                        <div className={`glass-card p-4 md:p-5 border transition-all duration-300 rounded-[22px] flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:-translate-y-0.5 ${rowBorder}`}>
                                            <div className="flex flex-col md:flex-row gap-4 md:items-center">
                                                <div className="bg-slate-950/80 px-3 py-2 rounded-xl text-center border border-slate-800 min-w-20 md:min-w-28 shadow-inner">
                                                    <span className="text-indigo-400 font-extrabold text-sm block">{timeString}</span>
                                                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">{endTimeString} End</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                                                        {task.task_name}
                                                    </h4>
                                                    <p className="text-xs font-semibold text-slate-500">
                                                        Scheduled routine slot • {task.duration_minutes} minutes
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Step Actions */}
                                            <div className="flex justify-start md:justify-end md:min-w-40">
                                                {isPending ? (
                                                    isUpcoming ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800">
                                                            <Lock size={12} /> Locked
                                                        </span>
                                                    ) : (
                                                        <button 
                                                            onClick={() => markCompleted(task.id)}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                                                        >
                                                            <CheckCircle size={14} /> Done
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border ${
                                                        isCompleted 
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }`}>
                                                        {isCompleted ? 'Finished 🎉' : 'Missed ❌'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    /* EMPTY STATE */
                    <div className="flex flex-col items-center justify-center py-20 glass-card rounded-[32px] border-dashed border-2 border-slate-800/80">
                        <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-indigo-400 animate-pulse">
                            <Award size={36} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Clean Slate!</h3>
                        <p className="text-slate-400 text-sm max-w-sm text-center">
                            No tasks found matching your filter parameters. Enjoy the peace or try refining your search.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserDashboard;
