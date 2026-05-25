import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import fs from "fs";
import bodyParser from "body-parser";
import SibApiV3Sdk from "@sendinblue/client";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// STRIPE
// ------------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ------------------------------
// BREVO API (PAS SMTP)
// ------------------------------
const brevo = new SibApiV3Sdk.TransactionalEmailsApi();
brevo.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// ------------------------------
// FONCTION : FRAIS DE PORT AUTOMATIQUES
// ------------------------------
function getShippingCost(country) {
  const FR = ["FR"];
  const EU = ["BE","CH","LU","DE","ES","IT","NL","PT","AT","DK","SE","FI","IE"];
  const UK = ["GB"];
  const B3 = ["US","CA","AU","JP"];
  const C4 = ["BR","AR","ZA","CN","IN"];

  if (FR.includes(country)) return 990;
  if (EU.includes(country)) return 1939;
  if (UK.includes(country)) return 2329;
  if (B3.includes(country)) return 2839;
  if (C4.includes(country)) return 3919;

  return 3919; // fallback
}

// ------------------------------
// ROUTE STOCK
// ------------------------------
app.get("/stock", (req, res) => {
  try {
    const raw = fs.readFileSync("./stock.json", "utf8");
    res.json(JSON.parse(raw));
  } catch (err) {
    console.error("Erreur lecture stock.json :", err);
    res.json({ stock: [] });
  }
});

// ------------------------------
// WEBHOOK STRIPE
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
      // RÉCUPÉRATION DU PRODUIT
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
            item.qty = 0;
            fs.writeFileSync(
              "./stock.json",
              JSON.stringify({ stock: stock.stock }, null, 2)
            );
            console.log("✔ Stock mis à jour :", productName);
          }
        } catch (err) {
          console.error("❌ Erreur mise à jour stock :", err);
        }
      }

      // ------------------------------
      // EMAIL CLIENT (BREVO API)
      // ------------------------------
      try {
        await brevo.sendTransacEmail({
          sender: { name: "Zoopoxy", email: "contact@seagullairways.eu" },
          to: [{ email: session.customer_details.email }],
          subject: "Votre commande Zoopoxy est confirmée ✔",
          htmlContent: `
            <h2>Merci pour votre commande !</h2>
            <p>Bonjour ${session.customer_details.name},</p>
            <p>Votre commande a bien été validée.</p>
            <p><strong>Produit :</strong> ${productName}</p>
            <p><strong>Total :</strong> ${(session.amount_total / 100).toFixed(2)} €</p>
            <p><strong>Adresse :</strong><br>
              ${session.customer_details.address.line1}<br>
              ${session.customer_details.address.postal_code} ${session.customer_details.address.city}<br>
              ${session.customer_details.address.country}
            </p>
          `
        });

        console.log("📧 Email client envoyé via API Brevo");
      } catch (err) {
        console.error("❌ Erreur email client (API Brevo) :", err);
      }

      // ------------------------------
      // EMAIL ADMIN
      // ------------------------------
      try {
        await brevo.sendTransacEmail({
          sender: { name: "Zoopoxy", email: "contact@seagullairways.eu" },
          to: [{ email: "contact@seagullairways.eu" }],
          subject: "Nouvelle commande Zoopoxy 🛒",
          htmlContent: `
            <h2>Nouvelle commande reçue</h2>
            <p><strong>Produit :</strong> ${productName}</p>
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

        console.log("📧 Email admin envoyé via API Brevo");
      } catch (err) {
        console.error("❌ Erreur email admin (API Brevo) :", err);
      }
    }

    res.json({ received: true });
  }
);

// ------------------------------
// CHECKOUT STRIPE (sans pays côté front)
// ------------------------------
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { items } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      customer_creation: "always",
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["*"] },

      // ⭐ Pas de frais ici — Stripe collecte l'adresse d'abord
      shipping_options: [],

      line_items: items.map(item => ({
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
// LANCEMENT SERVEUR
// ------------------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur Zoopoxy opérationnel sur le port " + port);
});
