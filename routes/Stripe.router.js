import { Router } from "express";
import { verifyUserToken } from "../middleware/VerifyUserLogin.middleware.js";
import { addMoney, createPaymentIntent, getWithdrawalSummary, withdrawMoney } from "../controllers/Stripe.controller.js";

const router = Router();

router.route("/add-money").post(addMoney)
router.route("/create-payment-intent").post(createPaymentIntent)
router.route("/withdraw-money").post(verifyUserToken,withdrawMoney)
router.route("/withdraw-money").get(verifyUserToken,getWithdrawalSummary)


export default router;
