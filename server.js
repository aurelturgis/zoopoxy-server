import express from "express";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

dotenv.config();

// ------------------------------
// FIX ES MODULES (__dirname)
// ------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------
// EMAIL TRANSPORT
// ------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ------------------------------
// SERVE PUBLIC
// ------------------------------
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

// ------------------------------
// STOCK.JSON
// ------------------------------
const stockPath = path.join(__dirname, "../public/assets/data/stock.json");

function loadStock() {
  return JSON.parse(fs.readFileSync(stockPath, "utf8"));
}

function saveStock(stock) {
  fs.writeFileSync(stockPath, JSON.stringify(stock, null, 2), "utf8");
}

// ------------------------------
// WEBHOOK STRIPE (RAW BODY)
// ------------------------------
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error :", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ------------------------------
    // TRAITEMENT DU PAIEMENT
    // ------------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const items = JSON.parse(session.metadata.items);
      console.log("✔ Paiement validé pour :", items);

      // Charger stock
      const stock = loadStock();

      // Marquer chaque pièce comme vendue
      items.forEach(item => {
        const product = stock.find(p => p.id === item.id);
        if (product) {
          product.stock = 0;
          product.sold = true;
        }
      });

      saveStock(stock);
      console.log("✔ Stock mis à jour");

      // Enregistrement commande
      const commandesPath = path.join(__dirname, "./commandes.json");
      let commandes = [];

      try {
        commandes = JSON.parse(fs.readFileSync(commandesPath, "utf8"));
      } catch (err) {
        console.error("⚠ commandes.json introuvable, création d'un nouveau fichier.");
      }

      const nouvelleCommande = {
        id_stripe: session.id,
        items: items,
        amount_total: session.amount_total,
        currency: session.currency,
        email: session.customer_details.email,
        name: session.customer_details.name,
        address: session.customer_details.address,
        date: new Date().toISOString()
      };

      commandes.push(nouvelleCommande);
      fs.writeFileSync(commandesPath, JSON.stringify(commandes, null, 2));

      console.log("✔ Commande enregistrée");

      // Email client
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: session.customer_details.email,
        subject: "Votre commande est confirmée ✔",
        html: `
          <h2>Merci pour votre commande !</h2>
          <p>Bonjour ${session.customer_details.name},</p>
          <p>Votre commande est confirmée.</p>
          <p>Total payé : <strong>${(session.amount_total / 100).toFixed(2)} €</strong></p>
        `
      });

      // Email interne
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_USER,
        subject: "Nouvelle commande reçue 🛒",
        html: `
          <h2>Nouvelle commande</h2>
          <p>Produits : <strong>${items.map(i => i.id).join(", ")}</strong></p>
          <p>Total : ${(session.amount_total / 100).toFixed(2)} €</p>
          <p>Email client : ${session.customer_details.email}</p>
        `
      });

      console.log("📧 Emails envoyés");
    }

    res.json({ received: true });
  }
);

// ------------------------------
// MIDDLEWARE JSON (APRÈS WEBHOOK)
// ------------------------------
app.use(express.json());

// ------------------------------
// ROUTE : CRÉATION SESSION STRIPE
// ------------------------------
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { items } = req.body;

    const stock = loadStock();

    const line_items = items.map(item => {
      const product = stock.find(p => p.id === item.id);
      return {
        price_data: {
          currency: "eur",
          product_data: { name: product.name },
          unit_amount: product.price
        },
        quantity: 1
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["FR", "BE", "CH", "LU", "DE", "ES", "IT", "NL", "PT"]
      },
      line_items,
      metadata: {
        items: JSON.stringify(items)
      },
      success_url: `${process.env.BASE_URL}/success.html`,
      cancel_url: `${process.env.BASE_URL}/cancel.html`
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Erreur Stripe :", err);
    res.status(500).json({ error: "Erreur création session Stripe" });
  }
});

// ------------------------------
// LANCER LE SERVEUR (RENDER)
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Serveur en ligne sur port " + PORT);
});