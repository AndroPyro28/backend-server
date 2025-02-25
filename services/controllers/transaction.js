import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import tinify from "tinify";
import { ObjectId, Decimal128 } from "mongodb";
import { getDb } from "../db/db.js";
import "dotenv/config"; // Lo
const router = express.Router();
import handlebars from "handlebars";
import moment from "moment-timezone";
import { sendMail } from "../email/index.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.put("/update-status/:id", async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  try {
    const database = getDb();
    if (!database) {
      throw new Error("Database connection failed.");
    }

    const transactionCollection = database.collection("transactions");
    const billingCollection = database.collection("statements");
    const userCollection = database.collection("users");

    const transaction = await transactionCollection.findOne({ trn_id: id });

    if (!transaction || !transaction._id) {
      console.error("Transaction not found:", id);
      return res.status(404).json({ error: "Transaction not found." });
    }

    const user = await userCollection.findOne({
      usr_id: transaction?.trn_user_init,
    });

    if (!user || !user._id) {
      console.error("User not found:", id);
      return res.status(404).json({ error: "Transaction not found." });
    }

    const billingStatement = await billingCollection.findOne({
      bll_id: transaction.bill_id,
    });

    const updateFields = {
      trn_status: status,
      trn_reason: reason,
    };

    const result = await transactionCollection.updateOne(
      { trn_id: id },
      { $set: updateFields },
      { upsert: true }
    );

    if (status === "completed") {
      const formattedDate = `${new Date().getFullYear()}-${
        new Date().getMonth() + 1
      }-${new Date().getDate()}`;

      const htmlContent = `
      <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transaction Completed</title>
  <style>
    /* Reset styles */
    body, html {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      line-height: 1.6;
      background-color: #f3f3f3; /* Light grey background */
    }
    /* Main content styles */
    .container {
      width: 100%;
      margin: 0 auto;
      max-width: 600px;
      padding: 20px;
      background-color: #fff; /* White background */
      border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    h1, h2 {
      text-align: center;
      color: black; /* Orange color */
    }
    .appointment-details {
      margin-bottom: 20px;
      border-bottom: 1px solid #ccc; /* Light grey border */
      padding-bottom: 20px;
    }
    .appointment-details p {
      margin: 5px 0;
    }
   
    /* Footer styles */
    footer {
      width: 100%;
      margin: 0 auto;
      text-align: center;
      padding: 20px 0;
      max-width: 640px;
      background-color: #2B2D42; /* Green color */
      border-radius: 0 0 10px 10px;
    }
    footer p {
      margin: 0;
      font-size: 14px;
      color:white; /* White color */
    }
  </style>
</head>
<body>
  <div class="container">

    <h1>Payment Acknowledgement</h1>
    <div class="appointment-details">
      <h2>You have successfully paid your transaction through {{payment_method}}.</h2>
      <p><strong>Date:</strong> ${formattedDate}</p>
      <p><strong>Payment Amount:</strong> ${transaction?.trn_amount}</p>
      <p><strong>Purpose:</strong> ${transaction?.trn_purp}</p>
      <p><strong>Payment Method:</strong> ${transaction?.trn_method}</p>
      <p><strong>Type of payment:</strong> ${transaction?.trn_type}</p>

    </div>
    <p>Thank you! <br/>CV Connect Admin</p>
  </div>
  <footer>
    <p>&copy; 2025 CV Connect. All rights reserved.</p>
  </footer>
</body>
</html>
      `;
      await sendMail({
        email: user.usr_email,
        name: `${user?.usr_first_name} ${user?.usr_last_name}`,
        subject: "Transaction Completed",
        content: htmlContent,
        setText: `SET TEXT: Transaction Completed`
      });
    }
    // Check if all transactions for the bill have been paid
    const transactions = await transactionCollection
      .find({ bill_id: billingStatement.bll_id })
      .toArray();

    const totalAmountOfAllTransactions = transactions.reduce((val, t) => {
      if (t.trn_status === "completed") return t.trn_amount + val;

      return val;
    }, 0);

    if (
      totalAmountOfAllTransactions >= billingStatement.bll_total_paid &&
      totalAmountOfAllTransactions >= billingStatement.bll_total_amt_due
    ) {
      await billingCollection.updateOne(
        { bll_id: billingStatement.bll_id },
        { $set: { transactions_status: "completed" } }
      );
      const villWalletCollection = database.collection("villwallet");
      const villageWallet = await villWalletCollection.findOne();

      const completedTransaction = transactions.find(
        (t) => t.trn_type === "Advanced Payment" && t.trn_status === "completed"
      );
      // If it's an advanced payment, update wallets
      if (
        transactions.length > 0 &&
        completedTransaction?.trn_type === "Advanced Payment"
      ) {
        const walletCollection = database.collection("wallet");

        const homeOwnerWallet = await walletCollection.findOne({
          wall_owner: transaction.trn_user_init,
        });

        if (!homeOwnerWallet) {
          console.error("Wallet not found for update.");
          return res.status(400).json({ error: "Wallet(s) not found." });
        }

        const exceedAmount =
          parseFloat(billingStatement.bll_total_paid) -
          parseFloat(billingStatement.bll_total_amt_due);

        // Update wallet balances using $inc
        await walletCollection.updateOne(
          {
            wall_id: homeOwnerWallet.wall_id,
            wall_owner: homeOwnerWallet.wall_owner,
          },
          { $inc: { wall_bal: exceedAmount } }
        );
      }

      await villWalletCollection.updateOne(
        { villwall_id: villageWallet.villwall_id },
        {
          $inc: {
            villwall_tot_bal: parseFloat(billingStatement.bll_total_amt_due),
          },
        }
      );
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error("Error updating transaction status:", err);
    return res
      .status(500)
      .json({ error: "Failed to update transaction status." });
  }
});

router.get("/", async (req, res) => {
  const { userId } = req.query;
  try {
    const database = getDb();
    if (!database) {
      throw new Error("Database connection failed.");
    }
    const transactionCollection = database.collection("transactions");

    const query = {};

    if (userId) query.trn_user_init = userId;

    const transactions = await transactionCollection.find(query).toArray();
    return res.status(200).json(transactions);
  } catch (err) {
    console.error("Error updating transaction status:", err);
    return res.status(500).json({ error: "*Failed to add a new rate" });
  }
});

export default router;
