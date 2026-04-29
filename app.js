// Professional Shopify + Shiprocket Pincode Checker Backend
// Production-Ready Node.js + Express + Axios Version

// Install Required Packages:
// npm install express axios dotenv cors

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// ===============================
// Environment Variables
// ===============================

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
const PICKUP_POSTCODE = process.env.PICKUP_POSTCODE || "641001";
const DEFAULT_WEIGHT = process.env.DEFAULT_WEIGHT || 0.5;

// ===============================
// Shiprocket Token Cache
// ===============================

let shiprocketToken = null;
let tokenCreatedAt = null;

async function generateShiprocketToken() {
  try {
    const response = await axios.post(
      "https://apiv2.shiprocket.in/v1/external/auth/login",
      {
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD
      }
    );

    shiprocketToken = response.data.token;
    tokenCreatedAt = new Date();

    console.log("Shiprocket token generated successfully");

    return shiprocketToken;
  } catch (error) {
    console.error(
      "Shiprocket token generation failed:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getValidToken() {
  const tokenExpired =
    !tokenCreatedAt ||
    (new Date() - tokenCreatedAt) / (1000 * 60) > 240;

  if (!shiprocketToken || tokenExpired) {
    await generateShiprocketToken();
  }

  return shiprocketToken;
}

// ===============================
// Health Check Route
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "Professional Shiprocket Pincode Checker",
    status: "running"
  });
});

// ===============================
// Pincode Checker Route
// Shopify App Proxy uses this
// ===============================

app.post("/apps/pincode-check", async (req, res) => {
  try {
    const {
      pincode,
      cod = 1,
      weight = DEFAULT_WEIGHT
    } = req.body;

    // Validation

    if (!pincode || String(pincode).length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 6-digit pincode"
      });
    }

    // Get Shiprocket Token

    const token = await getValidToken();

    // Call Shiprocket Serviceability API

    const response = await axios.get(
      "https://apiv2.shiprocket.in/v1/external/courier/serviceability/",
      {
        params: {
          pickup_postcode: PICKUP_POSTCODE,
          delivery_postcode: pincode,
          cod: cod,
          weight: weight
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const couriers =
      response.data?.data?.available_courier_companies || [];

    // Delivery Available

    if (couriers.length > 0) {
      const bestCourier = couriers[0];

      return res.json({
        success: true,
        available: true,
        cod_available: true,
        free_shipping: true,
        courier_name: bestCourier.courier_name || "Standard Courier",
        estimated_days:
          bestCourier.estimated_delivery_days || "3–5",
        message: "Delivery available"
      });
    }

    // Delivery Not Available

    return res.json({
      success: true,
      available: false,
      message: "Delivery is not available for this pincode"
    });

  } catch (error) {
    console.error(
      "Pincode serviceability check failed:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to check delivery availability"
    });
  }
});

// ===============================
// Start Server
// ===============================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
