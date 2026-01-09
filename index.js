const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// ===== CONFIG =====
const PAGE_TOKEN = "EAAURBVlkFgQBQb3DEWJuvfO6cmWa7rHmXk1lH3AwZBnGeitIMwza07GDtcdVWXuorEaoCZAcJCdfYoaPZB18Nj59iUXi4bOZCeOv85wDoyNEYzZAjdzOr1AoRmXJFyps0saseWgrzXYjfHFntCiVZCjPzKp7eRRgBrDRZA6FZBqDmHfj9Aj6TZCF286kCtVICCtUkd1ZAxZAKPhfcmKGTawERW0ntI9dspqHGmZAV99y";
const VERIFY_TOKEN = "Mamun_X";
const PAGE_ID = "1573931700447250";

// ===== TEMP USER STORE =====
const users = {};

// ===== VERIFY WEBHOOK =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }
  console.warn("Webhook verification failed ❌");
  res.sendStatus(403);
});

// ===== RECEIVE MESSAGE =====
app.post("/webhook", (req, res) => {
  console.log("Webhook hit:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);

  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];
  if (!event || !event.message) {
    console.log("No message event found");
    return;
  }

  console.log("Event detected:", event);

  const senderId = event.sender.id;
  const messageType = event.message?.attachments ? "attachment" : "text";
  const text = event.message.text;
  const attachment = event.message.attachments?.[0];

  if (!users[senderId]) {
    users[senderId] = { step: "name" };
    console.log(`New user ${senderId} started conversation`);
    sendText(senderId,
      "স্বাগতম 👋\nএই বট শুধুমাত্র কাস্টমার সাপোর্টের জন্য।\n\nআপনার নাম বলুন"
    );
    return;
  }

  const user = users[senderId];
  console.log(`User ${senderId} at step: ${user.step}`);

  switch (user.step) {
    case "name":
      user.name = text;
      user.step = "phone";
      sendText(senderId, "আপনার ফোন নাম্বার দিন");
      break;

    case "phone":
      user.phone = text;
      user.step = "location";
      sendText(senderId, "আপনার লোকেশন দিন");
      break;

    case "location":
      user.location = text;
      user.step = "problem";
      sendText(senderId, "আপনার সমস্যাটি লিখুন");
      break;

    case "problem":
      user.problem = text;
      user.step = "screenshot";
      sendText(senderId, "সমস্যার স্ক্রিনশট পাঠান");
      break;

    case "screenshot":
      if (attachment && attachment.type === "image") {
        user.screenshot = attachment.payload.url;
        console.log(`Screenshot received from ${senderId}: ${user.screenshot}`);

        // Send internal summary to Page Inbox
        sendInternalNote(user);

        // Confirm to customer
        sendText(
          senderId,
          "ধন্যবাদ ❤️\nআপনার তথ্য ও স্ক্রিনশট পাওয়া গেছে।\nখুব শীঘ্রই আমাদের কাস্টমার কেয়ার যোগাযোগ করবে।"
        );

        delete users[senderId];
      } else {
        sendText(senderId, "দয়া করে শুধু স্ক্রিনশট (image) পাঠান");
      }
      break;

    default:
      console.log(`Unknown step for user ${senderId}`);
      sendText(senderId, "দয়া করে শুরু করতে আপনার নাম লিখুন");
      users[senderId] = { step: "name" };
      break;
  }
});

// ===== SEND TEXT =====
function sendText(id, text) {
  axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    { recipient: { id }, message: { text } }
  )
  .then(res => console.log("Message sent to", id))
  .catch(err => console.error("Send failed:", err.response?.data));
}

// ===== INTERNAL PAGE NOTE =====
function sendInternalNote(data) {
  const note = `
🔒 INTERNAL SUPPORT NOTE

👤 Name: ${data.name}
📞 Phone: ${data.phone}
📍 Location: ${data.location}

🛠 Problem:
${data.problem}

🖼 Screenshot:
${data.screenshot}

⏱ Auto-collected by bot
`;

  axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    { recipient: { id: PAGE_ID }, message: { text: note } }
  )
  .then(() => console.log("Internal note sent"))
  .catch(err => console.error("Internal note failed:", err.response?.data));
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Facebook Support Bot running on port ${PORT} ✅`);
});
