import { Refund } from "../models/Refund.model.js";
import { Transaction } from "../models/Transaction.model.js";
import { User } from "../models/User.model.js";
import { Admin } from "../models/Admin.model.js";
import AddMoney  from "../models/AddMoney.model.js"; 

export const refundTransaction = async (req, res) => {
  try {
      const { transactionId } = req.body;
      const userId = req.user._id;

      if (!transactionId) {
          return res.status(404).json({ success: false, message: "Please provide transaction Id" });
      }

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
          return res.status(404).json({ success: false, message: "Transaction not found" });
      }

      // Check if the user is the sender of the transaction
      if (transaction.senderId.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: "This is not your payment, you cannot refund it" });
      }

      const existingRefund = await Refund.findOne({ transactionId: transaction._id });
      if (existingRefund) {
          return res.status(400).json({ success: false, message: "Transaction has already been refunded", status: "refunded" });
      }

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      if (transaction.createdAt < threeHoursAgo) {
          return res.status(400).json({ success: false, message: "Refund period has expired" });
      }

      const refundAmount = transaction.amount;
      const senderRefundAmount = refundAmount * 0.90; // 90% back to sender
      const receiverAmount = refundAmount * 0.05; // 5% back to receiver
      const adminAmount = refundAmount * 0.05; // 5% to admin

      const sender = await User.findById(transaction.senderId);
      const receiver = await User.findById(transaction.receiverId);

      // Update balances
      sender.balance += senderRefundAmount; // Add 90% back to sender
      receiver.balance -= refundAmount; // Deduct full amount from receiver
      receiver.balance += receiverAmount; // Add 5% back to receiver

      const admin = await Admin.findOne();

      const refund = new Refund({
          transactionId: transaction._id,
          amount: refundAmount,
          senderReceived: senderRefundAmount,
          receiverReceived: receiverAmount,
          adminReceived: adminAmount
      });

      await refund.save();

      if (admin) {
          admin.balance += adminAmount;
          await admin.save();
      }

      // Update transaction status to "refunded"
      transaction.status = "refunded";
      await transaction.save(); // Save the updated transaction

      await sender.save();
      await receiver.save();

      res.status(200).json({ success: true, message: "Refund processed successfully", refund });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};




export const getUserHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Fetch transactions where user is either sender or receiver
    const transactions = await Transaction.find({
      $or: [{ senderId: userId }, { receiverId: userId }]
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'username email') 
      .populate('receiverId', 'username email')
      .lean();

    // Fetch refunds associated with the user's transactions
    const refunds = await Refund.find({
      transactionId: { $in: transactions.map(tx => tx._id) }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch add money records for the user
    const addMoneyRecords = await AddMoney.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // Initialize an object to group history by date
    const groupedHistory = {};

    // Function to format date as 'DD/MM/YYYY'
    const formatDate = (date) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0'); // Months are 0-based
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Process transactions and group them by date
    transactions.forEach(transaction => {
      const date = formatDate(transaction.createdAt);
      if (!groupedHistory[date]) {
        groupedHistory[date] = [];
      }
      groupedHistory[date].push({
        type: 'transaction',
        transactionId: transaction._id,
        amount: transaction.amount,
        sender: {
          username: transaction.senderId.username,
          email: transaction.senderId.email,
        },
        receiver: {
          username: transaction.receiverId.username,
          email: transaction.receiverId.email,
        },
        createdAt: transaction.createdAt,
      });
    });

    // Process refunds and include relevant details
    refunds.forEach(refund => {
      const date = formatDate(refund.createdAt);
      if (!groupedHistory[date]) {
        groupedHistory[date] = [];
      }
      const transaction = transactions.find(tx => tx._id.toString() === refund.transactionId.toString());
      groupedHistory[date].push({
        type: 'refund',
        transactionId: refund.transactionId,
        amount: refund.amount,
        senderReceived: refund.senderReceived,
        receiverReceived: refund.receiverReceived,
        adminReceived: refund.adminReceived,
        createdAt: refund.createdAt,
        sender: transaction ? {
          username: transaction.senderId.username,
          email: transaction.senderId.email,
        } : null,
        receiver: transaction ? {
          username: transaction.receiverId.username,
          email: transaction.receiverId.email,
        } : null,
      });
    });

    // Process add money records and group them by date
    addMoneyRecords.forEach(record => {
      const date = formatDate(record.createdAt);
      if (!groupedHistory[date]) {
        groupedHistory[date] = [];
      }
      groupedHistory[date].push({
        type: 'addMoney',
        amount: record.amount,
        createdAt: record.createdAt,
      });
    });

    // Transform the grouped history object into an array format
    const historyByDate = Object.keys(groupedHistory).map(date => ({
      date,
      allData: groupedHistory[date]
    }));

    // Sort the history by date in descending order
    historyByDate.sort((a, b) => {
      const dateA = new Date(a.date.split('/').reverse().join('/')); // Convert 'DD/MM/YYYY' to 'YYYY/MM/DD'
      const dateB = new Date(b.date.split('/').reverse().join('/'));
      return dateB - dateA;
    });

    // Return the structured response
    res.status(200).json({ success: true, history: historyByDate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

