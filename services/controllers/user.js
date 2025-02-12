// services/db/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const router = express.Router();
const db = require('../db/db');
require('dotenv').config();

router.get('/', async (req, res) => {
    const { role } = req.query;
    
    try {
      const database = db.getDb();
      const usersCollection = database.collection('users');
      const query = role ? { usr_role: role } : {};
      // Find the user by username
      let users = await usersCollection.find(query).toArray();
    
      if (!users.length) {
        return res.status(400).json({ error: 'No users found' });
    }
      
      // Remove sensitive fields
      users.forEach(user => delete user.usr_password);

      // If valid, return the user object with relevant fields
      res.status(200).json(users);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

module.exports = router;
