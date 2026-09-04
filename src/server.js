const path = require("path");
const express = require("express");
const session = require("express-session");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const scheduleRoutes = require("./routes/schedule");
const availabilityRoutes = require("./routes/availability");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/availability", availabilityRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(port, () => {
  console.log(`Guidance Office server is running at http://localhost:${port}`);
});
