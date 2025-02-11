// services/db/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const router = express.Router();
const db = require('./db/db');
require('dotenv').config();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const database = db.getDb();
      const usersCollection = database.collection('users');
  
      console.log({ username, password })
      // Find the user by username
      const user = await usersCollection.findOne({ usr_username: username });
    
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
  
      // Compare the provided password with the hashed password stored in the database
      const isPasswordValid = await bcrypt.compare(password, user.usr_password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
  
      // If valid, return the user object with relevant fields
      res.status(200).json({
        _id: user._id,
        usr_id: user.usr_id, // Custom user ID (e.g., 'CVU******')
        usr_username: user.usr_username,
        usr_email: user.usr_email,
        usr_role: user.usr_role,
        usr_profile_photo: user.usr_profile_photo
      });
    } catch (err) {
      console.error('Error logging in:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

module.exports = router;
