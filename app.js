const express = require("express");
const app = express();
const http = require("http").createServer(app); // Create an HTTP server
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
  },
});
 // Initialize Socket.io
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const otpGenerator = require("otp-generator");

dotenv.config(); // Load environment variables from .env file

app.use(cors());

app.get("/socket.io/socket.io.js", (req, res) => {
  res.sendFile(__dirname + "/node_modules/socket.io/client-dist/socket.io.js");
});

const mongoURI = process.env.MONGO_URI;
const gmailUsername = process.env.GMAIL_USERNAME;
const gmailPassword = process.env.GMAIL_PASSWORD;

// Check if mongoURI is defined
if (!mongoURI) {
  console.error("MongoDB URI is not defined. Check your .env file.");
  process.exit(1);
}

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 10000,
  })
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB Atlas:", error);
    process.exit(1);
  });

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  otp: String, // Store OTP in the user record
  verified: Boolean, // Add a field to track if the user is verified
  createdAt: { type: Date, default: Date.now }, // Add a timestamp for user registration
});

const User = mongoose.model("User", userSchema);

const ratingSchema = new mongoose.Schema({
  userId: mongoose.Types.ObjectId,
  rating: Number,
  timestamp: { type: Date, default: Date.now },
});

const Rating = mongoose.model("Rating", ratingSchema);

app.use(bodyParser.json());

async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: gmailUsername,
      pass: gmailPassword,
    },
  });

  const mailOptions = {
    from: "backbenchery69@gmail.com",
    to: email,
    subject: "Welcome to Backbenchers",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f4f4f4; padding: 20px;">
        </div>
        <div style="background-color: #fff; padding: 20px;">
          <h1 style="color: #333;">Welcome to Your Website</h1>
          <p>Hello ${email},</p>
          <p>This is Subhadip Hazra.</p>
          <p>Thanks for registering on our website. Explore all our learning videos and don't forget to review our website. Your review is very important to us.</p>
          <p>Here is your OTP: <strong style="font-size: 24px; color: #d41811;">${otp}</strong></p>
          <p>Remember, don't share your personal information with others. If any disturbance occurs or multiple users use the same Gmail account, your account may be banned.</p>
          <p>Thank You!</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP sent to", email);
  } catch (error) {
    console.error("Error sending OTP:", error);
  }
}

// Generate a numeric OTP
function generateOTP() {
  return otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
}

const feedbackSchema = new mongoose.Schema({
  fullName: String,
  email: String,
  mobileNumber: String,
  emailSubject: String,
  message: String, // Added field for user messages
  timestamp: { type: Date, default: Date.now },
});

const Feedback = mongoose.model("Feedback", feedbackSchema);

// Middleware to delete unverified users older than 10 minutes
app.use(async (req, res, next) => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  try {
    await User.deleteMany({ verified: false, createdAt: { $lt: tenMinutesAgo } });
    console.log("Deleted unverified users older than 10 minutes.");
    next();
  } catch (error) {
    console.error("Error deleting unverified users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  console.log("Received registration request:", username, email);

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.json({ success: false, message: "Email already exists." });
    } else {
        const otp = generateOTP();
        await sendOTP(email, otp);
        
        const newUser = new User({ username, email, password, otp, verified: false });
        await newUser.save();
      console.log("User registered successfully:", username);
      res.json({
        success: true,
        message: "Registration successful. OTP sent to your email.",
    });
    }
} catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
}
});

