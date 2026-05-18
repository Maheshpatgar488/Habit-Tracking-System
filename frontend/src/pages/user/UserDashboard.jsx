import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, Clock, XCircle, Bell, Loader, Activity, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const publicVapidKey = 'BG-mulIt1eT9GfRLGI4GsyMgvJ9vwOk-N3w95EyxHxpVNJ7smMtC8cTEWTYcr2W3vztatc5yV1D-ccUPY9v8oDo'; // This will need to be replaced with the actual key

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
                    
                    // Automatically sync existing subscription to backend for the current user
                    // This prevents the user from needing to manually re-enable notifications after login
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
                        }).catch(() => {}); // Ignore errors if already synced
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
            
            // Get local date in YYYY-MM-DD format, adjusting for timezone offset
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
                alert('Notifications are blocked in your browser. Please allow them in your site settings (usually the lock icon in the URL bar) to enable alerts.');
                setSubscribing(false);
                return;
            }

            // Request permission immediately to retain user gesture
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('You need to grant permission to receive notifications. Please try again or check your browser settings.');
                setSubscribing(false);
                return;
            }

            // Ensure Service Worker is registered
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                registration = await navigator.serviceWorker.register('/service-worker.js');
            }
            
            await navigator.serviceWorker.ready;
            
            // Reuse existing subscription if it exists, otherwise create a new one
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

    const getStatusStyle = (status) => {
        switch(status) {
            case 'completed': return 'bg-secondary/20 border-secondary/50 text-secondary';
            case 'missed': return 'bg-danger/20 border-danger/50 text-danger';
            default: return 'bg-slate-800 border-slate-700 text-slate-300';
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'completed': return <CheckCircle size={20} />;
            case 'missed': return <XCircle size={20} />;
            default: return <Clock size={20} />;
        }
    };

    if (loading) return <div className="flex justify-center items-center h-64"><Loader className="animate-spin text-primary" size={48} /></div>;

    // Calculate Progress
    const completedTasks = timeline.filter(t => t.status === 'completed').length;
    const totalTasks = timeline.length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    // Advanced UI Data
    const nextTask = timeline.find(t => t.status === 'pending');
    
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
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
            {/* Premium Header Section */}
            <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
                <div>
                    <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-indigo-400 mb-3">
                        Welcome, {userName.split(' ')[0]}
                    </h2>
                    <p className="text-slate-400 text-lg">Here is your daily routine. Stay on track today.</p>
                </div>
                
                <div className="flex items-center gap-6 glass-card p-4 rounded-3xl">
                    <button 
                        onClick={subscribeToNotifications} 
                        disabled={subscribing || isSubscribed}
                        className={`group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${isSubscribed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] hover:scale-110'}`}
                    >
                        <Bell size={20} className={subscribing ? 'animate-ping' : (isSubscribed ? '' : 'group-hover:animate-bounce')} />
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
                            {isSubscribed ? 'Notifications On' : 'Enable Alerts'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Advanced Analytics & Hero Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Progress & Next Task (Hero) */}
                <div className="glass-card p-8 rounded-3xl lg:col-span-1 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/5 z-0" />
                    
                    <div className="relative z-10 flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Overall Progress</h3>
                            <p className="text-sm text-indigo-300">{completedTasks} of {totalTasks} Completed</p>
                        </div>
                        {/* Circular Progress */}
                        <div className="relative w-20 h-20 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-indigo-500 drop-shadow-[0_0_10px_rgba(99,102,241,1)] transition-all duration-1000 ease-out" strokeWidth="3" strokeDasharray={`${progressPercent}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="absolute text-lg font-bold text-white">{progressPercent}%</span>
                        </div>
                    </div>

                    <div className="relative z-10 p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
                            <Zap size={16} className="animate-pulse" /> Next Up
                        </div>
                        {nextTask ? (
                            <>
                                <h4 className="text-2xl font-bold text-white mb-1">{nextTask.task_name}</h4>
                                <p className="text-slate-400 text-sm">{new Date(nextTask.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {nextTask.duration_minutes}m</p>
                            </>
                        ) : (
                            <div className="text-slate-400 text-sm">You have no pending tasks! Enjoy your day.</div>
                        )}
                    </div>
                </div>

                {/* Daily Workload Chart */}
                <div className="glass-card p-6 rounded-3xl lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity size={20} className="text-emerald-400" />
                        <h3 className="text-lg font-bold text-white">Today's Workload Curve</h3>
                    </div>
                    <div className="h-56 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="time" stroke="#475569" tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#475569" tick={{fill: '#94a3b8', fontSize: 12}} tickLine={false} axisLine={false} />
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                    />
                                    <Area type="monotone" dataKey="duration" name="Duration (min)" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorDuration)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 italic">No task data available.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* User Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 flex flex-col items-center justify-center border-indigo-500/20">
                    <p className="text-3xl font-bold text-indigo-400 mb-1">{totalTasks}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled</p>
                </div>
                <div className="glass-card p-4 flex flex-col items-center justify-center border-emerald-500/20">
                    <p className="text-3xl font-bold text-emerald-400 mb-1">{completedTasks}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</p>
                </div>
                <div className="glass-card p-4 flex flex-col items-center justify-center border-red-500/20">
                    <p className="text-3xl font-bold text-red-400 mb-1">{timeline.filter(t => t.status === 'missed').length}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Missed</p>
                </div>
                <div className="glass-card p-4 flex flex-col items-center justify-center border-slate-500/20">
                    <p className="text-3xl font-bold text-slate-300 mb-1">{timeline.filter(t => t.status === 'pending').length}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                </div>
            </div>

            {/* Tasks Grid */}
            {timeline.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {timeline.map((task) => {
                        const scheduledTime = new Date(task.scheduled_time);
                        const timeString = scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        const isPending = task.status === 'pending';
                        const isCompleted = task.status === 'completed';
                        const isMissed = task.status === 'missed';

                        return (
                            <div key={task.id} className={`relative overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:-translate-y-2 group ${isPending ? 'bg-gradient-to-br from-indigo-500/40 via-purple-500/10 to-transparent hover:shadow-[0_15px_30px_rgba(99,102,241,0.2)]' : (isCompleted ? 'bg-emerald-500/20' : 'bg-red-500/20')}`}>
                                <div className={`h-full w-full rounded-[22px] p-6 backdrop-blur-2xl flex flex-col justify-between border ${isPending ? 'bg-slate-900/90 border-indigo-500/20' : (isCompleted ? 'bg-emerald-950/40 border-emerald-500/20' : 'bg-red-950/40 border-red-500/20')}`}>
                                    
                                    {/* Card Header */}
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-3 rounded-2xl ${isPending ? 'bg-indigo-500/10 text-indigo-400' : (isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}`}>
                                            {getStatusIcon(task.status)}
                                        </div>
                                        <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${isPending ? 'bg-slate-800 text-slate-300 border-slate-700' : (isCompleted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30')}`}>
                                            {task.status}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="mb-8">
                                        <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{task.task_name}</h3>
                                        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                            <Clock size={16} className="text-indigo-400" /> {timeString} 
                                            <span className="w-1 h-1 rounded-full bg-slate-600 mx-1"></span> 
                                            {task.duration_minutes} min
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    {isPending ? (
                                        <button 
                                            onClick={() => markCompleted(task.id)}
                                            className="w-full relative overflow-hidden group/btn bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-in-out" />
                                            <span className="relative z-10 flex items-center gap-2"><CheckCircle size={20} /> Mark as Done</span>
                                        </button>
                                    ) : (
                                        <div className={`w-full py-4 rounded-xl font-bold text-center border ${isCompleted ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20' : 'bg-red-500/5 text-red-500 border-red-500/20'}`}>
                                            {isCompleted ? 'Task Completed 🎉' : 'Task Missed ❌'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 glass-card rounded-3xl border-dashed border-2 border-slate-700/50">
                    <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <Clock size={40} className="text-slate-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">You're all clear!</h3>
                    <p className="text-slate-400">No tasks have been scheduled for you today.</p>
                </div>
            )}
        </div>
    );
};

export default UserDashboard;
