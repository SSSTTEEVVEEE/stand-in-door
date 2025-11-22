import { z } from "zod";

// Authentication validation schemas
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(128, { message: "Password must be less than 128 characters" }),
});

// Chore validation schema
export const choreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Chore name cannot be empty" })
    .max(200, { message: "Chore name must be less than 200 characters" }),
  period: z
    .number()
    .positive({ message: "Period must be positive" })
    .max(1000, { message: "Period must be less than 1000 days" }),
});

// Checklist validation schema
export const checklistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Checklist name cannot be empty" })
    .max(200, { message: "Checklist name must be less than 200 characters" }),
});

// Reminder validation schema
export const reminderSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, { message: "Reminder text cannot be empty" })
    .max(500, { message: "Reminder text must be less than 500 characters" }),
});

// Calendar event validation schema
export const calendarEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Event title cannot be empty" })
    .max(200, { message: "Event title must be less than 200 characters" }),
  description: z
    .string()
    .max(1000, { message: "Description must be less than 1000 characters" })
    .optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date format" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: "Invalid time format" }),
});
