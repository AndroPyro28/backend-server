import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import tinify from "tinify";
import { ObjectId, Decimal128 } from "mongodb";
import { getDb } from "../db/db.js";
import "dotenv/config"; // Lo
const router = express.Router();
router.put("/update-status/:id", async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  console.log({ status, reason });
  try {
    const database = getDb();
    if (!database) {
      throw new Error("Database connection failed.");
    }
    const transactionCollection = database.collection("transactions");
    const billingCollection = database.collection("statements");

    const transaction = await transactionCollection.findOne({ trn_id: id });

    const billingStatement = await billingCollection.findOne({
      bll_id: transaction.bill_id,
    });

    if (!transaction || !transaction._id) {
      console.error("transaction not found:", id);
      return res.status(404).json({ error: "transaction not found." });
    }

    const updateFields = {
      trn_status: status,
      trn_reason: reason,
    };

    const result = await transactionCollection.updateOne(
      { trn_id: id },
      { $set: updateFields },
      { upsert: true }
    );

    // and finally check if all the transactions with in that bill has been paid

    const transactions = await transactionCollection
      .find({ bill_id: billingStatement.bll_id })
      .toArray();

    const totalAmountOfAllTransactions = transactions.reduce(
      (val, t) => t.trn_amount + val,
      0
    );

    if (
      totalAmountOfAllTransactions >= billingStatement.bll_total_paid &&
      totalAmountOfAllTransactions >= billingStatement.bll_total_amt_due
    ) {
      await billingCollection.updateOne(
        { bll_id: billingStatement.bll_id },
        {
          $set: {
            transactions_status: "completed",
          },
        }
      );
    }
    console.log("transactions", transactions, totalAmountOfAllTransactions);

    return res.status(200).json({ result });
  } catch (err) {
    console.error("Error updating transaction status:", err);
    return res.status(500).json({ error: "*Failed to add a new rate" });
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
