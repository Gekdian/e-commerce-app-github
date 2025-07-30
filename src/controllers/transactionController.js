const TransactionModel = require("../models/transactionModel");
const ProductModel = require("../models/productModel");
const CustomerModel = require("../models/customerModel");

const TransactionController = {
  createTransaction: async (req, res) => {
    const { customerId, items } = req.body; // items: [{ productId, quantity }]

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "Customer ID and transaction items are required" });
    }

    try {
      // Validasi customer
      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      let totalAmount = 0;

      // Validasi produk dan stok
      for (const item of items) {
        const product = await ProductModel.findById(item.productId);
        if (!product) {
          return res
            .status(404)
            .json({ message: `Product with ID ${item.productId} not found` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({
            message: `Insufficient stock for product ${product.name}. Available: ${product.stock}`,
          });
        }
        totalAmount += product.price * item.quantity;
      }

      // Buat transaksi utama
      const transactionId = await TransactionModel.createTransaction(
        customerId,
        totalAmount,
        "pending"
      );

      // Masukkan item transaksi & update stok produk
      for (const item of items) {
        const product = await ProductModel.findById(item.productId); // Ambil lagi untuk stok terupdate
        await TransactionModel.addTransactionItem(
          transactionId,
          item.productId,
          item.quantity,
          product.price
        );
        await ProductModel.updateStock(
          item.productId,
          product.stock - item.quantity
        );
      }

      res
        .status(201)
        .json({ message: "Transaction created successfully", transactionId });
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Error creating transaction" });
    }
  },

  getTransactionById: async (req, res) => {
    const { id } = req.params;
    try {
      const rows = await TransactionModel.findById(id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const transaction = {
        id: rows[0].id,
        customer_id: rows[0].customer_id,
        total_amount: rows[0].total_amount,
        status: rows[0].status,
        transaction_date: rows[0].transaction_date,
        items: rows.map((row) => ({
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          price_per_item: row.price_per_item,
        })),
      };

      res.status(200).json(transaction);
    } catch (error) {
      console.error("Error getting transaction by ID:", error);
      res.status(500).json({ message: "Error getting transaction" });
    }
  },

  getTransactionsByCustomerId: async (req, res) => {
    const { customerId } = req.params;
    try {
      const rows = await TransactionModel.findByCustomerId(customerId);
      if (!rows || rows.length === 0) {
        return res
          .status(404)
          .json({ message: "No transactions found for this customer" });
      }

      // Group transactions by transaction id
      const transactionsMap = new Map();

      rows.forEach((row) => {
        if (!transactionsMap.has(row.id)) {
          transactionsMap.set(row.id, {
            id: row.id,
            customer_id: row.customer_id,
            total_amount: row.total_amount,
            status: row.status,
            transaction_date: row.transaction_date,
            items: [],
          });
        }
        transactionsMap.get(row.id).items.push({
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          price_per_item: row.price_per_item,
        });
      });

      res.status(200).json(Array.from(transactionsMap.values()));
    } catch (error) {
      console.error("Error getting transactions by customer ID:", error);
      res.status(500).json({ message: "Error getting transactions" });
    }
  },

  updateTransactionStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ["pending", "completed", "cancelled"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status provided" });
    }
    try {
      const affectedRows = await TransactionModel.updateStatus(id, status);
      if (affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Transaction not found or no changes made" });
      }
      res
        .status(200)
        .json({ message: "Transaction status updated successfully" });
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ message: "Error updating transaction status" });
    }
  },

  deleteTransaction: async (req, res) => {
    const { id } = req.params;
    try {
      const affectedRows = await TransactionModel.delete(id);
      if (affectedRows === 0) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.status(200).json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Error deleting transaction" });
    }
  },

  getAllTransactions: async (req, res) => {
    try {
      const rows = await TransactionModel.getAll();
      if (!rows || rows.length === 0) {
        return res.status(200).json([]);
      }

      const transactionsMap = new Map();

      rows.forEach((row) => {
        if (!transactionsMap.has(row.id)) {
          transactionsMap.set(row.id, {
            id: row.id,
            customer_id: row.customer_id,
            total_amount: row.total_amount,
            status: row.status,
            transaction_date: row.transaction_date,
            items: [],
          });
        }
        transactionsMap.get(row.id).items.push({
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          quantity: row.quantity,
          price_per_item: row.price_per_item,
        });
      });

      res.status(200).json(Array.from(transactionsMap.values()));
    } catch (error) {
      console.error("Error getting all transactions:", error);
      res.status(500).json({ message: "Error getting all transactions" });
    }
  },
};

module.exports = TransactionController;
