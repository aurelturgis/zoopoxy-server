import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Route d'accueil
app.get("/", (req, res) => {
  res.send("Serveur Zoopoxy opérationnel ✔️");
});

// Route STOCK — lit stock.json
app.get("/stock", (req, res) => {
  try {
    const raw = fs.readFileSync("./stock.json", "utf8");
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error("Erreur lecture stock.json :", err);
    res.json({ stock: [] });
  }
});

// Stripe Checkout
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: req.body.items.map(item => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: item.name,
            images: [item.image]
          },
          unit_amount: item.price
        },
        quantity: 1
      })),
      success_url: "https://zoopoxy.com/success",
      cancel_url: "https://zoopoxy.com/cancel"
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});

// Port Render
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur en ligne sur port " + port);
});
