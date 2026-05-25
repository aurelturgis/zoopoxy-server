import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import fs from "fs";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());

// ⚠️ IMPORTANT : NE PAS mettre express.json() ici
// Stripe a besoin du RAW BODY pour vérifier la signature

// ------------------------------
// STRIPE
// ------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------
// EMAIL (IONOS)
// ------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
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
// WEBHOOK STRIPE (RAW BODY)
// ------------------------------
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
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
      console.error("❌ Erreur signature webhook :", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      console.log("✔ Paiement reçu :", session.id);

      // ------------------------------
      // RÉCUPÉRATION DES LINE ITEMS
      // ------------------------------
      let productName = null;
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 1 }
        );
        if (lineItems.data.length > 0) {
          productName = lineItems.data[0].description;
        }
      } catch (err) {
        console.error("❌ Erreur récupération line_items :", err);
      }

      // ------------------------------
      // MISE À JOUR DU STOCK
      // ------------------------------
      if (productName) {
        try {
          const raw = fs.readFileSync("./stock.json", "utf8");
          const stock = JSON.parse(raw);

          const item = stock.stock.find((p) => p.name === productName);
          if (item) {
            item.qty = 0; // pièce unique → vendu
            fs.writeFileSync("./stock.json", JSON.stringify({ stock: stock.stock }, null, 2));
            console.log("✔ Stock mis à jour :", productName);
          } else {
            console.warn("⚠ Produit non trouvé dans stock.json :", productName);
          }
        } catch (err) {
          console.error("❌ Erreur mise à jour stock :", err);
        }
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
            <p><strong>Produit :</strong> ${productName}</p>
            <p><strong>Total :</strong> ${(session.amount_total / 100).toFixed(
              2
            )} €</p>
            <p><strong>Adresse :</strong><br>
              ${session.customer_details.address.line1}<br>
              ${session.customer_details.address.postal_code} ${
            session.customer_details.address.city
          }<br>
              ${session.customer_details.address.country}
            </p>
          `,
        });
        console.log("📧 Email client envoyé");
      } catch (err) {
        console.error("❌ Erreur email client :", err);
      }

      // ------------------------------
      // EMAIL ADMIN
      // ------------------------------
      try {
        await transporter.sendMail({
          from: process.env.MAIL_FROM,
          to: process.env.MAIL_USER,
          subject: "Nouvelle commande Zoopoxy 🛒",
          html: `
            <h2>Nouvelle commande reçue</h2>
            <p><strong>Produit :</strong> ${productName}</p>
            <p><strong>Total :</strong> ${(session.amount_total / 100).toFixed(
              2
            )} €</p>
            <p><strong>Client :</strong> ${session.customer_details.name}</p>
            <p><strong>Email :</strong> ${session.customer_details.email}</p>
            <p><strong>Adresse :</strong><br>
              ${session.customer_details.address.line1}<br>
              ${session.customer_details.address.postal_code} ${
            session.customer_details.address.city
          }<br>
              ${session.customer_details.address.country}
            </p>
          `,
        });
        console.log("📧 Email admin envoyé");
      } catch (err) {
        console.error("❌ Erreur email admin :", err);
      }
    }

    res.json({ received: true });
  }
);

// ------------------------------
// ⚠️ IMPORTANT : JSON APRÈS LE WEBHOOK
// ------------------------------
app.use(express.json());

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
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 1939, currency: "eur" },
            display_name: "Livraison Europe",
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 2329, currency: "eur" },
            display_name: "Livraison Royaume-Uni",
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 2839, currency: "eur" },
            display_name: "International Zone B3",
          }
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 3919, currency: "eur" },
            display_name: "International Zone C4",
          }
        }
      ],

      line_items: req.body.items.map(item => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: item.name,
            images: [`https://seagullairways.eu/${item.image}`]
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
// LANCEMENT DU SERVEUR
// ------------------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur Zoopoxy opérationnel sur le port " + port);
});
