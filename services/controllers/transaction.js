import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import tinify from "tinify";
import { ObjectId, Decimal128 } from "mongodb";
import { getDb } from "../db/db.js";
import "dotenv/config"; // Lo
const router = express.Router();
import handlebars from "handlebars"
import moment from "moment-timezone";
import sendMail from "../../lib/smtp.js"
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

    const user = await userCollection.findOne({ usr_id: transaction?.trn_user_init });

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

    const transactions = await transactionCollection
      .find({ bill_id: billingStatement.bll_id })
      .toArray();

    const totalAmountOfAllTransactions = transactions.reduce(
      (val, t) => { 
        if (t.trn_status === "completed") return t.trn_amount + val

        return val;
      },
      0
    );

    if(status === "completed") {
      const formattedDate = `${new Date().getFullYear()}-${(new Date().getMonth() + 1)}-${new Date().getDate()}`;
      
      const source = fs.readFileSync(`${__dirname}/../../public/template/transaction-approved.html`, 'utf-8').toString()
          const template = handlebars.compile(source)
          const replacement = {
            date: formattedDate,
            concern: "Transaction Completed",
            amount: transaction?.trn_amount,
            payment_method: transaction?.trn_method,
            purpose: transaction?.trn_purp,
            type: transaction?.trn_type
          }
          const reminderContent = template(replacement);
          sendMail({ content:reminderContent, subject: "Transaction Completed", emailTo: user.usr_email });

          let newPaidBreakdown = { ...billingStatement.bll_paid_breakdown };
          let newTotalPaid = (parseFloat(billingStatement.bll_total_paid) || 0) + transaction?.trn_amount;
          if (transaction?.trn_purp === "Water Bill") {
            newPaidBreakdown.water = (billingStatement.bll_paid_breakdown?.water || 0) + transaction?.trn_amount;
            } else if (transaction?.trn_purp === "HOA Maintenance Fees") {
                newPaidBreakdown.hoa = (billingStatement.bll_paid_breakdown?.hoa || 0) + transaction?.trn_amount;
            } else if (transaction?.trn_purp === "Garbage") {
                newPaidBreakdown.garbage = (billingStatement.bll_paid_breakdown?.garbage || 0) + transaction?.trn_amount;
            } else if (transaction?.trn_purp === "All") {
            // Get total remaining balance per category
            const remainingWater = billingStatement.bll_water_charges - (billingStatement.bll_paid_breakdown?.water || 0);
            const remainingHOA = billingStatement.bll_hoamaint_fee - (billingStatement.bll_paid_breakdown?.hoa || 0);
            const remainingGarbage = billingStatement.bll_garb_charges - (billingStatement.bll_paid_breakdown?.garbage || 0);
        
            // Calculate total remaining balance
            const totalRemaining = remainingWater + remainingHOA + remainingGarbage;
        
            if (totalRemaining > 0) {
                // Calculate proportional payments
                const waterShare = parseFloat((remainingWater / totalRemaining) * transaction?.trn_amount).toFixed(2);
                const hoaShare = parseFloat((remainingHOA / totalRemaining) * transaction?.trn_amount).toFixed(2);
                const garbageShare = parseFloat((remainingGarbage / totalRemaining) * transaction?.trn_amount).toFixed(2);
        
                // Add to existing payments, ensuring no overpayment
                newPaidBreakdown.water = (billingStatement.bll_paid_breakdown?.water || 0) + Math.min(waterShare, remainingWater);
                newPaidBreakdown.hoa = (billingStatement.bll_paid_breakdown?.hoa || 0) + Math.min(hoaShare, remainingHOA);
                newPaidBreakdown.garbage = (billingStatement.bll_paid_breakdown?.garbage || 0) + Math.min(garbageShare, remainingGarbage);
            }
        }
      
          const isWaterPaid = newPaidBreakdown.water >= billingStatement.bll_water_charges;
          const isHoaPaid = newPaidBreakdown.hoa >= billingStatement.bll_hoamaint_fee;
          const isGarbagePaid = newPaidBreakdown.garbage >= billingStatement.bll_garb_charges;
      
          const newPayStat =
            isWaterPaid &&
            isHoaPaid &&
            isGarbagePaid &&
            newTotalPaid >= parseFloat(billingStatement.bll_total_amt_due)
              ? "paid"
              : "pending";
      
    await billingCollection.updateOne(
      { bll_id: billingStatement.bll_id },
      {
        $set: {
          bll_total_paid: newTotalPaid.toFixed(2),
          bll_pay_stat: newPayStat,
          bll_paid_breakdown: newPaidBreakdown,
          transactions_status:
           (( newPayStat == "paid") &&
           ( totalAmountOfAllTransactions >= billingStatement.bll_total_paid &&
            totalAmountOfAllTransactions >= billingStatement.bll_total_amt_due))
              ? "completed"
              : "pending",
        },
      },
      { upsert: true }
    );

    const villWalletCollection = database.collection("villwallet");
    const villageWallet = await villWalletCollection.findOne();


    let transactionID;
    let transactionExists;
    do {
      transactionID = "CVVWT" + Math.random().toString(36).substring(2, 12);
      transactionExists = villageWallet?.villwall_trn_hist?.some(
        (trn) => trn.villwall_trn_id === transactionID
      );
    } while (transactionExists);

        const user_transaction = {
      villwall_trn_id: transactionID,
      villwall_trn_type: "collect",
      villwall_trn_created_at: new Date(),
      villwall_trn_amt: parseFloat(transaction?.trn_amount), // Ensure amount is a float
      villwall_trn_link: user.usr_id,
      villwall_trn_description: `Made by ${user?.usr_first_name} ${user?.usr_last_name}`
    };
    await villWalletCollection.updateOne(
      { villwall_id: villageWallet.villwall_id },
          { 
            $inc: { villwall_tot_bal: parseFloat(transaction?.trn_amount) },
            $push: { villwall_trn_hist: user_transaction },
         }
    );
    }

    
    if(status === "rejected") {
      const source = fs.readFileSync(`${__dirname}/../../public/template/transaction-rejected.html`, 'utf-8').toString()
      const template = handlebars.compile(source)
      const replacement = {
        id: transaction?.trn_id,
        reason,
      }
      const reminderContent = template(replacement);
      sendMail({ content:reminderContent, subject: "Transaction Rejected", emailTo: user.usr_email });
    }
    // Check if all transactions for the bill have been paid
    

    if (
      totalAmountOfAllTransactions >= billingStatement.bll_total_paid &&
      totalAmountOfAllTransactions >= billingStatement.bll_total_amt_due
    ) {
      await billingCollection.updateOne(
        { bll_id: billingStatement.bll_id },
        { $set: { transactions_status: "completed" } }
      );

      const completedTransaction = transactions.find(t => t.trn_type === "Advanced Payment" && t.trn_status === "completed")
      // If it's an advanced payment, update wallets
      if (transactions.length > 0 && completedTransaction?.trn_type === "Advanced Payment") {
        const walletCollection = database.collection("wallet");

        const homeOwnerWallet = await walletCollection.findOne({ wall_owner: transaction.trn_user_init });

        if (!homeOwnerWallet) {
          console.error("Wallet not found for update.");
          return res.status(400).json({ error: "Wallet(s) not found." });
        }

        const exceedAmount = parseFloat(billingStatement.bll_total_paid) - parseFloat(billingStatement.bll_total_amt_due);
        
        // Update wallet balances using $inc
        await walletCollection.updateOne(
          { wall_id: homeOwnerWallet.wall_id, wall_owner: homeOwnerWallet.wall_owner },
          { $inc: { wall_bal: exceedAmount } }
        );
      }
    }

    return res.status(200).json({ result });
  } catch (err) {
    console.error("Error updating transaction status:", err);
    return res.status(500).json({ error: "Failed to update transaction status." });
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
