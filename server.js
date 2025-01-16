const fs = require("fs");
const express = require("express");
const webPush = require("web-push");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 5000;

// In-memory storage for subscriptions
const pushSubscriptions = [];

// Allowed origins for CORS (replace with actual URLs)
const allowedOrigins = [
  "http://localhost:3000",
  "https://localhost:3000",
];

// CORS setup to allow requests from these origins
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Allows cookies to be sent in cross-origin requests
}));

app.use(bodyParser.json()); // Parse incoming JSON requests

// Replace with your VAPID keys
const publicVapidKey = "BKrVB2IR7gv0uKiJTKRPWUiUvEqbyLEU34-WFXq5yxQ94bsxDhVomxJmO7t4nJ1aFyhfocK9mWNQRE9t_x27Zx8";
const privateVapidKey = "JM33zYehY1o1Vol1cUas9Cb-Z0sb6U8WASbA-l5r_dM";

// Set the VAPID keys for web push
webPush.setVapidDetails(
  "mailto:test@example.com", // Your email here
  publicVapidKey,
  privateVapidKey
);

// Subscribe endpoint to handle push notification subscriptions
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  // Validate subscription
  if (!subscription.endpoint || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  pushSubscriptions.push(subscription); // Store subscription in memory

  // Optionally, save subscriptions to a JSON file for persistence
  fs.writeFileSync("pushSubscriptions.json", JSON.stringify(pushSubscriptions, null, 2));

  console.log("New subscription:", subscription);
  res.status(201).json({});
});

// Send push notification endpoint
app.post("/send-push", (req, res) => {
  console.log("send-push");
  const { message, icon, title } = req?.body;

  const notificationPayload = {
    title: title || "Hello!",
    body: message || "This is a push notification.",
    icon: icon || "/logo192.png",
  };

  // Load subscriptions from file or initialize as empty
  let subscriptions = [];
  try {
    const fileContent = fs.readFileSync("pushSubscriptions.json", "utf8");
    if (fileContent) {
      subscriptions = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Error reading subscriptions:", error);
    subscriptions = [];
  }

  const promises = subscriptions.map((subscription, index) => {
    return webPush
      .sendNotification(subscription, JSON.stringify(notificationPayload))
      .catch((err) => {
        if (err.statusCode === 410) {
          // If the subscription is expired or unsubscribed, remove it
          console.log("Subscription expired or unsubscribed, removing it.");
          subscriptions.splice(index, 1);
          fs.writeFileSync("pushSubscriptions.json", JSON.stringify(subscriptions, null, 2));
        }
        console.error("Error sending notification:", err);
      });
  });

  // Wait for all notifications to be sent or failed
  Promise.all(promises)
    .then(() => res.status(200).json({ message: "Push notifications sent!" }))
    .catch((err) => res.status(500).json({ error: "Failed to send push notifications" }));
});

// Start the HTTP server instead of HTTPS
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