app.post("/verify-otp", async (req, res) => {
    const { otp } = req.body;
    const email = req.query.email;
    
    try {
        const user = await User.findOne({ email });
        
        if (user && user.otp === otp) {
            // Check if the user is verified within 10 minutes
            if (user.verified || (user.createdAt > new Date(Date.now() - 10 * 60 * 1000))) {
                // Mark the user as verified
                user.verified = true;
                user.otp = null; // Clear the OTP
                await user.save();
                
                res.json({ success: true, emailVerified: true });
            } else {
                // User not verified within 10 minutes, delete the user
                await User.deleteOne({ email });
                res.json({ success: false, emailVerified: false, message: "OTP verification expired. Please register again." });
            }
        } else {
            res.json({ success: false, emailVerified: false });
        }
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.post("/check-email", async (req, res) => {
    const { email } = req.body;
    console.log("Login connected..");
  
    try {
      const user = await User.findOne({ email });
      if (user) {
        res.json({ exists: true });
      } else {
        res.json({ exists: false });
      }
    } catch (error) {
      console.error("Check Email Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("Received login request:", email);

  try {
    const user = await User.findOne({ email });
    if (user) {
      if (user.password === password && user.verified) {
        res.json({ success: true });
      } else if (!user.verified) {
        res.json({ success: false, message: "Email not verified" });
      } else {
        res.json({ success: false, message: "Invalid password" });
      }
    } else {
      res.json({ success: false, message: "Email not found" });
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/change-password", async (req, res) => {
  const { username, email, newPassword } = req.body;
  console.log("Wating for verify the user...");

  try {
    const user = await User.findOne({ email, username });

    if (user && user.verified) {
      user.password = newPassword;
      await user.save();

      res.json({ success: true });
    } else {
      res.json({ success: false, message: "User not found or not verified" });
    }
  } catch (error) {
    console.error("Password Change Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/resend-otp", async (req, res) => {
  const email = req.query.email;
  console.log("Otp is resend...");


  try {
    const user = await User.findOne({ email });

    if (user) {
      // Generate a new OTP
      const otp = generateOTP();
      await sendOTP(email, otp);

      // Update the user's OTP in the database
      user.otp = otp;
      await user.save();

      res.json({ success: true });
    } else {
      res.json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post("/send-feedback", async (req, res) => {
  const { message } = req.body;

  try {
    const newFeedback = new Feedback({
      message, // Store user's message in the database
    });

    await newFeedback.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving feedback:", error);
    res.status(500).json({ success: false });
  }
});
app.post("/save-rating", async (req, res) => {
  console.log("User rating is Saved...");
    const { userId, rating } = req.body;
  
    try {
      // Save the user's rating in the database
      const newRating = new Rating({ userId, rating });
      await newRating.save();
      console.log("User feedback is Saved...");
  
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving user rating:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  });
// Create an object to store connected users and their usernames
const connectedUsers = {};

io.on("connection", (socket) => {
  console.log("A user connected");

  let authenticatedUser = null;

  // Handle user authentication
  socket.on("authenticate", async (email) => {
    try {
      const user = await User.findOne({ email });

      if (user) {
        // Store the authenticated user
        authenticatedUser = user;

        // Store the username in the connectedUsers object
        connectedUsers[socket.id] = user.username;

        // Broadcast the updated list of connected users to all clients
        io.emit("user connected", Object.values(connectedUsers));
      } else {
        console.log("User not found in the database");

        // If the user's email is not found in the database, disconnect them
        socket.emit("authentication failed", "User not found in the database.");
        socket.disconnect(true);
      }
    } catch (error) {
      console.error("Error fetching user from the database:", error);
    }
  });

  // Handle chat messages
  socket.on("chat message", (message) => {
    if (authenticatedUser) {
      // User is authenticated, allow them to send messages
      io.emit("chat message", { username: authenticatedUser.username, message });
    } else {
      // User is not authenticated, prevent them from sending messages
      socket.emit("authentication failed", "You are not authenticated.");
    }
  });
  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected");
    // Remove the user from connectedUsers when they disconnect
    delete connectedUsers[socket.id];
    // Broadcast the updated list of connected users to all clients
    io.emit("user connected", Object.values(connectedUsers));
  });
});



const port = process.env.PORT || 5500;
http.listen(port, () => {
  console.log('Server is running on port',port);
});
