app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      // ⭐ Collecte complète des infos client
      customer_creation: "always",
      billing_address_collection: "required",

      shipping_address_collection: {
        allowed_countries: ["FR", "BE", "CH", "LU"]
      },

      phone_number_collection: {
        enabled: true
      },

      // ⭐ Frais de port (exemple : 15€)
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: 1500, // 15€
              currency: "eur"
            },
            display_name: "Livraison standard",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 5 }
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

    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Stripe :", error);
    res.status(500).json({ error: error.message });
  }
});
