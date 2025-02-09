require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const Web3 = require('web3');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

const BSC_RPC = "https://bsc-dataseed.binance.org/";
const web3 = new Web3(new Web3.providers.HttpProvider(BSC_RPC));

// Google Sheets Setup
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Fetch price data from Google Sheets
async function fetchPricesFromSheet() {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const range = "Sheet1!A:E"; // Adjust range to your sheet's actual layout
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error("No data found in the spreadsheet.");
    }

    // Return the fetched rows (latest price data for comparison)
    return rows;
  } catch (error) {
    console.error("❌ Error fetching prices from Google Sheets:", error);
    return [];
  }
}

// Compare prices and detect arbitrage opportunities
function checkArbitrageOpportunity(data) {
  const arbitrageOpportunities = [];
  data.forEach(row => {
    const [timestamp, tokenIn, tokenOut, pricePancake, priceBakery] = row;
    const pancakePrice = parseFloat(pricePancake);
    const bakeryPrice = parseFloat(priceBakery);

    // Check for arbitrage opportunity
    if (pancakePrice > bakeryPrice) {
      arbitrageOpportunities.push({
        tokenIn,
        tokenOut,
        pricePancake,
        priceBakery,
        arbitrage: 'PancakeSwap > BakerySwap',
        potentialProfit: pancakePrice - bakeryPrice,
      });
    } else if (bakeryPrice > pancakePrice) {
      arbitrageOpportunities.push({
        tokenIn,
        tokenOut,
        pricePancake,
        priceBakery,
        arbitrage: 'BakerySwap > PancakeSwap',
        potentialProfit: bakeryPrice - pancakePrice,
      });
    }
  });

  return arbitrageOpportunities;
}

// Route to check arbitrage opportunities and return results to the user
app.post('/check-arbitrage', async (req, res) => {
  console.log("📩 Received request to check arbitrage...");

  const priceData = await fetchPricesFromSheet();
  if (priceData.length === 0) {
    return res.status(500).json({ error: "No price data available." });
  }

  const arbitrageOpportunities = checkArbitrageOpportunity(priceData);
  
  if (arbitrageOpportunities.length > 0) {
    res.status(200).json({ message: "Arbitrage opportunities found.", opportunities: arbitrageOpportunities });
  } else {
    res.status(200).json({ message: "No arbitrage opportunities found." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
