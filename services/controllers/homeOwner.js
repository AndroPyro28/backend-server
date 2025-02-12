// services/db/userRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const router = express.Router();
const db = require('../db/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 's4fG-21pLm!x@t$Q&eF1K9dP7^rtyh9!YvBn#MjKlZ3UwCx';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in the environment variables or fallback');
}

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1]; // Extract token

    if (!token) {
        return res.status(403).json({ error: 'Access denied. Token missing.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Access denied. Invalid token.' });
        }

        req.user = user;
        next(); // Proceed to the next middleware or route handler
    });
};





// =========================== LOGIN AND LOGOUT ROUTES ===========================

// User Login Route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const dbClient = db.getDb();
        const user = await dbClient.collection('users').findOne({ usr_username: username });

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const passwordMatch = await bcrypt.compare(password, user.usr_password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ userId: user.usr_id }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: 'Login successful',
            user: { usr_id: user.usr_id, usr_first_name: user.usr_first_name },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An error occurred while logging in.' });
    }
});

// User Logout Route
router.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Logout successful' });
});




// =========================== USER PROFILE ROUTES ===========================

router.get('/header/:userId', async (req, res) => {
    const { userId } = req.params;
    console.log("user fetch", userId)
    try {
        console.log('Fetching user data for userId:', userId);
        const dbClient = db.getDb();
        const user = await dbClient.collection('users').findOne({ usr_id: userId });

        if (!user) {
            console.log('User not found:', userId);
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json({
            userFirstName: user.usr_first_name,
            userLastName: user.usr_last_name,
            userUsername: user.usr_username,
            userPhone: user.usr_phone,
            userEmail: user.usr_email,
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'An error occurred while fetching user profile.' });
    }
});

// Update User Profile
router.put('/profile/:userId',  async (req, res) => {
    const { userId } = req.params;
    const { usr_first_name, usr_last_name, usr_username, usr_phone, usr_email, new_password } = req.body;

    console.log('Received update request for user:', userId);

    try {
        const dbClient = db.getDb();

        // Check if the user exists before updating
        const existingUser = await dbClient.collection('users').findOne({ usr_id: userId });

        if (!existingUser) {
            console.error('User not found:', userId);
            return res.status(404).json({ error: 'User not found.' });
        }

        // Prepare the update object
        const updateFields = {
            usr_first_name,
            usr_last_name,
            usr_username,
            usr_phone,
            usr_email,
        };

        if (new_password) {
            const hashedPassword = await bcrypt.hash(new_password, 10);
            updateFields.usr_password = hashedPassword;
        }

        // Update the user
        const result = await dbClient.collection('users').updateOne(
            { usr_id: userId },
            { $set: updateFields }
        );

        if (result.matchedCount === 0) {
            console.error('Failed to match user during update:', userId);
            return res.status(404).json({ error: 'User not found.' });
        }

        console.log('Profile updated successfully for user:', userId);
        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'An error occurred while updating user profile.' });
    }
});




// =========================== PROPERTY ROUTES ===========================

router.get('/properties/:userId',  async (req, res) => {
    const { userId } = req.params; // Extract userId from JWT payload
    console.log(`Received userId: '${userId}'`); // Log userId for debugging

    try {
        const dbClient = db.getDb();

        // Query using `prop_owner_id` as a string
        const query = { prop_owner_id: userId.trim() };

        console.log('Constructed query:', query); // Log the constructed query

        // Fetch properties
        const properties = await dbClient.collection('properties').find(query).toArray();

        if (!properties.length) {
            console.log(`No properties found for userId: ${userId}`);
            return res.status(200).json({ properties: [] });
        }

        console.log(`Found properties for userId: ${userId}`, properties); // Debugging
        res.status(200).json({ properties });
    } catch (error) {
        console.error('Error fetching properties:', error);
        res.status(500).json({ error: 'An error occurred while fetching properties.' });
    }
});

const convertDecimalToNumber = (value) => {
    if (value && value.$numberDecimal) {
        return parseFloat(value.$numberDecimal);
    }
    return value;
};

router.get('/properties-by-propId/:propId',  async (req, res) => {
    const { propId } = req.params;
    try {
        const dbClient = db.getDb();

        if (!ObjectId.isValid(propId)) {
            return res.status(400).json({ error: 'Invalid property ID format.' });
        }

        const property = await dbClient.collection('properties').findOne({ _id: new ObjectId(propId) });

        if (!property) {
            return res.status(404).json({ error: 'Property not found.' });
        }

        const convertDecimal = (value) => {
            if (value && value.$numberDecimal) {
                return parseFloat(value.$numberDecimal);
            }
            return value || 0;
        };

        const convertedProperty = {
            ...property,
            prop_curr_amt_due: convertDecimal(property.prop_curr_amt_due),
            prop_curr_hoamaint_fee: convertDecimal(property.prop_curr_hoamaint_fee),
            prop_curr_water_charges: convertDecimal(property.prop_curr_water_charges),
            prop_curr_garb_fee: convertDecimal(property.prop_curr_garb_fee),
        };

        res.status(200).json(convertedProperty);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching property details.' });
    }
});




