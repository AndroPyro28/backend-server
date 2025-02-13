import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import tinify from 'tinify';
import { ObjectId, Decimal128 } from 'mongodb';
import {getDb} from '../db/db.js';
import 'dotenv/config'; // Lo
const router = express.Router();
router.put('/update-status/:id', async (req, res) => {
        const {id} = req.params
        const {status, reason} = req.body;
        console.log({status, reason})
    try {
        const database = getDb();
        if (!database) {
          throw new Error("Database connection failed.");
        }
        const transactionCollection = database.collection("transactions")

        const transaction = await transactionCollection.findOne({trn_id: id})
        if(!transaction || !transaction._id) {
            console.error('transaction not found:', id);
            return res.status(404).json({ error: 'transaction not found.' });
        }

        const updateFields = {
            trn_status: status,
            trn_reason: reason
        }

        const result = await transactionCollection.updateOne({trn_id:id}, { $set: updateFields },  { upsert: true })
        return res.status(200).json({result})
    
      } catch (err) {
        console.error('Error updating transaction status:', err);
        return res.status(500).json({ error: '*Failed to add a new rate' });
      }
})

export default router;