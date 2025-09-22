import Stripe from "stripe";

export function getStripe() {
	if (!process.env.STRIPE_SECRET_KEY) {
		throw new Error("Missing STRIPE_SECRET_KEY");
	}
	return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
}

export function computePlatformFeeCents(grossCents: number) {
	return Math.floor(grossCents * 0.15);
}


