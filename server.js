import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Route d'accueil
app.get("/", (req, res) => {
  res.send("Serveur Zoopoxy opérationnel ✔️");
});

// Exemple route menu
app.get("/menu", (req, res) => {
  res.json({
    items: [
      { id: 1, name: "Alien Zen", price: 120 },
      { id: 2, name: "Cosmic Jelly", price: 90 }
    ]
  });
});

// Exemple route stock
app.get("/stock", (req, res) => {
  res.json({
    stock: [
      { id: 1, qty: 1 },
      { id: 2, qty: 1 }
    ]
  });
});

// Stripe Checkout
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: req.body.items,
      success_url: "https://zoopoxy.com/success",
      cancel_url: "https://zoopoxy.com/cancel"
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Port Render
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur en ligne sur port " + port);
});
