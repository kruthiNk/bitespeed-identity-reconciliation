import { PrismaClient, Contact } from "@prisma/client";

const prisma = new PrismaClient();

interface ContactResponse {
  primaryContatctId: number; // note: intentional typo to match spec
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

/**
 * Given email and/or phoneNumber, find or create the consolidated contact group.
 *
 * Logic:
 * 1. Find all existing contacts that match the given email OR phoneNumber.
 * 2. If none found → create a new primary contact and return it.
 * 3. If matches found:
 *    a. Collect all linked groups (walk up to primary for each match).
 *    b. If there are multiple distinct primary contacts, merge them:
 *       - The oldest (earliest createdAt) stays primary.
 *       - All others become secondary (linkedId → oldest primary).
 *    c. If the incoming request has new info (email/phone not in group) → create secondary contact.
 * 4. Return the consolidated response.
 */
export async function identifyContact(
  email: string | null,
  phoneNumber: string | null
): Promise<ContactResponse> {
  // Step 1: Find all contacts matching email or phoneNumber
  const matchingContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : []),
      ],
    },
  });

  // Step 2: No matches → create new primary contact
  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "primary",
        linkedId: null,
      },
    });
    return buildResponse(newContact, []);
  }

  // Step 3: Find all primary contacts for the matching group(s)
  // For each matched contact, find its root primary
  const primaryIds = new Set<number>();

  for (const contact of matchingContacts) {
    if (contact.linkPrecedence === "primary") {
      primaryIds.add(contact.id);
    } else if (contact.linkedId) {
      primaryIds.add(contact.linkedId);
    }
  }

  // Fetch all primary contacts
  const primaryContacts = await prisma.contact.findMany({
    where: {
      id: { in: Array.from(primaryIds) },
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  // The true primary is the oldest one
  const truePrimary = primaryContacts[0];

  // Step 3b: If multiple primaries exist, merge them → make newer ones secondary
  if (primaryContacts.length > 1) {
    const toMerge = primaryContacts.slice(1); // all except the oldest
    for (const p of toMerge) {
      // Update this contact to be secondary
      await prisma.contact.update({
        where: { id: p.id },
        data: {
          linkPrecedence: "secondary",
          linkedId: truePrimary.id,
          updatedAt: new Date(),
        },
      });
      // Also re-link any contacts that were pointing to the old primary
      await prisma.contact.updateMany({
        where: {
          linkedId: p.id,
          deletedAt: null,
        },
        data: {
          linkedId: truePrimary.id,
        },
      });
    }
  }

  // Step 4: Fetch all secondaries under truePrimary
  const allSecondaries = await prisma.contact.findMany({
    where: {
      linkedId: truePrimary.id,
      deletedAt: null,
    },
  });

  const allContacts = [truePrimary, ...allSecondaries];

  // Step 5: Check if incoming info is already covered
  const allEmails = new Set(allContacts.map((c) => c.email).filter(Boolean) as string[]);
  const allPhones = new Set(allContacts.map((c) => c.phoneNumber).filter(Boolean) as string[]);

  const isNewEmail = email && !allEmails.has(email);
  const isNewPhone = phoneNumber && !allPhones.has(phoneNumber);

  // Create secondary contact only if there's genuinely new info
  if (isNewEmail || isNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkedId: truePrimary.id,
        linkPrecedence: "secondary",
      },
    });
    allSecondaries.push(newSecondary);
    if (email) allEmails.add(email);
    if (phoneNumber) allPhones.add(phoneNumber);
  }

  return buildResponse(truePrimary, allSecondaries);
}

function buildResponse(primary: Contact, secondaries: Contact[]): ContactResponse {
  // Collect emails: primary first, then secondary (deduplicated, no nulls)
  const emails: string[] = [];
  if (primary.email) emails.push(primary.email);
  for (const s of secondaries) {
    if (s.email && !emails.includes(s.email)) emails.push(s.email);
  }

  // Collect phone numbers: primary first, then secondary (deduplicated, no nulls)
  const phoneNumbers: string[] = [];
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);
  for (const s of secondaries) {
    if (s.phoneNumber && !phoneNumbers.includes(s.phoneNumber)) phoneNumbers.push(s.phoneNumber);
  }

  return {
    primaryContatctId: primary.id,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaries.map((s) => s.id),
  };
}
