const express = require("express");
const bodyParser = require("body-parser");
const connectDb = require("./config/mongoose");
const mongoose = require("mongoose");
const app = express();
require("dotenv").config();

const cors = require('cors');
app.use(cors());
app.use(express.urlencoded());

// using routes
app.use("/", require("./routes/router"));

connectDb();

mongoose.connection.once("open", async () => {
  console.log("Connected To MONGODB");
  app.listen(process.env.PORT, () => {
    console.log("Listening on Port ", process.env.PORT);
  });
});
