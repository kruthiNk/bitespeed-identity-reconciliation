import { Router, Request, Response } from "express";
import { identifyContact } from "../services/contactService";

export const identifyRouter = Router();

identifyRouter.post("/", async (req: Request, res: Response) => {
  const { email, phoneNumber } = req.body;

  // Validate: at least one of email or phoneNumber must be provided
  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "At least one of email or phoneNumber is required." });
  }

  try {
    const result = await identifyContact(
      email ? String(email) : null,
      phoneNumber ? String(phoneNumber) : null
    );
    return res.status(200).json({ contact: result });
  } catch (error) {
    console.error("Error in /identify:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
