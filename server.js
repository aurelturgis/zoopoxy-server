import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Transport email
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ------------------------------
// ROUTE D'ACCUEIL
// ------------------------------
app.get("/", (req, res) => {
  res.send("Serveur Zoopoxy opérationnel ✔️");
});

// ------------------------------
// ROUTE STOCK
// ------------------------------
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

// ------------------------------
// CHECKOUT STRIPE
// ------------------------------
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      customer_creation: "always",
      billing_address_collection: "required",

      shipping_address_collection: {
        allowed_countries: [
          "FR",
          "BE", "CH", "LU", "DE", "ES", "IT", "NL", "PT", "AT", "DK", "SE", "FI", "IE",
          "GB",
          "US", "CA", "AU", "JP",
          "BR", "AR", "ZA", "CN", "IN"
        ]
      },

      phone_number_collection: { enabled: true },

      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 990, currency: "eur" },
            display_name: "Livraison France",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 4 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 1939, currency: "eur" },
            display_name: "Livraison Europe",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 2329, currency: "eur" },
            display_name: "Livraison Royaume-Uni",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 4 },
              maximum: { unit: "business_day", value: 8 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 2839, currency: "eur" },
            display_name: "International Zone B3",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 12 }
            }
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 3919, currency: "eur" },
            display_name: "International Zone C4",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 7 },
              maximum: { unit: "business_day", value: 15 }
            }
          }
        }
      ],

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

      success_url: "https://seagullairways.eu/success",
      cancel_url: "https://seagullairways.eu/cancel"
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------
// WEBHOOK STRIPE (LIVE)
// ------------------------------
app.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Erreur signature webhook :", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ------------------------------
  // ✔ Paiement validé
  // ------------------------------
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("✔ Paiement reçu :", session.id);

    // ------------------------------
    // MISE À JOUR DU STOCK
    // ------------------------------
    try {
      const raw = fs.readFileSync("./stock.json", "utf8");
      const stock = JSON.parse(raw);

      const productName = session.display_items?.[0]?.custom?.name;

      if (productName) {
        const item = stock.find(p => p.name === productName);
        if (item) {
          item.qty = 0;
          fs.writeFileSync("./stock.json", JSON.stringify(stock, null, 2));
          console.log("✔ Stock mis à jour :", productName);
        }
      }
    } catch (err) {
      console.error("❌ Erreur mise à jour stock :", err);
    }

    // ------------------------------
    // EMAIL CLIENT
    // ------------------------------
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: session.customer_details.email,
        subject: "Votre commande Zoopoxy est confirmée ✔",
        html: `
          <h2>Merci pour votre commande !</h2>
          <p>Bonjour ${session.customer_details.name},</p>
          <p>Votre commande a bien été validée.</p>
          <p><strong>Produit :</strong> ${session.display_items?.[0]?.custom?.name}</p>
          <p><strong>Total :</strong> ${(session.amount_total / 100).toFixed(2)} €</p>
          <p><strong>Adresse :</strong><br>
            ${session.customer_details.address.line1}<br>
            ${session.customer_details.address.postal_code} ${session.customer_details.address.city}<br>
            ${session.customer_details.address.country}
          </p>
        `
      });
      console.log("📧 Email client envoyé");
    } catch (err) {
      console.error("❌ Erreur email client :", err);
    }

    // ------------------------------
    // EMAIL POUR TOI
    // ------------------------------
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_USER,
        subject: "Nouvelle commande Zoopoxy 🛒",
        html: `
          <h2>Nouvelle commande reçue</h2>
          <p><strong>Produit :</strong> ${session.display_items?.[0]?.custom?.name}</p>
          <p><strong>Total :</strong> ${(session.amount_total / 100).toFixed(2)} €</p>
          <p><strong>Client :</strong> ${session.customer_details.name}</p>
          <p><strong>Email :</strong> ${session.customer_details.email}</p>
          <p><strong>Adresse :</strong><br>
            ${session.customer_details.address.line1}<br>
            ${session.customer_details.address.postal_code} ${session.customer_details.address.city}<br>
            ${session.customer_details.address.country}
          </p>
        `
      });
      console.log("📧 Email admin envoyé");
    } catch (err) {
      console.error("❌ Erreur email admin :", err);
    }
  }

  res.json({ received: true });
});

// ------------------------------
// LANCEMENT DU SERVEUR
// ------------------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur Zoopoxy opérationnel sur le port " + port);
});
