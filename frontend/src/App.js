import React, { useState, useEffect, useCallback } from 'react';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
    BarChart, Bar
} from 'recharts';

// --- Utility Functions (Kept outside the App component) ---
const getTodayDateKey = () => new Date().toISOString().split('T')[0];

const getWeekendSummaryData = (historicalLog, weightLog) => {
    const today = new Date();
    // Calculate the most recent Saturday (6) and Sunday (0)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - (today.getDay() === 0 ? 0 : today.getDay()));
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() - 1);

    const formatKey = (date) => date.toISOString().split('T')[0];
    const saturdayKey = formatKey(saturday);
    const sundayKey = formatKey(sunday);

    const satData = historicalLog.find(d => d.date === saturdayKey);
    const sunData = historicalLog.find(d => d.date === sundayKey);
    
    // Find weight entries for text summary
    const satWeight = weightLog.find(w => w.date === saturdayKey)?.weight;
    const sunWeight = weightLog.find(w => w.date === sundayKey)?.weight;

    return {
        saturday: { 
            date: saturdayKey, 
            calories: satData?.Calories || 0,
            weight: satWeight || 'N/A'
        },
        sunday: { 
            date: sundayKey, 
            calories: sunData?.Calories || 0,
            weight: sunWeight || 'N/A'
        },
        chartData: [...historicalLog].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7)
    };
};

