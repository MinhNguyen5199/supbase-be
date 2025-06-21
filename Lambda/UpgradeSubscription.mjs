import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  const user = event.requestContext.authorizer;
  const { newPriceId } = event.body;

  if (!user?.uid) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "User not authenticated." }),
    };
  }

  if (!newPriceId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "newPriceId is required." }),
    };
  }

  try {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.uid)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false }) // This makes it identical
      .limit(1) // This makes it identical
      .maybeSingle();

    const subscriptionId = sub?.stripe_subscription_id;
    if (!subscriptionId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: "No active subscription found to modify.",
        }),
      };
    }

    const currentSubscription = await stripe.subscriptions.retrieve(
      subscriptionId
    );
    const currentPrice = currentSubscription.items.data[0].price;
    const newPrice = await stripe.prices.retrieve(newPriceId);

    const isUpgrade = newPrice.unit_amount > currentPrice.unit_amount;

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      items: [
        {
          id: currentSubscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      // --- THIS IS THE FIX ---
      // For upgrades, create an immediate invoice.
      // For downgrades, do nothing ('none'), which prevents a refund/credit.
      proration_behavior: isUpgrade ? "always_invoice" : "none",
    });

    const message = isUpgrade
      ? "Subscription has been upgraded successfully."
      : "Your plan has been downgraded. The change will take effect at the start of your next billing cycle.";

    return {
      statusCode: 200,
      body: JSON.stringify({ message: message }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message }),
    };
  }
};
