const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDb = require("./config/mongoose");
const mongoose = require("mongoose");
const app = express();
require("dotenv").config();

const cors = require("cors");
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded());

app.use(express.static('public'))
app.use("/", require("./routes/router"));

connectDb();

mongoose.connection.once("open", async () => {
  console.log("Connected To MONGODB");
  app.listen(process.env.PORT, () => {
    console.log("Listening on Port ", process.env.PORT);
  });
});
