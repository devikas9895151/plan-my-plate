const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000;

// Set up Multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- MongoDB Connection Setup ---
const MONGO_URI = process.env.MONGO_URI; 

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is not defined in .env file.");
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });

// --- MongoDB Schemas and Models ---

// Schema for individual daily calorie entries
const HistoricalLogSchema = new mongoose.Schema({
    date: { type: String, required: true },
    Calories: { type: Number, default: 0 },
    FatContent: { type: Number, default: 0 },
    CarbohydrateContent: { type: Number, default: 0 },
    ProteinContent: { type: Number, default: 0 },
});

// Schema for weight tracking entries
const WeightLogSchema = new mongoose.Schema({
    date: { type: String, required: true },
    weight: { type: Number, required: true },
});

// Main User Schema
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    
    age: { type: Number, default: 30 },
    height: { type: Number, default: 175 },
    weight: { type: Number, default: 70 }, // Latest recorded weight
    gender: { type: String, default: 'male' },
    goal: { type: String, default: 'Maintain Weight' },
    diseases: { type: String, default: '' },
    
    historicalLog: [HistoricalLogSchema],
    weightLog: [WeightLogSchema],
    
    userId: { type: String, required: true, unique: true },
});

const User = mongoose.model('User', UserSchema);

// --- Utility Function ---
const getTodayDateKey = () => new Date().toISOString().split('T')[0];

// ====================================================================
// A. AUTHENTICATION ENDPOINTS (For MongoDB Persistence)
// ====================================================================

app.post('/api/signup', async (req, res) => {
    const data = req.body;
    const email = data.email;

    try {
        if (await User.findOne({ email })) {
            return res.status(400).json({ error: 'User already exists with this email.' });
        }

        // NOTE: In production, use bcrypt.hash(data.password, 10)
        const hashedPassword = data.password; 
        
        const initialWeight = parseFloat(data.weight) || 70;
        const todayKey = getTodayDateKey();
        
        const newUser = new User({
            email: email,
            password: hashedPassword, 
            name: data.name,
            age: parseInt(data.age) || 30,
            height: parseInt(data.height) || 175,
            weight: initialWeight,
            gender: data.gender || 'male',
            goal: data.goal || 'Maintain Weight',
            diseases: data.diseases || '',
            userId: `user-${Math.random().toString(36).substring(2, 10)}`,
            historicalLog: [], // Start fresh!
            weightLog: [{ date: todayKey, weight: initialWeight }], // Log initial weight
        });

        const savedUser = await newUser.save();
        
        // Prepare data for client
        const clientData = savedUser.toObject();
        delete clientData.password;
        delete clientData._id;
        clientData.dietPlan = `Primary goal: ${data.goal}. Conditions: ${data.diseases || 'None'}.`;

        res.status(201).json({ profile: clientData });

    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // NOTE: Use bcrypt.compare() for production code!
        const user = await User.findOne({ email, password });
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Prepare data for client
        const clientData = user.toObject();
        delete clientData.password;
        delete clientData._id;
        clientData.dietPlan = `Primary goal: ${user.goal}. Conditions: ${user.diseases || 'None'}.`;

        res.status(200).json({ profile: clientData });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ====================================================================
// B. IMAGE PROCESSING & RECIPE ENDPOINTS (Your Original Logic)
// ====================================================================

// Main API endpoint to scan the receipt and get recipes
app.post('/api/process-ingredients', upload.single('image'), async (req, res) => {
    // If text is provided manually, use req.body.ingredientText
    const isManualText = req.body.ingredientText && req.body.ingredientText.trim().length > 0;
    
    let parsedText = req.body.ingredientText || '';

    try {
        if (req.file && !isManualText) {
            // --- Step 1A: OCR (If image file is present) ---
            const ocrFormData = new FormData();
            ocrFormData.append('apikey', process.env.OCR_SPACE_API_KEY);
            ocrFormData.append('language', 'eng');
            ocrFormData.append('file', req.file.buffer, req.file.originalname);
            
            const ocrResponse = await axios.post('https://api.ocr.space/parse/image', ocrFormData, {
                headers: ocrFormData.getHeaders(),
            });
            
            if (ocrResponse.data.IsErroredOnProcessing) {
                 // Throwing an error here prevents the rest of the steps if OCR fails
                throw new Error(ocrResponse.data.ErrorMessage || 'OCR failed to process the image.');
            }
            
            parsedText = ocrResponse.data.ParsedResults[0]?.ParsedText || '';
        }
        
        if (!parsedText) {
             return res.status(400).json({ error: 'No ingredients extracted or manually provided.' });
        }

        // --- Step 1B: Clean up ingredients from OCR/Manual input ---
        const ingredientList = parsedText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 3 && !line.includes('Total') && !line.includes('$') && !line.includes('Subtotal'))
            .slice(0, 10); // Limit to top 10 ingredients 
        
        if (ingredientList.length === 0) {
            return res.status(400).json({ error: 'Could not identify usable ingredients from the text provided.' });
        }

        // --- Step 2: Use Spoonacular API to find recipes based on ingredients ---
        const spoonacularResponse = await axios.get('https://api.spoonacular.com/recipes/findByIngredients', {
            params: {
                apiKey: process.env.SPOONACULAR_API_KEY,
                ingredients: ingredientList.join(','),
                number: 6, // Get 6 recipes
                ranking: 2 // Maximize used ingredients
            },
        });
        
        // --- Step 3: Send results back to the frontend ---
        res.json({
            extractedIngredients: parsedText, // Send raw text back for confirmation
            recipes: spoonacularResponse.data,
        });

    } catch (error) {
        console.error('API request failed:', error.message);
        res.status(500).json({ 
            error: 'Failed to process request. Check API keys/Server logs.',
            detail: error.message
        });
    }
});

// ====================================================================
// C. DATA MUTATION/LOGGING ENDPOINTS (For persisting user updates)
// ====================================================================

// [NOTE]: You will need to implement /api/log_meal and /api/log_weight here 
// later to truly persist daily data updates to MongoDB.

// --- Start the Server ---
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
