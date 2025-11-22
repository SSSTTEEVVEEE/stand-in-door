import { z } from "zod";

// Sanitize input by removing potentially dangerous characters
const sanitizeString = (str: string) => {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets to prevent HTML injection
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
};

// Custom transform that sanitizes input
const sanitizedString = z.string().transform(sanitizeString);

// Authentication validation schemas
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .regex(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, {
      message: "Email contains invalid characters"
    }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" })
    .regex(/^[\x20-\x7E]+$/, { message: "Password contains invalid characters" }),
});

// Chore validation schema with strict character validation
export const choreSchema = z.object({
  name: sanitizedString
    .pipe(
      z.string()
        .min(1, { message: "Chore name cannot be empty" })
        .max(200, { message: "Chore name must be less than 200 characters" })
        .regex(/^[a-zA-Z0-9\s\-_.,!?()'"/&]+$/, {
          message: "Chore name contains invalid characters"
        })
    ),
  period: z
    .number()
    .int({ message: "Period must be a whole number" })
    .positive({ message: "Period must be positive" })
    .max(1000, { message: "Period must be less than 1000 days" }),
});

// Checklist validation schema with strict character validation
export const checklistSchema = z.object({
  name: sanitizedString
    .pipe(
      z.string()
        .min(1, { message: "Checklist name cannot be empty" })
        .max(200, { message: "Checklist name must be less than 200 characters" })
        .regex(/^[a-zA-Z0-9\s\-_.,!?()'"/&]+$/, {
          message: "Checklist name contains invalid characters"
        })
    ),
});

// Reminder validation schema with strict character validation
export const reminderSchema = z.object({
  text: sanitizedString
    .pipe(
      z.string()
        .min(1, { message: "Reminder text cannot be empty" })
        .max(500, { message: "Reminder text must be less than 500 characters" })
        .regex(/^[a-zA-Z0-9\s\-_.,!?()'"/&\n]+$/, {
          message: "Reminder text contains invalid characters"
        })
    ),
});

// Calendar event validation schema with strict character validation
export const calendarEventSchema = z.object({
  title: sanitizedString
    .pipe(
      z.string()
        .min(1, { message: "Event title cannot be empty" })
        .max(200, { message: "Event title must be less than 200 characters" })
        .regex(/^[a-zA-Z0-9\s\-_.,!?()'"/&]+$/, {
          message: "Event title contains invalid characters"
        })
    ),
  description: z
    .string()
    .max(1000, { message: "Description must be less than 1000 characters" })
    .regex(/^[a-zA-Z0-9\s\-_.,!?()'"/&\n]*$/, {
      message: "Description contains invalid characters"
    })
    .optional()
    .or(z.literal('')),
  date: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
      message: "Invalid date format (YYYY-MM-DD required)"
    }),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
      message: "Invalid time format (HH:MM required)"
    }),
});
