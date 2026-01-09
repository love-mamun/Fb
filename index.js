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
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ===== RECEIVE MESSAGE =====
app.post("/webhook", (req, res) => {
  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];
  if (!event || !event.message) return res.sendStatus(200);

  const senderId = event.sender.id;
  const text = event.message.text;
  const attachment = event.message.attachments?.[0];

  if (!users[senderId]) {
    users[senderId] = { step: "name" };
    sendText(senderId,
      "স্বাগতম 👋\nএই বট শুধুমাত্র কাস্টমার সাপোর্টের জন্য।\n\nআপনার নাম বলুন"
    );
    return res.sendStatus(200);
  }

  const user = users[senderId];

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
  }

  res.sendStatus(200);
});

// ===== SEND TEXT =====
function sendText(id, text) {
  axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_TOKEN}`,
    {
      recipient: { id },
      message: { text }
    }
  );
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
    {
      recipient: { id: PAGE_ID },
      message: { text: note }
    }
  );
}

// ===== START SERVER =====
app.listen(3000, () => {
  console.log("Facebook Support Bot running...");
});