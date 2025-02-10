import express from 'express';
import db from './services/db/db.js';  // Ensure this path is correct
import homeOwnerRoutes from './services/homeOwnerRoutes.js';
import adminRoutes from './services/adminRoutes.js';
import authRoutes from './services/authRoutes.js';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();
// Use port 5030 for the Node.js server
const port = process.env.PORT || 8080;

    try {
        await db.connectToServer();  // Connect to MongoDB
        console.log('[SERVER] Database connection successful');

        const server = express();

        // Configure CORS options dynamically
        const allowedOrigins = [
            'http://localhost:5030', // Local-Prod Test
            'http://localhost:5031', // Local frontend
            'https://sb3.cvconnect.app', // Development frontend
            'https://owner.cvconnect.app', // Production frontend
            'http://localhost:3010', // Local-Prod Test
            'http://localhost:3011', // Local frontend
            'https://sb1.cvconnect.app', // Development frontend
            'https://admin.cvconnect.app' // Production frontend
        ];

        const corsOptions = {
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            credentials: true, // Allow credentials (e.g., cookies, Authorization headers)
        };


        // Enable CORS to allow requests from the Next.js app (port 3030)
        server.use(cors(corsOptions));

        // Middleware to parse incoming requests with JSON payloads
        server.use(express.json());
        server.use(express.urlencoded({ extended: true }));

        // Use userRoutes for API requests
        server.use('/api/admin', adminRoutes);
        server.use('/api/home-owner', homeOwnerRoutes);
        // server.use('/api/auth', authRoutes);

        // Start the server and listen on port 5030
        server.listen(port, () => {
            console.log(`[SERVER] Ready on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('[SERVER] Failed to start due to database connection error:', err);
    }


// const express = require('express');
// const next = require('next');
// const path = require('path');
// const db = require('./services/db/db.js');  // Ensure this path is correct
// const userRoutes = require('./services/db/userRoutes');
// const cors = require('cors');
// require('dotenv').config();  // Load environment variables from .env

// // Use port 5030 for the Node.js server
// const port = process.env.PORT || 5030;
// const appDir = path.join(__dirname, 'client');  // Path to the Next.js client
// const app = next({ dir: appDir, dev: process.env.NODE_ENV !== 'production' });
// const handle = app.getRequestHandler();  // Default request handler for Next.js

// app.prepare().then(async () => {
//     try {
//         await db.connectToServer();  // Connect to MongoDB
//         console.log('[SERVER] Database connection successful');

//         const server = express();

//         // Enable CORS to allow requests from the Next.js app (port 3030)
//         server.use(cors({ origin: 'http://localhost:3030' }));

//         // Middleware to parse incoming requests with JSON payloads
//         server.use(express.json());
//         server.use(express.urlencoded({ extended: true }));

//         // Use userRoutes for API requests
//         server.use('/api', userRoutes);

//         // Handle all other requests with Next.js
//         server.all('*', (req, res) => {
//             return handle(req, res);
//         });

//         // Start the server and listen on port 5030
//         server.listen(port, () => {
//             console.log(`[SERVER] Ready on http://localhost:${port}`);
//         });
//     } catch (err) {
//         console.error('[SERVER] Failed to start due to database connection error:', err);
//     }
// });
