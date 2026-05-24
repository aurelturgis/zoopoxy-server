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
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      // ⭐ Collecte complète des infos client
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

      phone_number_collection: {
        enabled: true
      },

      // ⭐ TES 5 FRAIS DE PORT
      shipping_options: [
        // 🇫🇷 France
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

        // 🇪🇺 Europe
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

        // 🇬🇧 Royaume-Uni
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

        // 🌍 International Zone B3
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

        // 🌍 International Zone C4
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

      // ⭐ Produits
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

      // ⭐ URLs de retour
      success_url: "https://seagullairways.eu/success",
      cancel_url: "https://seagullairways.eu/cancel"
    });
// ------------------------------
// LANCER LE SERVEUR
// ------------------------------
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log("Serveur Zoopoxy opérationnel sur le port " + port);
});
    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});