// =========================== BILLING STATEMENTS ROUTES ===========================

// Fetch Billing Statements for a User
router.get('/statements',  async (req, res) => {
    const { userId } = req.user; // Extract userId from JWT payload
    console.log(`Received userId: '${userId}'`); // Log userId for debugging

    try {
        const dbClient = db.getDb();

        // Query the `properties` collection to find the `prop_owner` ObjectId
        const property = await dbClient.collection('properties').findOne({ prop_owner_id: userId.trim() });

        if (!property) {
            console.log(`No property found for userId: ${userId}`);
            return res.status(404).json({ error: 'No properties found for this user.' });
        }

        const propOwnerId = property.prop_owner; // Retrieve the ObjectId for the owner

        console.log('Found propOwnerId:', propOwnerId); // Log the retrieved ObjectId

        // Query the `statements` collection using the `prop_owner` ObjectId
        const query = { bll_user_rec: propOwnerId }; // Match the correct ObjectId
        const statements = await dbClient.collection('statements').find(query).toArray();

        if (!statements.length) {
            console.log(`No statements found for propOwnerId: ${propOwnerId}`);
            return res.status(200).json({ statements: [] });
        }

        console.log(`Found statements for propOwnerId: ${propOwnerId}`, statements); // Debugging
        res.status(200).json({ statements });
    } catch (error) {
        console.error('Error fetching statements:', error);
        res.status(500).json({ error: 'An error occurred while fetching statements.' });
    }
});


  

// =========================== DASHBOARD ROUTE ===========================

// Fetch User Dashboard Data
router.get('/dashboard/:userId',  async (req, res) => {
    const { userId } = req.params;

    try {
        const dbClient = db.getDb();
        const user = await dbClient.collection('users').findOne({ usr_id: userId });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const properties = await dbClient.collection('properties').find({ prop_owner: user._id }).toArray();
        const walletData = await dbClient.collection('wallet').findOne({ wall_owner: userId });

        const response = {
            userFirstName: user.usr_first_name,
            userLastName: user.usr_last_name,
            properties: properties.map((property) => ({
                propLotNum: property.prop_lot_num,
                totalDues: property.prop_curr_amt_due
                    ? parseFloat(property.prop_curr_amt_due.toString()).toFixed(2)
                    : '0.00',
            })),
            walletBalance: walletData?.wall_bal
                ? parseFloat(walletData.wall_bal.toString())
                : 0,
            wall_adv_hoa_pay: walletData?.wall_adv_hoa_pay
                ? parseFloat(walletData.wall_adv_hoa_pay.toString())
                : 0,
            wall_adv_water_pay: walletData?.wall_adv_water_pay
                ? parseFloat(walletData.wall_adv_water_pay.toString())
                : 0,
            wall_adv_garb_pay: walletData?.wall_adv_garb_pay
                ? parseFloat(walletData.wall_adv_garb_pay.toString())
                : 0,
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'An error occurred while fetching dashboard data.' });
    }
});




// =========================== TRANSACTION ROUTES ===========================

// Fetch Transactions for a User
// router.get('/transaction/:userId',  async (req, res) => {
//     const { userId } = req.params;

//     try {
//         const dbClient = db.getDb();
//         const transactions = await dbClient.collection('transactions').find({ trn_user_init: userId }).toArray();

//         res.json(transactions);
//     } catch (error) {
//         console.error('Error fetching transactions:', error);
//         res.status(500).json({ error: 'An error occurred while fetching transactions.' });
//     }
// });

// Route to get transaction history for a user
router.get('/transaction/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const dbClient = db.getDb();
        const transactions = await dbClient
            .collection('transactions')
            .find({ trn_user_init: userId })
            .toArray();

        // Format transactions for frontend
        const formattedTransactions = transactions.map(trn => ({
            transactionId: trn.trn_id || 'N/A',
            date: trn.trn_created_at ? new Date(trn.trn_created_at).toLocaleDateString() : 'Unknown Date',
            status: trn.trn_status || 'Unknown',
            purpose: trn.trn_purp || 'N/A',
            paymentMethod: trn.trn_method || 'N/A',
            paymentAmount: trn.trn_amount || 0,
        }));

        res.status(200).json(formattedTransactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'An error occurred while fetching transactions.' });
    }
});




// =========================== REPORT ROUTES ===========================

