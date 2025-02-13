import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import tinify from 'tinify';
import { ObjectId, Decimal128 } from 'mongodb';
import {getDb} from '../db/db.js';
import 'dotenv/config'; // Load environment variables


const router = express.Router();
router.get('/', async (req, res) => {
    const { role } = req.query;
    
    try {
      const database = getDb();
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

  export default router;
