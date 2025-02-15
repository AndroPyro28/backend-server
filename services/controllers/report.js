import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import tinify from 'tinify';
import { ObjectId, Decimal128 } from 'mongodb';
import {getDb} from '../db/db.js';
import 'dotenv/config'; // Load environment variables


const router = express.Router();
router.get('/', async (req, res) => {
    const { type } = req.query;
    
    try {
      const database = getDb();
      const reportsCollection = database.collection('reports');
      const query = type ? { rpt_type: type } : {};
      // Find the user by username
      const reports = await reportsCollection.find(query).toArray();
    
      if (!reports.length) {
        return res.status(400).json({ error: 'No reports found' });
    }
      // Remove sensitive fields
      // If valid, return the user object with relevant fields
      res.status(200).json(reports);
    } catch (err) {
      console.error('Error fetching reports:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  export default router;