// Create a Report
router.post('/report',  async (req, res) => {
    const { rpt_title, rpt_desc, rpt_image_url, rpt_type } = req.body;
    const { userId } = req.user;

    if (!rpt_title || !rpt_desc) {
        return res.status(400).json({ error: 'Title and description are required.' });
    }

    try {
        const dbClient = db.getDb();
        const report = {
            rpt_user: userId,
            rpt_title,
            rpt_desc,
            rpt_image_url: rpt_image_url || '',
            rpt_created_at: new Date(),
            rpt_status: 'open',
            rpt_type,
        };

        const result = await dbClient.collection('reports').insertOne(report);
        res.status(201).json({ message: 'Report created successfully.', reportId: result.insertedId });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'An error occurred while creating report.' });
    }
});

module.exports = router;



// Utility function to generate JWT token
function generateAuthToken(user) {
    const secretKey = process.env.JWT_SECRET_KEY;
    const token = jwt.sign({ _id: user._id, username: user.usr_username }, secretKey, { expiresIn: '1h' });
    return token;
}

module.exports = router;


// Fetch user profile by ID
router.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const dbClient = db.getDb();
        const userData = await dbClient.collection('users').findOne({ usr_id: userId });

        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            userFirstName: userData.usr_first_name,
            userLastName: userData.usr_last_name,
            userUsername: userData.usr_username,
            userPhone: userData.usr_phone,
            userEmail: userData.usr_email
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'An error occurred while fetching user data' });
    }
});


// Update user profile
router.put('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    const { usr_first_name, usr_last_name, usr_phone, usr_email } = req.body;

    try {
        const dbClient = db.getDb();
        const result = await dbClient.collection('users').updateOne(
            { usr_id: userId },
            {
                $set: {
                    usr_first_name,
                    usr_last_name,
                    usr_phone,
                    usr_email
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



// Utility function to generate a unique 10-character ID
// Utility function to generate unique IDs with specific prefixes
const generateId = (prefix, uppercase = false) => {
    const randomString = Math.random().toString(36).substring(2, 12); // Generate 10 characters
    return `${prefix}${uppercase ? randomString.toUpperCase() : randomString}`;
};


// =========================== TRANSACTION ROUTES ===========================
router.post('/transactions/:propId',  async (req, res) => {
    try {
        const { propId } = req.params;
        const {
            trn_type,
            trn_user_init,
            trn_created_at,
            trn_purp,
            trn_method,
            trn_amount,
            trn_image_url,
        } = req.body;

        if (!trn_type || !trn_purp || !trn_method || !trn_amount || !trn_image_url) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }

        const dbClient = db.getDb();

        if (!ObjectId.isValid(propId)) {
            return res.status(400).json({ message: 'Invalid property ID.' });
        }

        const property = await dbClient.collection('properties').findOne({ _id: new ObjectId(propId) });
        if (!property) {
            return res.status(404).json({ message: 'Property not found.' });
        }

        // Generate a unique transaction ID with mixed case characters
        const trn_id = generateId('CVT'); 

        const transaction = {
            trn_id,
            trn_type,
            trn_user_init,
            trn_created_at: new Date(trn_created_at),
            trn_purp,
            trn_method,
            trn_amount: parseFloat(trn_amount),
            trn_status: 'pending',
            trn_image_url,
        };

        await dbClient.collection('transactions').insertOne(transaction);

        res.status(201).json({
            message: 'Transaction created successfully.',
            transactionId: trn_id,
        });
    } catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// =========================== WALLET ROUTES ===========================
router.post('/wallet',  async (req, res) => {
    try {
        console.log('Received wallet creation request:', req.body); // Log request data
        const { wall_owner, wall_adv_water_pay = 0.00, wall_adv_hoa_pay = 0.00, wall_adv_garb_pay = 0.00 } = req.body;

        if (!wall_owner) {
            return res.status(400).json({ message: 'Missing wallet owner (user ID).' });
        }

        const dbClient = db.getDb();
        const existingWallet = await dbClient.collection('wallet').findOne({ wall_owner });

        if (existingWallet) {
            return res.status(400).json({ message: 'Wallet already exists for this user.' });
        }

        const wall_id = generateId('CVW'); // Generate unique wallet ID

        const newWallet = {
            wall_id,
            wall_owner,
            wall_bal: 0.00,
            wall_adv_water_pay: parseFloat(wall_adv_water_pay),
            wall_adv_hoa_pay: parseFloat(wall_adv_hoa_pay),
            wall_adv_garb_pay: parseFloat(wall_adv_garb_pay),
            wall_created_at: new Date(),
            wall_updated_at: new Date(),
        };

        await dbClient.collection('wallet').insertOne(newWallet);

        res.status(201).json({ message: 'Wallet created successfully.', wallet: newWallet });
    } catch (error) {
        console.error('Error creating wallet:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


module.exports = router;