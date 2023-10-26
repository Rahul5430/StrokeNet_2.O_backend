const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const connectDb = require("./config/mongoose");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const absolutePath = "public/files/";
    return cb(null, absolutePath);
  },
  filename: async function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    return cb(null, filename);
  },
});
const upload = multer({ storage: storage });
const app = express();
require("dotenv").config();

const cors = require("cors");
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());
app.use(express.urlencoded());

app.use("/", require("./routes/router"));
app.use(express.static('public'))

// using routes
app.post("/upload",upload.single('file'),function (req, res) {
  console.log(req.file);
  const fileName = req.file.filename;
  res.status(200).json(fileName);
});

connectDb();

mongoose.connection.once("open", async () => {
  console.log("Connected To MONGODB");
  app.listen(process.env.PORT, () => {
    console.log("Listening on Port ", process.env.PORT);
  });
});