// --- Main App Component (All other components are defined inside here) ---
const App = () => {
    // API URL points to the Flask backend
    const API_URL = 'http://localhost:5000'; 

    const NutritionalChart = ({ data, colors, isDarkMode }) => {
        const getTextColor = () => isDarkMode ? 'white' : 'black';

        const formattedData = Object.keys(data)
            .filter(key => 
                data[key] > 0 && 
                key !== 'Calories' && 
                (key === 'FatContent' || key === 'CarbohydrateContent' || key === 'ProteinContent')
            )
            .map(key => ({
                name: key.replace('Content', '').replace(/([A-Z])/g, ' $1').trim(),
                value: data[key],
            }));

        const totalCalories = data['Calories'] || 0;

        if (totalCalories === 0) {
            return <p className={`text-center ${getTextColor()} p-4`}>No nutritional data logged today. Log a meal below!</p>;
        }

        const renderCustomizedLabel = ({ cx, cy }) => {
            return (
                <text x={cx} y={cy} dy={5} textAnchor="middle" fill={getTextColor()} className="text-sm">
                    <tspan x={cx} dy="-0.6em" className="text-xl font-bold">{totalCalories.toFixed(2)}</tspan>
                    <tspan x={cx} dy="1.5em" className="text-sm font-light">LOGGED CALORIES</tspan>
                </text>
            );
        };

        return (
            <div className="flex flex-col items-center">
                <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-purple-300' : 'text-indigo-500'} transition-colors duration-500`}>
                    Daily Nutritional Summary (Macros):
                </h3>
                <div className="flex justify-center items-center w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={formattedData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={110}
                                fill="#908f99ff"
                                paddingAngle={2}
                                dataKey="value"
                                labelLine={false}
                                label={renderCustomizedLabel}
                                cornerRadius={5}
                            >
                                {formattedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                 contentStyle={{
                                     backgroundColor: isDarkMode ? '#1f2937' : 'white',
                                     borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                                     borderRadius: '8px',
                                     fontSize: '14px',
                                     color: isDarkMode ? 'white' : 'black',
                                     padding: '10px'
                                 }}
                                 formatter={(value, name) => [`${parseFloat(value).toFixed(2)} ${name.toLowerCase().includes('fat') || name.toLowerCase().includes('protein') || name.toLowerCase().includes('carbohydr') ? 'g' : ''}`, name.replace('Content', '')]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const WeightLogger = ({ themeClasses, weightLog, setWeightLog, setWeight, newWeight, setNewWeight }) => {
        const handleWeightSubmit = (e) => {
            e.preventDefault();
            const loggedWeight = parseFloat(newWeight);

            if (isNaN(loggedWeight) || loggedWeight <= 0) {
                alert('Please enter a valid weight.');
                return;
            }

            const today = getTodayDateKey();

            setWeightLog(prevLog => {
                const existingIndex = prevLog.findIndex(entry => entry.date === today);
                const newEntry = { date: today, weight: loggedWeight };
                
                if (existingIndex > -1) {
                    const newLog = [...prevLog];
                    newLog[existingIndex] = newEntry;
                    return newLog.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
                return [newEntry, ...prevLog].sort((a, b) => new Date(b.date) - new Date(a.date));
            });
            
            setWeight(loggedWeight);

            setNewWeight('');
        };

        const latestWeight = weightLog.length > 0 ? weightLog[0].weight : 0;
        const initialWeight = weightLog[weightLog.length - 1]?.weight || latestWeight;
        const progress = (latestWeight - initialWeight).toFixed(1);
        const progressColor = progress > 0 ? 'text-red-400' : progress < 0 ? 'text-green-400' : themeClasses.listText;
        const progressLabel = progress > 0 ? `${progress} kg Gained` : progress < 0 ? `${Math.abs(progress)} kg Lost` : 'No change';

        return (
            <div className={`p-6 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-all duration-500 w-full`}>
                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Weekly Weight Tracker ⚖️</h3>
                
                <div className="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-600">
                    <div>
                        <p className={`text-sm ${themeClasses.listText}`}>Current Weight (kg):</p>
                        <p className={`text-4xl font-extrabold ${themeClasses.text}`}>{latestWeight.toFixed(1)}</p>
                    </div>
                    <div>
                        <p className={`text-sm ${themeClasses.listText}`}>Total Progress:</p>
                        <p className={`text-2xl font-extrabold ${progressColor}`}>{progressLabel}</p>
                    </div>
                </div>

                <form onSubmit={handleWeightSubmit} className="space-y-4">
                    <input
                        type="number"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        placeholder={`Enter Today's Weight (kg)`}
                        step="0.1"
                        className={`w-full p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500 transition-colors duration-500`}
                    />
                    
                    <button
                        type="submit"
                        className={`w-full px-4 py-2 rounded-full text-white font-bold bg-indigo-600 hover:bg-indigo-700 transition-transform duration-200 shadow-md`}
                    >
                        Log Weight
                    </button>
                </form>
                
                <h4 className={`text-lg font-bold mt-6 mb-2 ${themeClasses.subheading}`}>Weight History:</h4>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {weightLog.map((entry, index) => (
                        <li key={index} className={`flex justify-between ${themeClasses.listText} text-sm p-2 rounded ${index === 0 ? 'bg-gray-600/50' : ''}`}>
                            <span className="font-semibold">{entry.date}</span>
                            <span className="font-extrabold">{entry.weight.toFixed(1)} kg {index === 0 ? ' (Latest)' : ''}</span>
                        </li>
                    ))}
                    {weightLog.length === 0 && <li className={`${themeClasses.listText} text-center`}>No entries yet.</li>}
                </ul>
            </div>
        );
    };

    const WeightTrackerGraph = ({ weightLog, themeClasses, isDarkMode }) => {
        const chartData = [...weightLog].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        if (chartData.length < 2) {
            return <p className={`text-center ${themeClasses.listText} p-4`}>Log at least two weight entries to see your progress graph.</p>;
        }
        
        const lineColor = isDarkMode ? '#3c2e5dff' : '#a2a0c7ff';

        return (
            <div className={`p-6 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-colors duration-500 w-full`}>
                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Weight Progress Over Time</h3>
                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                            <XAxis 
                                dataKey="date" 
                                stroke={themeClasses.listText}
                                tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            />
                            <YAxis 
                                dataKey="weight"
                                stroke={themeClasses.listText}
                                domain={['auto', 'auto']}
                                label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: themeClasses.listText }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: isDarkMode ? '#1f2937' : 'white', 
                                    borderColor: isDarkMode ? '#b4bcc7ff' : '#d1d5db',
                                    color: themeClasses.text
                                }}
                                formatter={(value) => [`${value.toFixed(1)} kg`, 'Weight']}
                            />
                            <Legend wrapperStyle={{ color: themeClasses.listText }} />
                            <Line 
                                type="monotone" 
                                dataKey="weight" 
                                stroke={lineColor} 
                                strokeWidth={3}
                                dot={{ stroke: lineColor, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Weight"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const HistoricalCalorieChart = ({ historicalLog, themeClasses, isDarkMode, dailyGoal }) => {
        
        const allDays = [...historicalLog];

        const todayKey = getTodayDateKey();
        if (!allDays.some(d => d.date === todayKey)) {
            allDays.push({ date: todayKey, Calories: 0, Goal: dailyGoal !== 'N/A' ? parseFloat(dailyGoal) : null });
        }
        
        const chartData = allDays
            .map(log => ({
                date: log.date,
                Calories: log.Calories,
                Goal: dailyGoal !== 'N/A' ? parseFloat(dailyGoal) : null
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-7);
        
        if (chartData.length === 0) {
            return <p className={`text-center ${themeClasses.listText} p-4`}>Log meals over several days to see your calorie summary.</p>;
        }

        const goalLineColor = '#55f68bff';
        const barColor = isDarkMode ? '#ccd9e1ff' : '#e14262ff';

        return (
            <div className={`p-6 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-colors duration-500 w-full`}>
                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Last 7 Days Calorie Summary (kcal)</h3>
                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#4B5563' : '#E5E7EB'} />
                            <XAxis 
                                dataKey="date" 
                                stroke={themeClasses.listText}
                                tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { weekday: 'short' })}
                            />
                            <YAxis 
                                stroke={themeClasses.listText}
                                label={{ value: 'Calories (kcal)', angle: -90, position: 'insideLeft', fill: themeClasses.listText }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: isDarkMode ? '#1f2937' : 'white', 
                                    borderColor: isDarkMode ? '#4b5563' : '#d1d5db',
                                    color: themeClasses.text
                                }}
                                formatter={(value, name) => [`${parseFloat(value).toFixed(0)} kcal`, name]}
                            />
                            <Legend wrapperStyle={{ color: themeClasses.listText }} />
                            <Bar dataKey="Calories" fill={barColor} name="Consumed" />
                            {dailyGoal !== 'N/A' && (
                                <Line 
                                    dataKey="Goal" 
                                    stroke={goalLineColor} 
                                    strokeWidth={2} 
                                    type="monotone"
                                    dot={false}
                                    name="Goal"
                                />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const ManualMealLogger = ({ handleLookup, themeClasses }) => {
        const [mealName, setMealName] = useState('');
        const [logError, setLogError] = useState('');

        const handleSubmit = (e) => {
            e.preventDefault(); setLogError('');
            if (!mealName.trim()) { setLogError('Please enter a meal name.'); return; }
            // The App component provides handleManualLookup which calls logMealToDailyGoal
            handleLookup(mealName.trim()); setMealName('');
        };

        return (
            <div className={`p-6 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-all duration-500`}>
                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Log Meal by Name (Lookup)</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text" value={mealName} onChange={(e) => setMealName(e.target.value)}
                        placeholder="Enter Food Item (e.g., Apple, Chicken Breast, Hot Tea)"
                        className={`w-full p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500 transition-colors duration-500`}
                    />
                    <button
                        type="submit"
                        className={`w-full px-4 py-2 rounded-full text-white font-bold bg-green-600 hover:bg-green-700 transition-transform duration-200 shadow-md`}
                    > Lookup & Log Meal
                    </button>
                    {logError && <p className="text-sm text-red-400 text-center">{logError}</p>}
                </form>
            </div>
        );
    };

    const LoginSignUpPage = ({ themeClasses, handleNavClick, setUserProfile, setAge, setWeight, setHeight, setHistoricalLog, setWeightLog, setDietPreference, setMealTypePreference }) => {
        const [isLogin, setIsLogin] = useState(true);
        const [formData, setFormData] = useState({
            name: '', email: '', password: '', 
            age: 30, weight: 70, height: 175, 
            diseases: '', goal: 'Weight Loss',
            mealType: 'Non-Vegetarian', 
            restrictions: [], 
        });

        const handleInputChange = (e) => {
            const { name, value } = e.target;
            setFormData(prev => ({ ...prev, [name]: value }));
        };
        
        const handleRestrictionChange = (e) => {
            const { value, checked } = e.target;
            setFormData(prev => {
                const newRestrictions = checked
                    ? [...prev.restrictions, value]
                    : prev.restrictions.filter(r => r !== value);
                return { ...prev, restrictions: newRestrictions };
            });
        };

        const handleSimulatedAuth = (e) => {
            e.preventDefault();
            
            // Generate user ID based on email for local storage isolation
            const currentUserId = formData.email.replace(/[^a-zA-Z0-9]/g, '');
            
            if (!isLogin) {
                // --- SIGN UP LOGIC: UPDATE MAIN APP HEALTH STATES ---
                const initialWeight = parseFloat(formData.weight) || 70;
                const todayKey = getTodayDateKey();
                
                setAge(parseInt(formData.age) || 30);
                setWeight(initialWeight);
                setHeight(parseInt(formData.height) || 175);
                setDietPreference(formData.restrictions); // Update App State
                setMealTypePreference(formData.mealType); // Update App State
                
                // Update user profile details
                setUserProfile(prev => ({
                    ...prev,
                    name: formData.name,
                    email: formData.email,
                    dietPlan: `Primary goal: ${formData.goal}. Conditions: ${formData.diseases || 'None'}.`,
                    userId: currentUserId 
                }));

                setHistoricalLog([]);
                setWeightLog([{ date: todayKey, weight: initialWeight }]);
            } else {
                 // --- LOGIN LOGIC: SIMULATED AUTH ---
                 setUserProfile(prev => ({ ...prev, email: formData.email, userId: currentUserId }));
                 // In a real app, logic to fetch profile data would go here
            }
            
            handleNavClick('Home');
        };
        
        // Checkbox data
        const restrictionOptions = [
            { label: 'Sugar Cut', value: 'sugar' },
            { label: 'Oil Cut / Low Fat', value: 'fried' }, 
            { label: 'Fish Cut', value: 'fish' },
            { label: 'Pork Cut', value: 'pork' },
            { label: 'Beef Cut', value: 'beef' },
        ];


        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <h2 className={`text-5xl font-extrabold mb-4 ${themeClasses.subheading}`}>{isLogin ? "Welcome Back!" : "Create Your Profile"}</h2>
                <p className={`text-lg mb-8 ${themeClasses.listText}`}>{isLogin ? "Sign in to access your tracking data." : "Enter your initial metrics and dietary goals."}</p>
                
                <form onSubmit={handleSimulatedAuth} className="w-full max-w-lg space-y-4 p-6 rounded-xl shadow-2xl" style={{ backgroundColor: themeClasses.card }}>

                    {/* Name input is only visible during Sign Up */}
                    {!isLogin && (
                        <input 
                            type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} 
                            required={!isLogin} className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                        />
                    )}
                    
                    <input 
                        type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange}
                        required className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                    />
                    <input 
                        type="password" name="password" placeholder="Password" value={formData.password} onChange={handleInputChange}
                        required className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                    />

                    {/* --- SIGN UP FIELDS (Only visible when isLogin is false) --- */}
                    {!isLogin && (
                        <>
                            {/* --- BASIC HEALTH METRICS --- */}
                            <div className='grid grid-cols-3 gap-2'>
                                <input type="number" name="age" placeholder="Age" value={formData.age} onChange={handleInputChange} required={!isLogin} min="1" className={`p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text}`}/>
                                <input type="number" name="height" placeholder="Height (cm)" value={formData.height} onChange={handleInputChange} required={!isLogin} min="50" className={`p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text}`}/>
                                <input type="number" name="weight" placeholder="Weight (kg)" value={formData.weight} onChange={handleInputChange} required={!isLogin} step="0.1" min="1" className={`p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text}`}/>
                            </div>

                            {/* Goal and Meal Type Selects */}
                            <select 
                                name="goal" value={formData.goal} onChange={handleInputChange}
                                className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                            >
                                <option value="Weight Loss">Weight Loss</option>
                                <option value="Maintain Weight">Maintain Weight</option>
                                <option value="Muscle Gain">Muscle Gain</option>
                            </select>
                            <select 
                                name="mealType" value={formData.mealType} onChange={handleInputChange}
                                className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                            >
                                <option value="Non-Vegetarian">Non-Vegetarian</option>
                                <option value="Vegetarian">Vegetarian</option>
                                <option value="Eggetarian">Eggetarian</option>
                                <option value="Vegan">Vegan (Strict)</option>
                            </select>
                            
                            {/* Restrictions Checkboxes */}
                            <div className={`p-4 rounded-lg border ${themeClasses.infoBox} ${themeClasses.listText} text-left`}>
                                <label className={`block font-bold mb-2 ${themeClasses.subheading}`}>Select Exclusions/Cuts:</label>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    {restrictionOptions.map((option) => (
                                        <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                value={option.value}
                                                checked={formData.restrictions.includes(option.value)}
                                                onChange={handleRestrictionChange}
                                                className="form-checkbox h-4 w-4 text-purple-600 focus:ring-purple-500"
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <input 
                                type="text" name="diseases" placeholder="Other Conditions (e.g., Diabetes, High Cholesterol)" value={formData.diseases} onChange={handleInputChange}
                                className={`w-full p-3 rounded-lg border-2 ${themeClasses.infoBox} ${themeClasses.text} transition-colors`}
                            />
                        </>
                    )}
                    
                    <button 
                        type="submit"
                        className={`w-full px-4 py-3 rounded-full text-white font-bold transition-transform transform hover:scale-105 ${themeClasses.buttonPrimary} shadow-lg`}
                    >
                        {isLogin ? "Sign In" : "Create Account"}
                    </button>
                </form>
                
                <button
                    onClick={() => setIsLogin(prev => !prev)}
                    className={`mt-4 text-sm font-semibold ${themeClasses.subheading} hover:underline`}
                >
                    {isLogin ? "Don't have an account? Create one." : "Already have an account? Sign In."}
                </button>
            </div>
        );
    };

    const CustomRecipeDetailModal = ({ recipe, themeClasses, onClose }) => {
        if (!recipe) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
                <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${themeClasses.infoBox} transform transition-all duration-300`}>
                    <div className="p-6">
                        <div className="flex justify-between items-start mb-4 border-b pb-4 border-gray-600">
                            <h3 className={`text-3xl font-extrabold ${themeClasses.subheading}`}>{recipe.title} (Custom)</h3>
                            <button onClick={onClose} className={`text-3xl ${themeClasses.listText} hover:text-red-400`}>&times;</button>
                        </div>

                        <div className="md:grid md:grid-cols-2 md:gap-6 space-y-6 md:space-y-0">
                            {/* Image Column */}
                            <div className="flex flex-col items-center">
                                <img 
                                    src={recipe.image} 
                                    alt={recipe.title} 
                                    className="w-full h-48 object-cover rounded-lg shadow-md border-2 border-purple-500"
                                    onError={(e) => e.target.src = `https://placehold.co/400x300/667eea/ffffff?text=CUSTOM+IMAGE`}
                                />
                                <div className={`mt-4 p-3 rounded-xl shadow-inner w-full ${themeClasses.card}`}>
                                    <p className={`text-lg font-bold text-center ${themeClasses.text}`}>{recipe.calories.toFixed(0)} kcal Total</p>
                                    <p className={`text-sm text-center ${themeClasses.listText}`}>Per **{recipe.servings}** serving(s)</p>
                                </div>
                            </div>

                            {/* Details Column */}
                            <div className="space-y-4">
                                {/* Macros */}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className={`p-2 rounded-xl ${themeClasses.nutrients}`}>
                                        <span className="block font-bold text-lg">{recipe.protein.toFixed(1)}g</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Protein</span>
                                    </div>
                                    <div className={`p-2 rounded-xl ${themeClasses.nutrients}`}>
                                        <span className="block font-bold text-lg">{recipe.carbohydrates.toFixed(1)}g</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Carbs</span>
                                    </div>
                                    <div className={`p-2 rounded-xl ${themeClasses.nutrients}`}>
                                        <span className="block font-bold text-lg">{recipe.fat.toFixed(1)}g</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Fat</span>
                                    </div>
                                </div>

                                {/* Ingredients */}
                                <div className={`p-3 rounded-xl shadow-lg ${themeClasses.infoBox}`}>
                                    <h4 className={`text-xl font-bold mb-2 ${themeClasses.subheading}`}>Ingredients:</h4>
                                    <ul className="list-disc list-inside space-y-1 max-h-32 overflow-y-auto pl-4">
                                        {/* Use recipe.ingredients directly (it's an array) */}
                                        {recipe.ingredients.map((ing, i) => (
                                            <li key={i} className={`text-sm ${themeClasses.listText}`}>{ing}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Instructions */}
                                <div className={`p-3 rounded-xl shadow-lg ${themeClasses.infoBox}`}>
                                    <h4 className={`text-xl font-bold mb-2 ${themeClasses.subheading}`}>Instructions:</h4>
                                    <p className={`text-sm ${themeClasses.listText} max-h-32 overflow-y-auto whitespace-pre-wrap`}>
                                        {/* Use recipe.instructions directly (it's a string) */}
                                        {recipe.instructions || 'No instructions provided.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button onClick={onClose} className={`mt-6 w-full px-4 py-2 rounded-full text-white font-bold bg-indigo-600 hover:bg-indigo-700 transition-transform`}>
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const AddRecipePage = ({ themeClasses, userId }) => { 
        // State for the form inputs
        const [recipeTitle, setRecipeTitle] = useState('');
        const [servings, setServings] = useState('');
        const [calories, setCalories] = useState('');
        const [protein, setProtein] = useState('');
        const [carbohydrates, setCarbohydrates] = useState('');
        const [fat, setFat] = useState('');

        const [ingredients, setIngredients] = useState('');
        const [instructions, setInstructions] = useState('');
        const [imageFile, setImageFile] = useState(null);
        const [statusMessage, setStatusMessage] = useState('');
        const [isSaving, setIsSaving] = useState(false);
        
        // State for the list of saved custom recipes (tied to userId)
        const [savedRecipes, setSavedRecipes] = useState([]);

        // --- EFFECT TO LOAD/SAVE BASED ON USER ID ---
        const STORAGE_KEY = `customRecipes_${userId}`;

        useEffect(() => {
            // Load recipes when component mounts OR when userId changes
            if (!userId) {
                 setSavedRecipes([]); // Clear list if not logged in
                 return;
            } 
            const saved = localStorage.getItem(STORAGE_KEY);
            try {
                setSavedRecipes(saved ? JSON.parse(saved) : []);
            } catch (e) {
                setSavedRecipes([]);
            }
        }, [userId]); 

        useEffect(() => {
            // Save recipes whenever the list changes, only if userId is valid
            if (userId) {
                 localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRecipes));
            }
        }, [savedRecipes, userId]);
        // --- END EFFECT ---
        
        // State for the modal
        const [selectedRecipeForModal, setSelectedRecipeForModal] = useState(null);

        const handleRecipeSubmit = (e) => {
            e.preventDefault();
            setStatusMessage('');

            if (isSaving) return;
            if (!userId) {
                 setStatusMessage('Please sign in or create an account to save custom recipes.');
                 return;
            }

            // Check that all 6 numerical inputs and 3 text inputs are filled
            if (!recipeTitle || !servings || !calories || !ingredients || !instructions || protein === '' || carbohydrates === '' || fat === '') {
                setStatusMessage('Please fill in ALL required fields, including macros (Calories, Protein, Carbs, Fat).');
                return;
            }

            if (!imageFile) {
                setStatusMessage('Please upload a recipe image.');
                return;
            }
            
            setIsSaving(true);
            setStatusMessage('Processing image and saving recipe...');

            const reader = new FileReader();

            reader.onload = async () => {
                const base64Image = reader.result;
                const newRecipe = {
                    id: `local-${Date.now()}`,
                    title: recipeTitle,
                    servings: parseFloat(servings),
                    calories: parseFloat(calories),
                    protein: parseFloat(protein),
                    carbohydrates: parseFloat(carbohydrates),
                    fat: parseFloat(fat),
                    ingredients: ingredients.split('\n').filter(line => line.trim() !== ''),
                    instructions: instructions,
                    image: base64Image,
                    userId: userId
                };

                setSavedRecipes(prev => [newRecipe, ...prev]);
                
                setStatusMessage(`✅ Recipe "${recipeTitle}" saved! Click the entry below to see full details.`);

                // Reset form fields
                setRecipeTitle(''); setServings(''); setCalories('');
                setProtein(''); setCarbohydrates(''); setFat('');
                setIngredients(''); setInstructions(''); 
                setImageFile(null); 
                document.getElementById('recipe-image-upload').value = ''; 
                setIsSaving(false);
            };

            reader.onerror = (error) => {
                console.error("FileReader Error:", error);
                setStatusMessage('Error processing image. Please try another file.');
                setIsSaving(false);
            };

            reader.readAsDataURL(imageFile);
        };
        
        const openRecipeDetail = (recipe) => {
            setSelectedRecipeForModal(recipe);
        };

        return (
            <div className="w-full max-w-4xl mx-auto space-y-8 p-6">
                <h2 className={`text-4xl font-extrabold text-center ${themeClasses.subheading}`}>Create a New Recipe 📝</h2>
                <form onSubmit={handleRecipeSubmit} className={`p-8 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-colors duration-500 space-y-6`}>
                    <p className={`${themeClasses.listText} text-lg text-center`}>
                        Fill in the details below to add your custom recipe to the local list. This list is unique to your current profile.
                    </p>

                    {/* Status Message */}
                    {statusMessage && (
                        <div className={`p-3 rounded-lg text-center font-medium ${statusMessage.includes('✅') ? 'bg-green-600/20 text-green-400' : statusMessage.includes('❌') ? 'bg-red-600/20 text-red-400' : 'bg-blue-600/20 text-blue-400'}`}>
                            {statusMessage}
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Recipe Title and Servings */}
                        <input 
                            type="text" 
                            placeholder="Recipe Title" 
                            value={recipeTitle}
                            onChange={(e) => setRecipeTitle(e.target.value)}
                            required
                            className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                            disabled={isSaving}
                        />
                        <input 
                            type="number" 
                            placeholder="Total Servings" 
                            value={servings}
                            onChange={(e) => setServings(e.target.value)}
                            required
                            min="1"
                            className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                            disabled={isSaving}
                        />
                        
                        {/* Calories Per Serving */}
                        <input 
                            type="number" 
                            placeholder="Calories Per Serving (kcal)" 
                            value={calories}
                            onChange={(e) => setCalories(e.target.value)}
                            required
                            min="1"
                            step="1"
                            className={`p-3 rounded-lg border-2 md:col-span-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                            disabled={isSaving}
                        />
                        
                        {/* --- MACRO INPUTS (NEW) --- */}
                        <div className="md:col-span-2 grid grid-cols-3 gap-2">
                             <input 
                                type="number" 
                                placeholder="Protein (g)" 
                                value={protein}
                                onChange={(e) => setProtein(e.target.value)}
                                required
                                min="0"
                                step="0.1"
                                className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                                disabled={isSaving}
                            />
                             <input 
                                type="number" 
                                placeholder="Carbs (g)" 
                                value={carbohydrates}
                                onChange={(e) => setCarbohydrates(e.target.value)}
                                required
                                min="0"
                                step="0.1"
                                className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                                disabled={isSaving}
                            />
                             <input 
                                type="number" 
                                placeholder="Fat (g)" 
                                value={fat}
                                onChange={(e) => setFat(e.target.value)}
                                required
                                min="0"
                                step="0.1"
                                className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                                disabled={isSaving}
                            />
                        </div>
                        {/* --- END MACRO INPUTS --- */}

                        {/* Ingredients Text Area */}
                        <textarea 
                            placeholder="Ingredients (one per line)" 
                            rows="6" 
                            value={ingredients}
                            onChange={(e) => setIngredients(e.target.value)}
                            required
                            className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                            disabled={isSaving}
                        />

                        {/* Instructions Text Area */}
                        <textarea 
                            placeholder="Cooking Instructions (step-by-step)" 
                            rows="6" 
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            required
                            className={`p-3 rounded-lg border-2 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500`}
                            disabled={isSaving}
                        />

                        {/* Image Upload */}
                        <div className="md:col-span-2">
                            <label className={`block text-md font-medium mb-2 ${themeClasses.listText}`}>Upload Recipe Photo</label>
                            <input
                                type="file"
                                id="recipe-image-upload"
                                onChange={(e) => setImageFile(e.target.files[0] || null)}
                                accept="image/*"
                                className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${themeClasses.input} transition-colors duration-500`}
                                disabled={isSaving}
                            />
                            {imageFile && <p className={`text-xs mt-1 ${themeClasses.listText}`}>File selected: {imageFile.name}</p>}
                        </div>

                        {/* Submit Button */}
                        <button 
                            type="submit"
                            disabled={!imageFile || isSaving}
                            className={`md:col-span-2 w-full px-6 py-3 rounded-full text-white font-bold bg-green-600 hover:bg-green-700 transition-transform shadow-lg disabled:opacity-50`}
                        >
                            {isSaving ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" /></svg>
                                    Saving...
                                </span>
                            ) : 'Save Custom Recipe'}
                        </button>
                    </div>
                </form>
                
                {/* Displaying Saved Recipes in a Box */}
                <div className={`p-6 rounded-2xl shadow-xl ${themeClasses.infoBox} border-4 border-dashed border-purple-400`}>
                    <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Custom Recipe Preview Box ({savedRecipes.length})</h3>
                    {savedRecipes.length === 0 ? (
                         <p className={`text-center ${themeClasses.listText}`}>Your saved custom recipes will appear here.</p>
                    ) : (
                        <ul className="space-y-4">
                            {savedRecipes.map(recipe => (
                                <li 
                                    key={recipe.id} 
                                    className={`p-4 rounded-xl shadow-md ${themeClasses.card} transition-colors duration-300 cursor-pointer hover:shadow-lg`}
                                    onClick={() => openRecipeDetail(recipe)}
                                >
                                    <div className="flex space-x-4 items-center">
                                        <img 
                                            src={recipe.image}
                                            alt={recipe.title}
                                            className="w-16 h-16 object-cover rounded-lg border border-purple-500"
                                            onError={(e) => e.target.src = `https://placehold.co/64x64/667eea/ffffff?text=IMG`}
                                        />
                                        <div className="flex-grow">
                                            <h4 className={`text-lg font-extrabold ${themeClasses.text}`}>{recipe.title}</h4>
                                            <p className={`text-sm font-semibold ${themeClasses.subheading}`}>
                                                {recipe.calories.toFixed(0)} kcal | P:{recipe.protein.toFixed(0)}g C:{recipe.carbohydrates.toFixed(0)}g F:{recipe.fat.toFixed(0)}g
                                            </p>
                                            <p className={`text-xs ${themeClasses.listText} mt-1 truncate`}>
                                                **Instructions:** {recipe.instructions.substring(0, 100)}...
                                            </p>
                                        </div>
                                        <span className="text-xl text-purple-400">→</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                {/* Recipe Detail Modal */}
                <CustomRecipeDetailModal 
                    recipe={selectedRecipeForModal} 
                    themeClasses={themeClasses} 
                    onClose={() => setSelectedRecipeForModal(null)} 
                />
            </div>
        );
    };

    // ----------------------------------------------------
    // --- END: HELPER COMPONENTS ---
    // ----------------------------------------------------


    // --- State variables (START) ---
    const [image, setImage] = useState(null);
    const [ingredientText, setIngredientText] = useState('');
    const [extractedText, setExtractedText] = useState('');
    const [status, setStatus] = useState('Idle');
    const [recipes, setRecipes] = useState([]);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [activePage, setActivePage] = useState('Login/Sign Up'); 
    const [imageLoading, setImageLoading] = useState({});
    const [todayMeal, setTodayMeal] = useState(null);
    const [currentDateKey, setCurrentDateKey] = useState(getTodayDateKey());

    // LOGGING STATES: Cumulative Meal Tracking
    const [dailyMealLog, setDailyMealLog] = useState([]);
    const [dailyNutritionSummary, setDailyNutritionSummary] = useState({
        'Calories': 0, 'FatContent': 0, 'SaturatedFatContent': 0, 'CholesterolContent': 0, 
        'SodiumContent': 0, 'CarbohydrateContent': 0, 'FiberContent': 0, 'SugarContent': 0, 
        'ProteinContent': 0, 'CalciumContent': 0, 'IronContent': 0, 'VitaminCContent': 0, 'FolateContent': 0,
    });
    
    // --- DIETARY PREFERENCE STATES ---
    const [dietPreference, setDietPreference] = useState([]); 
    const [mealTypePreference, setMealTypePreference] = useState('Non-Vegetarian');

    // --- HISTORICAL LOG STATE (Default Mock Data) ---
    const [historicalLog, setHistoricalLog] = useState([
        { date: '2025-01-01', Calories: 1900 }, { date: '2025-01-02', Calories: 2450 },
        { date: '2025-01-03', Calories: 2100 }, { date: '2025-01-04', Calories: 2200 },
        { date: '2025-01-05', Calories: 2150 }, { date: '2025-01-06', Calories: 2300 },
        { date: '2025-01-07', Calories: 1800 }, 
    ]); 

    // Health Profile states
    const [age, setAge] = useState(30);
    const [height, setHeight] = useState(175);
    const [weight, setWeight] = useState(70);
    const [gender, setGender] = useState('male');
    const [activity, setActivity] = useState(3);
    const [mealsPerDay, setMealsPerDay] = useState(3);
    const [healthMetrics, setHealthMetrics] = useState(null);
    const [bmi, setBmi] = useState(null);

    // --- WEIGHT TRACKER STATE ---
    const [weightLog, setWeightLog] = useState([
        { date: '2025-01-01', weight: 70.5 }, { date: '2025-01-08', weight: 70.0 },
        { date: '2025-01-15', weight: 69.8 }, { date: '2025-01-22', weight: 69.5 },
        { date: getTodayDateKey(), weight: 69.0 },
    ].sort((a, b) => new Date(b.date) - new Date(a.date)));
    const [newWeight, setNewWeight] = useState('');

    // Existing user profile state
    const [userProfile, setUserProfile] = useState({
        name: 'Paula',
        email: 'paula@zylker.com',
        userId: 'paula@zylker.com', 
        dietPlan: 'Your custom diet plan will appear here after a recommendation is generated.',
        weeklyGoal: 'N/A'
    });

    const chartColors = [
        '#667eea', '#4FD1C5', '#F6AD55', '#E53E3E',
        '#63B3ED', '#81E6D9', '#D53F8C', '#ECC94B', '#9F7AEA'
    ];
    // --- State variables (END) ---

    // ... (rest of App component functions) ...

    const getActivityLabel = (level) => {
      switch (level) {
        case 1: return 'Little/no exercise (Sedentary)';
        case 2: return 'Lightly active (1-3 days/week)';
        case 3: return 'Moderately active (3-5 days/week)';
        case 4: return 'Very active (6-7 days/week)';
        case 5: return 'Extra active (Very active & physical job)';
        default: return 'Unknown';
      }
    };

    const getBMICategory = (bmiValue) => {
        if (bmiValue < 18.5) return 'Underweight';
        if (bmiValue >= 18.5 && bmiValue < 25) return 'Normal';
        if (bmiValue >= 25 && bmiValue < 30) return 'Overweight';
        return 'Obesity';
    };
    
    // --- LOGOUT HANDLER ---
    const handleLogout = () => {
        setDailyNutritionSummary({
            'Calories': 0, 'FatContent': 0, 'SaturatedFatContent': 0, 'CholesterolContent': 0, 
            'SodiumContent': 0, 'CarbohydrateContent': 0, 'FiberContent': 0, 'SugarContent': 0, 
            'ProteinContent': 0, 'CalciumContent': 0, 'IronContent': 0, 'VitaminCContent': 0, 'FolateContent': 0,
        });
        setDailyMealLog([]);
        setHealthMetrics(null);
        setBmi(null);
        setActivePage('Login/Sign Up'); 
        handleNavClick('Login/Sign Up');
    };
    // --- END LOGOUT HANDLER ---

    // --- EFFECT FOR DAILY LOGGING/RESET AND ROUTING ---
    useEffect(() => {
        const todayKey = getTodayDateKey();
        
        if (currentDateKey !== todayKey) {
            
            if (dailyNutritionSummary.Calories > 0) {
                setHistoricalLog(prevLog => {
                    const existingIndex = prevLog.findIndex(d => d.date === currentDateKey);
                    const logEntry = { date: currentDateKey, ...dailyNutritionSummary };
                    if (existingIndex === -1) { return [...prevLog, logEntry]; }
                    return prevLog;
                });
            }
            
            setDailyNutritionSummary({
                'Calories': 0, 'FatContent': 0, 'SaturatedFatContent': 0, 'CholesterolContent': 0, 
                'SodiumContent': 0, 'CarbohydrateContent': 0, 'FiberContent': 0, 'SugarContent': 0, 
                'ProteinContent': 0, 'CalciumContent': 0, 'IronContent': 0, 'VitaminCContent': 0, 'FolateContent': 0,
            });
            setDailyMealLog([]);
            setCurrentDateKey(todayKey);
        }
        
        if (weightLog.length > 0 && weight !== weightLog[0].weight) {
            setWeight(weightLog[0].weight);
        }
        
        const hash = window.location.hash.replace('#', '').toLowerCase() || 'login-sign-up';
        
        const pageMap = {
            'home': 'Home', 'daily-goal': 'Daily Goal', 'profile': 'Profile',
            'weekend-summary': 'Weekend Summary', 'login-sign-up': 'Login/Sign Up',
            'add-recipe': 'Add Recipe'
        };
        setActivePage(pageMap[hash] || 'Login/Sign Up');
        
    }, [currentDateKey, dailyNutritionSummary, weightLog]);


    const handleNavClick = (page) => {
        const formattedPage = page.toLowerCase().replace(' ', '-').replace('/', '');
        window.location.hash = formattedPage;
        setActivePage(page);
    };

    const handleImageChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setImage(event.target.files[0]);
            setIngredientText(''); setExtractedText(''); setRecipes([]);
            setSelectedRecipe(null); setErrorMessage('');
            setStatus(`Image selected: ${event.target.files[0].name}`);
            setImageLoading({});
        }
    };

    const handleTextChange = (event) => {
        setIngredientText(event.target.value);
        if (event.target.value.trim() !== '' && image) {
            setImage(null);
        } else if (event.target.value.trim() === '') {
            setStatus('Idle');
        }
        setExtractedText(event.target.value); setRecipes([]);
        setSelectedRecipe(null); setErrorMessage('');
    };
    
    // --- API FUNCTIONS (FLASK INTEGRATED) ---
    const processImage = async () => {
        setErrorMessage('');
        setRecipes([]);
        setSelectedRecipe(null);
        setStatus('Processing...');
        setImageLoading({});

        let currentIngredients = ingredientText;

        try {
            // 1. OCR Step (if image is present)
            if (image) {
                setStatus('Uploading image and running OCR...');
                const formData = new FormData();
                formData.append('image', image);

                const ocrResponse = await fetch(`${API_URL}/ocr`, {
                    method: 'POST',
                    body: formData,
                });
                const ocrResult = await ocrResponse.json();

                if (ocrResult.error) {
                    throw new Error(ocrResult.error);
                }

                currentIngredients = ocrResult.text;
                setExtractedText(currentIngredients);
                setIngredientText(currentIngredients);
            } else if (currentIngredients.trim() === '') {
                    setErrorMessage('Please select an image OR enter ingredients manually.');
                    setStatus('Idle');
                    return;
            } else {
                 setExtractedText(currentIngredients); // Use manual text directly
            }

            // 2. Prepare Restrictions (NEW)
            let spoonacularDiet = '';
            if (mealTypePreference === 'Vegetarian') {
                spoonacularDiet = 'vegetarian';
            } else if (mealTypePreference === 'Vegan') {
                spoonacularDiet = 'vegan';
            }
            
            // Combine all simple exclusions (e.g., 'sugar', 'fried', 'fish')
            let excludedItems = dietPreference.join(',');
            
            // Further refine exclusions based on meal type for Spoonacular compatibility
            if (mealTypePreference === 'Vegetarian' || mealTypePreference === 'Vegan') {
                const meatExclusions = 'pork, beef, chicken, lamb, turkey, fish, shellfish';
                excludedItems = excludedItems ? excludedItems + ', ' + meatExclusions : meatExclusions;
            } else if (mealTypePreference === 'Eggetarian') {
                 const meatExclusions = 'pork, beef, chicken, lamb, turkey, fish, shellfish';
                 excludedItems = excludedItems ? excludedItems + ', ' + meatExclusions : meatExclusions;
            }

            // Remove any duplicate or excessive commas
            excludedItems = excludedItems.split(',').map(s => s.trim()).filter(s => s).join(',');
            
            const restrictionsPayload = {
                excludeIngredients: excludedItems,
                diet: spoonacularDiet
            };


            // 3. Recipe Search Step (using extracted/manual text and restrictions)
            setStatus('Searching for filtered recipes...');
            
            const recipesResponse = await fetch(`${API_URL}/get_recipes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // NOTE: We pass the restrictions here. Your Flask backend needs to process them.
                body: JSON.stringify({ 
                    ingredients: currentIngredients, 
                    restrictions: restrictionsPayload 
                }),
            });
            const recipesResult = await recipesResponse.json();

            if (recipesResult.error) {
                setErrorMessage(recipesResult.error);
                setStatus('An API error occurred.');
                return;
            }
            
            setRecipes(recipesResult.recipes || []);
            
            if (recipesResult.warning) {
                setStatus(`Warning: ${recipesResult.warning}`);
                setErrorMessage(`Warning: ${recipesResult.warning}`);
            } else {
                setStatus('Complete! Recipes found.');
            }

        } catch (error) {
            console.error('API Error:', error);
            setErrorMessage(`Connection Error: ${error.message}. Ensure Flask server is running at ${API_URL}`);
            setStatus('An internal error occurred.');
            setRecipes([]);
        }
    };
    
    const fetchRecipeDetails = async (id) => {
        setStatus(`Fetching details for recipe ID ${id}...`);
        setErrorMessage('');
        setSelectedRecipe(null); 
        
        try {
            const response = await fetch(`${API_URL}/get_recipe_details/${id}`);
            const result = await response.json();

            if (result.error) {
                setErrorMessage(result.error);
                setStatus('Failed to load details.');
                return;
            }

            setSelectedRecipe({
                ...result,
                nutrients: {
                    calories: result.nutrients?.calories || 0, protein: result.nutrients?.protein || 0, 
                    carbohydrates: result.nutrients?.carbohydrates || 0, fat: result.nutrients?.fat || 0,
                    calcium: result.nutrients?.calcium || 0, iron: result.nutrients?.iron || 0,
                    folate: result.nutrients?.folate || 0, vitamin_c: result.nutrients?.vitamin_c || 0,
                    saturatedFat: result.nutrients?.saturatedFat || 0, cholesterol: result.nutrients?.cholesterol || 0,
                    sodium: result.nutrients?.sodium || 0, fiber: result.nutrients?.fiber || 0,
                    sugar: result.nutrients?.sugar || 0,
                }
            });
            setStatus(`Viewing: ${result.title}`);
            setImageLoading(prev => ({ ...prev, [id]: false }));
            
        } catch (error) {
            console.error('API Error:', error);
            setErrorMessage(`Connection Error: ${error.message}`);
            setStatus('Failed to load details.');
            setImageLoading(prev => ({ ...prev, [id]: false }));
        }
    };
    
    const handleManualLookup = async (mealName) => {
        setErrorMessage('');
        setStatus(`Looking up nutrition for: ${mealName}...`);
        
        try {
            const response = await fetch(`${API_URL}/lookup_nutrition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ food_name: mealName }),
            });
            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            const mealData = {
                title: result.food_name || mealName, 
                nutrients: {
                    calories: result.calories || 0, protein: result.protein || 0, carbohydrates: result.carbohydrates || 0, fat: result.fat || 0,
                    saturatedFat: result.saturatedFat || 0, cholesterol: result.cholesterol || 0, sodium: result.sodium || 0, fiber: result.fiber || 0,
                    sugar: result.sugar || 0, calcium: result.calcium || 0, iron: result.iron || 0, vitamin_c: result.vitamin_c || 0, folate: result.folate || 0,
                }
            };

            logMealToDailyGoal(mealData);
            setStatus(`Successfully logged nutrition for: ${mealName}!`);

        } catch (error) {
            console.error('Manual Lookup Error:', error);
            setErrorMessage(`Could not find nutrition for "${mealName}". Check the name or ensure API key is valid/has quota.`);
            setStatus('Lookup failed.');
        }
    };
    // --- END API FUNCTIONS ---


    const goBackToList = () => {
        setSelectedRecipe(null); setStatus('Ready for selection.'); setImageLoading({});
    };

    const chooseMealForToday = () => {
        if (!selectedRecipe) return;
        setTodayMeal(selectedRecipe); setSelectedRecipe(null);
        setStatus(`Meal chosen: ${selectedRecipe.title}. Log it to your Daily Goal!`);
    };

    // Central logging function (UNMODIFIED)
    const logMealToDailyGoal = (mealData) => {
        const isRecipe = mealData.nutrients && mealData.nutrients.calories !== undefined;
        const getNutrientValue = (value) => parseFloat(value) || 0;

        const mealNutrients = {
            'Calories': getNutrientValue(mealData.nutrients?.calories || mealData.calories),
            'FatContent': getNutrientValue(mealData.nutrients?.fat), 'CarbohydrateContent': getNutrientValue(mealData.nutrients?.carbohydrates),
            'ProteinContent': getNutrientValue(mealData.nutrients?.protein), 'SaturatedFatContent': getNutrientValue(mealData.nutrients?.saturatedFat), 
            'CholesterolContent': getNutrientValue(mealData.nutrients?.cholesterol), 'SodiumContent': getNutrientValue(mealData.nutrients?.sodium), 
            'FiberContent': getNutrientValue(mealData.nutrients?.fiber), 'SugarContent': getNutrientValue(mealData.nutrients?.sugar),
            'ProteinContent': getNutrientValue(mealData.nutrients?.protein), 'CalciumContent': getNutrientValue(mealData.nutrients?.calcium),
            'IronContent': getNutrientValue(mealData.nutrients?.iron), 'VitaminCContent': getNutrientValue(mealData.nutrients?.vitamin_c),
            'FolateContent': getNutrientValue(mealData.nutrients?.folate),
        };

        setDailyMealLog(prevLog => [...prevLog, {
            name: mealData.title || mealData.name, calories: mealNutrients.Calories.toFixed(2),
            type: isRecipe ? 'Recipe' : 'Manual', timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            dateKey: currentDateKey
        }]);

        setDailyNutritionSummary(prevSummary => ({
            'Calories': prevSummary.Calories + mealNutrients.Calories, 'FatContent': prevSummary.FatContent + mealNutrients.FatContent,
            'SaturatedFatContent': prevSummary.SaturatedFatContent + mealNutrients.SaturatedFatContent, 'CholesterolContent': prevSummary.CholesterolContent + mealNutrients.CholesterolContent,
            'SodiumContent': prevSummary.SodiumContent + mealNutrients.SodiumContent, 'CarbohydrateContent': prevSummary.CarbohydrateContent + mealNutrients.CarbohydrateContent,
            'FiberContent': prevSummary.FiberContent + mealNutrients.FiberContent, 'SugarContent': prevSummary.SugarContent + mealNutrients.SugarContent,
            'ProteinContent': prevSummary.ProteinContent + mealNutrients.ProteinContent, 'CalciumContent': prevSummary.CalciumContent + mealNutrients.CalciumContent,
            'IronContent': prevSummary.IronContent + mealNutrients.IronContent, 'VitaminCContent': prevSummary.VitaminCContent + mealNutrients.VitaminCContent,
            'FolateContent': prevSummary.FolateContent + mealNutrients.FolateContent,
        }));

        setTodayMeal(null); handleNavClick('Daily Goal');
    };

    const handleLogSuggestedMeal = () => {
        if (todayMeal) { logMealToDailyGoal(todayMeal); }
    };

    const toggleDarkMode = () => {
        setIsDarkMode((prevMode) => !prevMode);
    };

    const themeClasses = isDarkMode
        ? {
            bg: 'bg-gray-900', text: 'text-white', container: 'bg-gray-800 border-gray-700 shadow-2xl', card: 'bg-gray-700',
            cardHover: 'hover:bg-gray-600', button: 'bg-gray-700 text-gray-200 hover:bg-gray-600',
            buttonPrimary: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700', subheading: 'text-purple-300',
            infoBox: 'bg-gray-700 border-gray-700', input: 'file:text-blue-700 file:bg-blue-50 hover:file:bg-blue-100',
            nutrients: 'bg-gray-600 text-gray-100', nutrientsSubtext: 'text-gray-400', listText: 'text-gray-300',
            navText: 'text-gray-300 hover:text-white', navActive: 'border-b-4 border-purple-400 font-extrabold', bgFilter: 'bg-black/80 backdrop-blur-sm',
          }
        : {
            bg: 'bg-gray-100', text: 'text-gray-900', container: 'bg-white border-gray-300 shadow-xl', card: 'bg-gray-200',
            cardHover: 'hover:bg-gray-300', button: 'bg-gray-300 text-gray-800 hover:bg-gray-400',
            buttonPrimary: 'bg-gradient-to-r from-indigo-500 to-teal-600 hover:from-indigo-600 hover:to-teal-700', subheading: 'text-indigo-600',
            infoBox: 'bg-gray-200 border-gray-300', input: 'file:text-indigo-700 file:bg-indigo-50 hover:file:bg-indigo-100',
            nutrients: 'bg-gray-300 text-gray-800', nutrientsSubtext: 'text-gray-600', listText: 'text-gray-700',
            navText: 'text-gray-600 hover:text-gray-900', navActive: 'border-b-4 border-indigo-600 font-extrabold', bgFilter: 'bg-white/90 backdrop-blur-sm',
          };

    // Health metrics calculation (UNMODIFIED)
    const calculateHealthMetrics = () => {
        if (isNaN(age) || isNaN(height) || isNaN(weight) || height <= 0 || weight <= 0) {
            setHealthMetrics({ error: 'Please enter valid numbers for age, height, and weight.' }); setBmi(null); return;
        }

        let bmr;
        if (gender === 'male') { bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5; } 
        else { bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161; }
        
        const heightInMeters = height / 100;
        const calculatedBmi = weight / (heightInMeters * heightInMeters); setBmi(calculatedBmi.toFixed(1));

        const activityMultipliers = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725, 5: 1.9 };
        const activityMultiplier = activityMultipliers[activity] || 1.2;
        const maintainWeight = bmr * activityMultiplier;

        setHealthMetrics({
            maintainWeight: maintainWeight.toFixed(0), mildWeightLoss: (maintainWeight - 250).toFixed(0),
            weightLoss: (maintainWeight - 500).toFixed(0), extremeWeightLoss: (maintainWeight - 1000).toFixed(0),
        });

        setUserProfile(prevProfile => ({
            ...prevProfile,
            weeklyGoal: `Your Basal Metabolic Rate (BMR) is ${bmr.toFixed(0)} kcal/day, and your Total Daily Energy Expenditure (TDEE) is ${maintainWeight.toFixed(0)} kcal/day. Use the calorie goals below as a starting guideline for your plan.`
        }));
    };

    // --- START: Home Page Render Logic (Defined Here to ensure scope) ---
    const renderHomePageContent = () => {
        if (selectedRecipe) {
            // Detailed Recipe View (with "Choose this Meal" button)
            return (
                <div className="animate-fade-in-up p-4">
                    <div className="flex justify-between items-center mb-6">
                        <button
                            onClick={goBackToList}
                            className={`px-4 py-2 text-sm font-semibold rounded-full shadow-md transition-colors duration-200 ${themeClasses.button} flex items-center`}
                            aria-label="Back to recipe list"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            Back to Recipes
                        </button>
                        <button
                            onClick={chooseMealForToday}
                            className={`px-6 py-2 rounded-full text-white font-bold transition-transform transform hover:scale-105 active:scale-95 duration-200 bg-teal-500 hover:bg-teal-600 shadow-lg text-lg flex items-center`}
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a12.01 12.01 0 00-3.997 2.128 12.01 12.01 0 00-2.887 5.922 12.01 12.01 0 00-1.4 6.879m16.175-1.92A12.007 12.007 0 0012 21.056c-2.31 0-4.516-.653-6.425-1.803M12 2h0" /></svg>
                            Choose this Meal
                        </button>
                    </div>

                    <h2 className={`text-4xl font-extrabold text-center mb-6 ${themeClasses.subheading} transition-colors duration-500`}>
                        {selectedRecipe.title}
                    </h2>
                    {/* ... Rest of the detailed recipe view content ... */}
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="flex flex-col items-center">
                            <div className="relative w-full max-w-lg">
                                {imageLoading[selectedRecipe.id] && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-xl">
                                        <svg className="animate-spin h-10 w-10 text-purple-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" /></svg>
                                    </div>
                                )}
                                <img
                                    src={selectedRecipe.image}
                                    alt={selectedRecipe.title}
                                    className={`w-full h-80 object-cover rounded-2xl shadow-xl transition-opacity duration-500 ${imageLoading[selectedRecipe.id] ? 'opacity-50' : 'opacity-100'}`}
                                    onLoad={() => setImageLoading(prev => ({ ...prev, [selectedRecipe.id]: false }))}
                                    onError={(e) => {
                                        e.target.src = `https://placehold.co/400x300/4c4c4c/ffffff?text=Image+Not+Found`;
                                        setImageLoading(prev => ({ ...prev, [selectedRecipe.id]: false }));
                                    }}
                                />
                            </div>
                            <div className={`p-4 rounded-xl shadow-lg mt-6 w-full max-w-lg ${themeClasses.infoBox}`}>
                                <h3 className={`text-xl font-bold mb-4 ${themeClasses.subheading}`}>Nutrition (per serving):</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                                    {/* Displaying actual macro nutrients */}
                                    <div className={`p-3 rounded-xl shadow-inner ${themeClasses.nutrients}`}>
                                        <span className="block text-xl font-bold">{selectedRecipe.nutrients.calories}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Calories</span>
                                    </div>
                                    <div className={`p-3 rounded-xl shadow-inner ${themeClasses.nutrients}`}>
                                        <span className="block text-xl font-bold">{selectedRecipe.nutrients.protein}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Protein (g)</span>
                                    </div>
                                    <div className={`p-3 rounded-xl shadow-inner ${themeClasses.nutrients}`}>
                                        <span className="block text-xl font-bold">{selectedRecipe.nutrients.carbohydrates}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Carbs (g)</span>
                                    </div>
                                    <div className={`p-3 rounded-xl shadow-inner ${themeClasses.nutrients}`}>
                                        <span className="block text-xl font-bold">{selectedRecipe.nutrients.fat}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Fat (g)</span>
                                    </div>
                                    
                                </div>
                                {/* New Micro-nutrients Display */}
                                <h4 className={`text-lg font-bold mt-6 mb-2 ${themeClasses.subheading}`}>Micronutrients:</h4>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className={`p-2 rounded-xl shadow-inner text-sm ${themeClasses.nutrients}`}>
                                        <span className="block font-bold">{selectedRecipe.nutrients.calcium}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Calcium (mg)</span>
                                    </div>
                                    <div className={`p-2 rounded-xl shadow-inner text-sm ${themeClasses.nutrients}`}>
                                        <span className="block font-bold">{selectedRecipe.nutrients.iron}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Iron (mg)</span>
                                    </div>
                                    <div className={`p-2 rounded-xl shadow-inner text-sm ${themeClasses.nutrients}`}>
                                        <span className="block font-bold">{selectedRecipe.nutrients.folate}</span>
                                        <span className={`block text-xs ${themeClasses.nutrientsSubtext}`}>Folate (µg)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-6">
                            <div className={`p-6 rounded-2xl shadow-lg ${themeClasses.infoBox}`}>
                                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Ingredients:</h3>
                                <ul className="list-disc list-inside space-y-2">
                                    {selectedRecipe.ingredients.map((ingredient, index) => (
                                        <li key={index} className={`pl-2 ${themeClasses.listText}`}>
                                            {ingredient}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className={`p-6 rounded-2xl shadow-lg ${themeClasses.infoBox}`}>
                                <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Instructions:</h3>
                                <div
                                    className={`leading-relaxed space-y-4 ${themeClasses.listText}`}
                                    dangerouslySetInnerHTML={{ __html: selectedRecipe.instructions || 'Instructions not available.' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Simplified Main Home Page: Combined Input and Today's Meal Display
        return (
            <div className="flex flex-col items-center w-full">
                <h2 className={`text-4xl font-extrabold text-center mb-10 ${themeClasses.subheading}`}>Scan 📸, Plan 📝, Eat 😋</h2>
                
                {/* --- Today's Chosen Meal --- */}
                {todayMeal && (
                    <div className={`w-full max-w-6xl p-6 mb-8 rounded-2xl shadow-2xl ${themeClasses.infoBox} border-4 border-green-500 transition-all duration-500`}>
                        <div className="flex flex-col md:flex-row items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <span className="text-4xl">✅</span>
                                <div>
                                    <h3 className={`text-2xl font-extrabold text-green-400`}>MEAL SELECTED:</h3>
                                    <p className={`text-xl font-semibold ${themeClasses.text}`}>{todayMeal.title}</p>
                                    <p className={`text-sm ${themeClasses.listText}`}>Calories: {todayMeal.nutrients?.calories || 'N/A'} kcal</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogSuggestedMeal}
                                className={`mt-4 md:mt-0 px-6 py-3 rounded-full text-white font-bold transition-transform transform hover:scale-105 active:scale-95 duration-200 bg-green-600 hover:bg-green-700 shadow-lg text-lg flex items-center`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                LOG & View Daily Goal
                            </button>
                        </div>
                    </div>
                )}
                {/* --- End Today's Chosen Meal --- */}


                {/* --- Combined Input Section --- */}
                <div className={`w-full max-w-2xl p-8 rounded-2xl shadow-xl ${themeClasses.infoBox} transition-all duration-500 space-y-6`}>
                    <h3 className={`text-2xl font-bold ${themeClasses.subheading}`}>Find Recipes by Image or Text</h3>
                    
                    {/* File Input */}
                    <div className="w-full">
                        <label className={`block text-md font-medium mb-2 ${themeClasses.listText}`}>1. Scan an ingredient list (Image Upload):</label>
                        <input
                            type="file"
                            onChange={handleImageChange}
                            accept="image/*"
                            capture="environment"
                            className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${themeClasses.input} transition-colors duration-500`}
                        />
                        {image && (
                            <p className={`text-xs mt-2 ${themeClasses.listText} truncate`}>
                                **Image Selected:** {image.name}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex items-center w-full">
                        <div className={`flex-grow border-t ${themeClasses.nutrientsSubtext}`}></div>
                        <span className={`px-4 text-sm font-semibold ${themeClasses.listText}`}>OR</span>
                        <div className={`flex-grow border-t ${themeClasses.nutrientsSubtext}`}></div>
                    </div>

                    {/* Text Input */}
                    <div className="w-full">
                        <label htmlFor="ingredient-text" className={`block text-md font-medium mb-2 ${themeClasses.listText}`}>2. Enter ingredients manually (Text Area):</label>
                        <textarea
                            id="ingredient-text"
                            value={ingredientText}
                            onChange={handleTextChange}
                            placeholder="e.g., hot tea, milk, sugar"
                            rows="4"
                            className={`w-full p-3 rounded-lg border-2 dark:border-gray-600 ${themeClasses.card} ${themeClasses.text} focus:ring-purple-500 focus:border-purple-500 resize-none transition-colors duration-500`}
                            disabled={!!image}
                        />
                    </div>
                    
                    <button
                        onClick={processImage}
                        disabled={(!image && ingredientText.trim() === '') || status.includes('Processing...') || status.includes('Error.')}
                        className={`w-full px-8 py-3 rounded-full text-white font-bold transition-transform transform hover:scale-105 active:scale-95 duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${themeClasses.buttonPrimary} shadow-lg text-lg`}
                    >
                        {status.includes('...') ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" /></svg>
                                Find Recipes
                            </span>
                        ) : 'Find Recipes'}
                    </button>
                    
                    {errorMessage && <p className="mt-4 text-sm font-semibold text-center text-red-400">{errorMessage}</p>}
                    {!errorMessage && (
                        <p className={`mt-4 text-sm font-semibold text-center ${themeClasses.listText}`}>
                            <strong>Status:</strong> <span className={errorMessage ? 'text-red-400' : 'text-green-400'}>{errorMessage || status}</span>
                        </p>
                    )}
                </div>
                {/* --- End Combined Input Section --- */}


                {/* --- Extracted Text Display --- */}
                {extractedText && (
                    <div className={`mt-10 p-6 rounded-xl shadow-inner w-full max-w-2xl ${themeClasses.infoBox} transition-colors duration-500`}>
                        <h3 className={`text-xl font-bold mb-3 ${themeClasses.subheading}`}>Source Text Used:</h3>
                        <pre className={`whitespace-pre-wrap text-base p-4 rounded ${themeClasses.listText} bg-gray-600/50 dark:bg-gray-800/50 border border-dashed border-gray-600`}>
                            {extractedText || 'No text provided.'}
                        </pre>
                    </div>
                )}
                {/* --- Recipe List --- */}
                {recipes.length > 0 && (
                    <div className="recipes-container mt-12 w-full max-w-6xl">
                        <h3 className={`text-3xl font-extrabold text-center mb-6 ${themeClasses.subheading}`}>
                            Suggested Recipes Based on Ingredients 🍽️
                        </h3>
                        {/* Show fallback warning if present */}
                        {recipes.some(r => r.image && r.image.includes('FALLBACK')) && (
                            <div className="text-center p-3 mb-4 rounded-lg bg-yellow-600/20 text-yellow-300 border border-yellow-600">
                                ⚠️ Using local fallback data. Nutrition details may be minimal. Check your API key.
                            </div>
                        )}
                        <div className="recipe-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {recipes.map((recipe) => (
                                <div
                                    key={recipe.id}
                                    className={`p-4 rounded-3xl shadow-xl cursor-pointer transform hover:scale-[1.02] transition-all duration-300 ${themeClasses.card} ${themeClasses.cardHover}`}
                                    onClick={() => { fetchRecipeDetails(recipe.id); setImageLoading(prev => ({ ...prev, [recipe.id]: true })); }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchRecipeDetails(recipe.id, recipe.title)}
                                    aria-label={`View details for ${recipe.title}`}
                                >
                                    <div className="relative">
                                        {imageLoading[recipe.id] && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-xl">
                                                <svg className="animate-spin h-8 w-8 text-purple-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z" /></svg>
                                            </div>
                                        )}
                                        <img
                                            src={recipe.image}
                                            alt={recipe.title}
                                            className={`w-full h-48 object-cover rounded-2xl mb-3 transition-opacity duration-500 ${imageLoading[recipe.id] ? 'opacity-50' : 'opacity-100'}`}
                                            onLoad={() => setImageLoading(prev => ({ ...prev, [recipe.id]: false }))}
                                            onError={(e) => {
                                                e.target.src = `https://placehold.co/400x300/4c4c4c/ffffff?text=Image+Not+Found`;
                                                setImageLoading(prev => ({ ...prev, [recipe.id]: false }));
                                            }}
                                        />
                                    </div>
                                    <h4
                                        className={`text-xl font-extrabold text-center mt-2 ${
                                            isDarkMode ? 'text-gray-100' : 'text-gray-800'
                                        }`}
                                    >
                                        {recipe.title}
                                    </h4>
                                    <p className={`text-sm text-center font-bold ${themeClasses.subheading}`}>
                                        {/* Safely access calories for the card preview */}
                                        {recipe.nutrients?.calories > 0 ? `${recipe.nutrients.calories} kcal` : 'View Details'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {status.includes('Complete!') && recipes.length === 0 && (
                    <p className={`mt-4 text-center text-lg font-medium ${themeClasses.listText}`}>
                        🧐 No recipes found. Try a different image or include more common ingredients!
                    </p>
                )}
            </div>
        );
    };

    const renderPageContent = () => {
        const dailyGoal = healthMetrics?.maintainWeight || 'N/A';
        const loggedCalories = dailyNutritionSummary.Calories;
        const progressPercentage = dailyGoal !== 'N/A' ? Math.min(100, (loggedCalories / parseFloat(dailyGoal)) * 100).toFixed(1) : 0;
        const calorieProgressColor = loggedCalories <= dailyGoal ? 'bg-green-500/80' : 'bg-red-500/80';
        const remainingCalories = dailyGoal !== 'N/A' ? (parseFloat(dailyGoal) - loggedCalories).toFixed(0) : '---';

        switch (activePage) {
            case 'Login/Sign Up':
                return <LoginSignUpPage 
                            themeClasses={themeClasses} 
                            handleNavClick={handleNavClick} 
                            setUserProfile={setUserProfile}
                            setAge={setAge}
                            setWeight={setWeight}
                            setHeight={setHeight}
                            setDietPreference={setDietPreference}
                            setMealTypePreference={setMealTypePreference}
                            setHistoricalLog={setHistoricalLog} 
                            setWeightLog={setWeightLog}
                        />;
            case 'Add Recipe':
                // Pass the current user ID to isolate local storage for custom recipes
                return <AddRecipePage themeClasses={themeClasses} userId={userProfile.userId} />;
            case 'Home':
                return renderHomePageContent();
            case 'Daily Goal':
                return (
                    <div className="w-full max-w-4xl mx-auto space-y-8">
                        
                        {/* --- DAILY GOAL SUMMARY --- */}
                        <div className={`p-6 rounded-2xl shadow-lg ${themeClasses.infoBox} transition-colors duration-500 border-t-4 border-b-4 border-teal-500`}>
                            <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Your Daily Progress</h3>
                            
                            {healthMetrics ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-xl font-bold">
                                        <span className={themeClasses.text}>Goal (Maintain Weight):</span>
                                        <span className="text-teal-400">{dailyGoal} kcal</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xl font-bold">
                                        <span className={themeClasses.text}>Logged Today:</span>
                                        <span className="text-purple-400">{loggedCalories.toFixed(0)} kcal</span>
                                    </div>
                                    
                                    <div className={`pt-4 border-t ${themeClasses.nutrientsSubtext}`}>
                                        <p className="text-lg font-semibold mb-2">
                                            {remainingCalories > 0 ? 
                                                <span className="text-green-400">{remainingCalories} kcal left</span> :
                                                <span className="text-red-400">{Math.abs(remainingCalories)} kcal over</span>
                                            }
                                        </p>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full bg-gray-600 rounded-full h-4">
                                            <div 
                                                className={`h-4 rounded-full ${calorieProgressColor} transition-all duration-700`}
                                                style={{ width: `${progressPercentage}%` }}
                                                aria-valuenow={progressPercentage}
                                                aria-valuemin="0"
                                                aria-valuemax="100"
                                            ></div>
                                        </div>
                                        <p className={`text-sm mt-1 ${themeClasses.nutrientsSubtext}`}>{progressPercentage}% of goal met.</p>
                                    </div>
                                </div>
                            ) : (
                                <p className={`text-center ${themeClasses.listText}`}>
                                    Go to the **Profile** tab and press **Calculate My Goals** to set a daily target!
                                </p>
                            )}
                        </div>
                        {/* --- END DAILY GOAL SUMMARY --- */}
                        
                        <div className={`p-6 rounded-2xl shadow-lg ${themeClasses.infoBox} transition-colors duration-500`}>
                            {/* Chart showing cumulative data */}
                            <NutritionalChart data={dailyNutritionSummary} colors={chartColors} isDarkMode={isDarkMode} />
                        </div>

                        {/* Manual Meal Logging Form - USES NEW handleManualLookup */}
                        <ManualMealLogger handleLookup={handleManualLookup} themeClasses={themeClasses} />

                        {/* Logged Meals List (UNMODIFIED) */}
                        <div className={`p-6 rounded-2xl shadow-lg ${themeClasses.infoBox} transition-colors duration-500`}>
                            <h3 className={`text-2xl font-bold mb-4 ${themeClasses.subheading}`}>Meals Logged Today ({dailyMealLog.length})</h3>
                            {dailyMealLog.length === 0 ? (
                                <p className={`text-center ${themeClasses.listText}`}>No meals tracked yet. Use the form above or log a recipe from the Home page!</p>
                            ) : (
                                <ul className="space-y-3">
                                    {dailyMealLog.map((meal, index) => (
                                        <li key={index} className={`flex justify-between items-center p-3 rounded-lg ${themeClasses.card}`}>
                                            <div className="flex items-center space-x-3">
                                                <span className={`px-2 py-1 text-xs font-bold rounded ${meal.type === 'Recipe' ? 'bg-purple-500 text-white' : 'bg-gray-400 text-gray-900'}`}>{meal.type}</span>
                                                <span className={`font-semibold ${themeClasses.text}`}>{meal.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-lg font-extrabold ${themeClasses.subheading}`}>{meal.calories} kcal</span>
                                                <p className={`text-xs ${themeClasses.nutrientsSubtext}`}>{meal.timestamp}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                );
            case 'Profile':
                return (
                    <div className="flex flex-col items-center p-6 space-y-8 max-w-4xl mx-auto">
                        <h2 className={`text-3xl font-bold ${themeClasses.subheading} transition-colors duration-500`}>My Health Profile</h2>
                        <div className={`flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-6 p-6 rounded-2xl shadow-lg w-full ${themeClasses.infoBox} transition-colors duration-500`}>
                            <div className='flex items-center space-x-4'>
                                <img
                                    src="https://placehold.co/100x100/9F7AEA/ffffff?text=P"
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full border-4 border-purple-400"
                                />
                                <div className="flex flex-col space-y-1 text-center sm:text-left">
                                    <h3 className="text-2xl font-semibold">{userProfile.name}</h3>
                                    <p className={`text-sm ${themeClasses.listText}`}>{userProfile.email}</p>
                                    <p className={`text-sm ${themeClasses.listText}`}>User ID: {userProfile.userId}</p>
                                </div>
                            </div>
                             {/* --- LOGOUT BUTTON (NEW) --- */}
                            <button 
                                onClick={handleLogout}
                                className={`px-6 py-2 rounded-full text-white font-bold bg-red-600 hover:bg-red-700 transition-transform transform hover:scale-105 shadow-lg text-lg flex items-center mt-4 sm:mt-0`}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Log Out
                            </button>
                            {/* --- END LOGOUT BUTTON --- */}
                        </div>

                        {/* Calorie Calculator Section */}
                        <div className={`w-full mx-auto rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8 ${themeClasses.infoBox} transition-colors duration-500`}>
                            <div className="text-center">
                                <h2 className={`text-2xl font-extrabold ${themeClasses.subheading}`}>Calorie Goal Calculator 🚀</h2>
                            </div>

                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Age, Height, Weight, Gender, Meals, Weight Plan, Activity (Inputs are unchanged) */}
                                <div className="flex flex-col space-y-2">
                                    <label htmlFor="age" className={`block font-medium ${themeClasses.text}`}>Age (years)</label>
                                    <div className="flex items-center space-x-2">
                                        <input type="number" id="age" value={age} onChange={(e) => setAge(parseInt(e.target.value) || 0)} min="1" className="w-full text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 p-3 text-lg transition-colors duration-500"/>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setAge(prevAge => prevAge > 0 ? prevAge - 1 : 0)}>-</button>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setAge(prevAge => prevAge + 1)}>+</button>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <label htmlFor="height" className={`block font-medium ${themeClasses.text}`}>Height (cm)</label>
                                    <div className="flex items-center space-x-2">
                                        <input type="number" id="height" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 0)} min="1" className="w-full text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 p-3 text-lg transition-colors duration-500"/>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setHeight(prevHeight => prevHeight > 0 ? prevHeight - 1 : 0)}>-</button>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setHeight(prevHeight => prevHeight + 1)}>+</button>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <label htmlFor="weight" className={`block font-medium ${themeClasses.text}`}>Weight (kg) <span className="text-xs text-green-400 font-normal">({weightLog.length > 0 ? 'Latest Logged: ' + weightLog[0].weight + ' kg' : 'Manual Entry'})</span></label>
                                    <div className="flex items-center space-x-2">
                                        <input type="number" id="weight" value={weight} onChange={(e) => setWeight(parseFloat(e.target.value) || 0)} min="1" step="0.1" className="w-full text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 p-3 text-lg transition-colors duration-500"/>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setWeight(prevWeight => parseFloat((prevWeight > 0 ? prevWeight - 1 : 0).toFixed(1)))}>-</button>
                                        <button className={`p-2 rounded-full hover:shadow-lg transition-colors duration-200 ${themeClasses.buttonPrimary}`} onClick={() => setWeight(prevWeight => parseFloat((prevWeight + 1).toFixed(1)))}>+</button>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <h3 className={`block font-medium ${themeClasses.text}`}>Gender</h3>
                                    <div className="flex items-center space-x-6">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} className="form-radio h-4 w-4 text-purple-600 focus:ring-purple-500" />
                                            <span className={`${themeClasses.text}`}>Male</span>
                                        </label>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} className="form-radio h-4 w-4 text-purple-600 focus:ring-purple-500"/>
                                            <span className={`${themeClasses.text}`}>Female</span>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <label htmlFor="meals" className={`block font-medium ${themeClasses.text}`}>Meals per day</label>
                                    <div className="relative">
                                        <input type="range" id="meals" min="1" max="6" value={mealsPerDay} onChange={(e) => setMealsPerDay(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 transition-colors duration-500"/>
                                        <p className={`text-center mt-2 text-lg font-bold ${themeClasses.text}`}>{mealsPerDay} meals</p>
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                    <label htmlFor="weight-plan" className={`block font-medium ${themeClasses.text}`}>Choose your goal:</label>
                                    <select id="weight-plan" className={`w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-purple-500 focus:border-purple-500 p-3 text-lg transition-colors duration-500`}>
                                        <option>Maintain weight</option>
                                        <option>Mild weight loss</option>
                                        <option>Regular weight loss</option>
                                        <option>Aggressive weight loss</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* --- DIETARY PREFERENCES ON PROFILE PAGE (READ-ONLY PREVIEW) --- */}
                            <div className="w-full pt-4 border-t dark:border-gray-600">
                                <h3 className={`text-2xl font-bold mb-3 ${themeClasses.subheading}`}>Current Dietary Profile</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <p className={`${themeClasses.listText}`}><span className="font-bold">Meal Type:</span> {mealTypePreference}</p>
                                    <p className={`${themeClasses.listText}`}><span className="font-bold">Restrictions:</span> {dietPreference.length > 0 ? dietPreference.join(', ') : 'None'}</p>
                                </div>
                                <p className={`text-xs ${themeClasses.nutrientsSubtext} mt-2`}>Note: Update these settings on the "Login/Sign Up" page when creating/re-authenticating your profile.</p>
                            </div>


                            {/* Activity slider section - Full width */}
                            <div className="pt-4 md:col-span-2 lg:col-span-3">
                                <h3 className={`block font-medium mb-3 ${themeClasses.text}`}>Activity Level</h3>
                                <div className="relative">
                                    <input type="range" id="activity" min="1" max="5" value={activity} onChange={(e) => setActivity(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 transition-colors duration-500"/>
                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                                        <span>Sedentary (1)</span>
                                        <span>Extra Active (5)</span>
                                    </div>
                                    <p className={`text-center mt-4 text-lg font-bold ${themeClasses.text}`}>Current: {getActivityLabel(activity)}</p>
                                </div>
                            </div>

                            {/* Generate button section */}
                            <div className="flex justify-center pt-6">
                                <button onClick={calculateHealthMetrics} className={`w-full sm:w-auto px-10 py-3 rounded-full text-white font-bold transition-transform transform hover:scale-105 active:scale-95 duration-200 ${themeClasses.buttonPrimary} shadow-lg text-lg`}>
                                    Calculate My Goals
                                </button>
                            </div>

                            {/* Results display area */}
                            {healthMetrics && (
                                <div className="pt-6 text-center text-gray-800 dark:text-white space-y-8 transition-colors duration-500">
                                    {healthMetrics.error ? (
                                        <p className="text-red-400 font-medium text-xl">{healthMetrics.error}</p>
                                    ) : (
                                        <>
                                            {/* BMI Section */}
                                            <div className="bg-gray-200 dark:bg-gray-800 rounded-xl p-6 shadow-lg transition-colors duration-500">
                                                <h3 className={`text-xl font-extrabold mb-2 ${themeClasses.subheading}`}>BMI CALCULATOR (Body Mass Index)</h3>
                                                <p className="text-5xl font-extrabold mt-2">{bmi} <span className="text-lg font-normal">kg/m²</span></p>
                                                <p className={`text-2xl font-bold mt-2 ${bmi < 18.5 ? 'text-yellow-500' : bmi >= 30 ? 'text-red-500' : bmi >= 25 ? 'text-orange-500' : 'text-green-500'}`}>{getBMICategory(parseFloat(bmi))}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Healthy BMI range: 18.5 kg/m² - 24.9 kg/m²</p>
                                            </div>

                                            {/* Calorie Calculator Section */}
                                            <div className="bg-gray-200 dark:bg-gray-800 rounded-xl p-6 shadow-lg transition-colors duration-500">
                                                <h3 className={`text-xl font-extrabold mb-4 ${themeClasses.subheading}`}>DAILY CALORIE GOALS 📊</h3>
                                                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                                                    Your daily caloric needs (TDEE) are **{healthMetrics.maintainWeight} kcal**. Here are your goal estimates:
                                                </p>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                                    {[
                                                        { label: 'MAINTAIN', calories: healthMetrics.maintainWeight, rate: '0 kg/week', color: 'text-green-500' },
                                                        { label: 'MILD LOSS', calories: healthMetrics.mildWeightLoss, rate: '↓ 0.25 kg/week', color: 'text-green-400' },
                                                        { label: 'REGULAR LOSS', calories: healthMetrics.weightLoss, rate: '↓ 0.5 kg/week', color: 'text-yellow-400' },
                                                        { label: 'AGGRESSIVE LOSS', calories: healthMetrics.extremeWeightLoss, rate: '↓ 1.0 kg/week', color: 'text-red-400' },
                                                    ].map((goal) => (
                                                        <div key={goal.label} className="p-3 rounded-lg bg-white dark:bg-gray-700 shadow-md">
                                                            <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">{goal.label}</p>
                                                            <p className="text-3xl font-extrabold mt-1">{goal.calories}</p>
                                                            <p className="text-xs font-medium mt-1 text-gray-500 dark:text-gray-400">CALORIES</p>
                                                            <p className={`text-xs mt-1 ${goal.color}`}>{goal.rate}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Weekly Goal Text Box */}
                                            <div className={`w-full p-6 rounded-2xl shadow-lg ${themeClasses.infoBox}`}>
                                                <h3 className={`text-xl font-bold mb-4 ${themeClasses.subheading}`}>Analysis Summary</h3>
                                                <p className={`text-sm leading-relaxed ${themeClasses.listText}`}>
                                                    {userProfile.weeklyGoal}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'Weekend Summary':
                const goal = healthMetrics?.maintainWeight || 'N/A';

                return (
                    <div className="w-full max-w-4xl mx-auto space-y-8 p-6">
                        <h2 className={`text-3xl font-bold text-center ${themeClasses.subheading} transition-colors duration-500`}>Weekly Review & Progress</h2>
                        
                        {/* --- Calorie Chart --- */}
                        <HistoricalCalorieChart 
                            historicalLog={[
                                ...historicalLog, 
                                { date: currentDateKey, ...dailyNutritionSummary }
                            ]} 
                            themeClasses={themeClasses} 
                            isDarkMode={isDarkMode}
                            dailyGoal={goal}
                        />

                        {/* --- Weight Tracker Component (Input/Log) --- */}
                        <WeightLogger
                            themeClasses={themeClasses}
                            weightLog={weightLog}
                            setWeightLog={setWeightLog}
                            setWeight={setWeight} // Updates the main weight for profile calculation
                            newWeight={newWeight}
                            setNewWeight={setNewWeight}
                        />

                        {/* --- Weight Tracker Graph (Visualization) --- */}
                        <WeightTrackerGraph 
                            weightLog={weightLog}
                            themeClasses={themeClasses}
                            isDarkMode={isDarkMode}
                        />

                        <div className={`mt-8 p-6 rounded-2xl shadow-lg ${themeClasses.infoBox}`}>
                            <p className={`text-xl font-semibold ${themeClasses.subheading}`}>Goal Analysis: N/A</p>
                            <p className={`mt-2 ${themeClasses.listText}`}>This section will soon integrate your nutrition and weight data to provide a comprehensive weekly performance review and future goal setting recommendations.</p>
                        </div>
                    </div>
                );
            default:
                return <div className="text-center">Page not found.</div>;
        }
    };

    const isUserLoggedIn = activePage !== 'Login/Sign Up';

    return (
        <div
            className={`min-h-screen font-sans flex flex-col items-center p-4 sm:p-8 transition-all duration-500 ease-in-out`}
            style={{
                backgroundImage: 'url("https://images.unsplash.com/photo-1543353071-10c84333b207?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
        >
            <div className={`absolute inset-0 z-0 ${themeClasses.bgFilter} transition-colors duration-500`}></div>
            
            <header className={`w-full max-w-7xl flex justify-between items-center mb-10 z-10 transition-colors duration-500 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <div className="flex items-center">
                    <svg
                        className="w-8 h-8 mr-2 text-purple-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7m-18 0l9 5 9-5"
                        />
                    </svg>
                    <span className="text-2xl font-extrabold tracking-wider">PlanMyPlate</span>
                </div>
                
                {/* --- DESKTOP NAV: ONLY SHOW IF LOGGED IN --- */}
                {isUserLoggedIn && (
                    <nav className="hidden md:flex space-x-6 text-lg">
                        {['Home', 'Daily Goal', 'Profile', 'Weekend Summary'].map((page) => {
                            return (
                                <button
                                    key={page}
                                    onClick={() => handleNavClick(page)}
                                    className={`px-2 py-1 transition-all duration-300 ${themeClasses.navText} ${
                                        activePage === page ? themeClasses.navActive : ''
                                    } hover:scale-105`}
                                    aria-current={activePage === page ? 'page' : undefined}
                                    aria-label={`Maps to ${page}`}
                                >
                                    {page}
                                </button>
                            );
                        })}
                        {/* --- ADD RECIPES BUTTON --- */}
                        <button
                            onClick={() => handleNavClick('Add Recipe')}
                            className={`px-3 py-1 rounded-full text-white font-bold bg-purple-600 hover:bg-purple-700 transition-colors duration-200 shadow-md flex items-center`}
                        >
                            + Add Recipe
                        </button>
                    </nav>
                )}
                
                <div className="flex space-x-4">
                    <button 
                        onClick={toggleDarkMode}
                        className={`p-3 rounded-full text-white font-bold transition-all duration-500 hover:scale-110 ${themeClasses.buttonPrimary} shadow-md text-white`}
                        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {isDarkMode ? '🌞' : '🌙'}
                    </button>
                    {/* These buttons are present regardless of login, but only for aesthetic/non-critical functionality */}
                    <button className={`${themeClasses.button} p-3 rounded-full hidden sm:block transition-colors duration-500`} aria-label="Search">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                    <button className={`${themeClasses.button} p-3 rounded-full hidden sm:block transition-colors duration-500`} aria-label="Menu">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </div>
            </header>

            <main
                className={`w-full max-w-7xl min-h-[70vh] p-8 rounded-3xl z-10 border-t-4 border-b-4 border-purple-500 ${themeClasses.container} transition-all duration-500 ease-in-out`}
            >
                {renderPageContent()}
            </main>
            
            {/* --- MOBILE NAV: ONLY SHOW IF LOGGED IN --- */}
            {isUserLoggedIn && (
                <nav className="fixed bottom-0 left-0 w-full md:hidden z-20 bg-gray-800/95 backdrop-blur-md shadow-2xl rounded-t-xl p-2">
                    <div className="flex justify-around">
                        {['Home', 'Daily Goal', 'Profile', 'Weekend Summary', 'Add Recipe'].map((page) => {
                            const iconMap = {
                                'Home': <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-10v10a1 1 0 001 1h3M14 20h-4" /></svg>,
                                'Daily Goal': <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M12 19V6l12-3v13M12 19l-7 2M12 6l-7 2M21 3l-7 2m7-2L9 3" /></svg>,
                                'Profile': <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
                                'Weekend Summary': <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                                'Add Recipe': <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                            }

                            return (
                                <button
                                    key={`mobile-${page}`}
                                    onClick={() => handleNavClick(page)}
                                    className={`flex flex-col items-center p-2 text-xs transition-all duration-300 ${activePage === page ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {iconMap[page]}
                                    <span>{page}</span>
                                </button>
                            );
                        })}
                    </div>
                </nav>
            )}
        </div>
    );
};

export default App;
