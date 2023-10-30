const mongoose = require("mongoose");

const OtpPhoneSchema = new mongoose.Schema(
  {
    otpCode: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    createdAt: { type: Date, default: Date.now, index: { expires: 60 } },
  },
  { timestamps: true }
);

const OtpEmailSchema = new mongoose.Schema(
  {
    otpCode: {
      type: String,
    },
    emailAddress: {
      type: String,
    },
    createdAt: { type: Date, default: Date.now, index: { expires: 60 } },
  },
  { timestamps: true }
);

const OtpPhone = mongoose.model("OtpPhoneCollections", OtpPhoneSchema);
const OtpEmail = mongoose.model("OtpEmailCollections", OtpEmailSchema);

module.exports = { OtpPhone, OtpEmail };
