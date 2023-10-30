const { OtpEmail, OtpPhone } = require("../models/OtpCollection");
const User = require("../models/UserCollection");
const bcrypt = require("bcrypt");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
require("dotenv").config();

const sendemail = async (email, OTP) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OWNER_EMAIL,
      pass: process.env.OWNER_PASS,
    },
  });
  const mailOptions = {
    from: process.env.OWNER_EMAIL,
    to: email,
    subject: "StrokeNet",
    text: `Your OTP is ${OTP}`,
  };
  var sended = await transporter.sendMail(mailOptions);
  return sended;
};

const sendEmailCode = async (req, res) => {
  const email_address = req.body.email_address;
  const user = await User.findOne({ email_address: email_address });
  if (user) {
    const output = { data: { message: "Email Address Already Registered" } };
    return res.status(403).json(output);
  }
  await OtpEmail.deleteMany({
    emailAddress: email_address,
  });
  const otpCode = otpGenerator.generate(6, {
    specialChars: false,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
  });
  sendemail(email_address, otpCode)
    .then(async (info) => {
      const SavedOtp = await OtpEmail.insertMany([
        {
          emailAddress: email_address,
          otpCode: otpCode,
        },
      ]);
      if (SavedOtp) {
        const output = { data: { message: "email_sent" } };
        res.status(200).json(output);
      } else {
        const output = { data: { message: "Unable To send Otp" } };
        res.status(403).json(output);
      }
    })
    .catch((err) => {
      console.log(err);
      const output = { data: { message: "Unable To send Otp" } };
      res.status(403).json(output);
    });
};

const verifyEmailOtp = async (req, res) => {
  const data = req.body;
  console.log(data);
  const errors = [];

  if (!data.email_address || data.email_address === "") {
    errors.push("Email Address is required");
  } else if (!data.otp_code || data.otp_code === "") {
    errors.push("OTP is required");
  }
  // if (!data.message_api_code || data.message_api_code === "") {
  //   errors.push("Message code is required");
  // }
  if (errors.length > 0) {
    const output = { data: { message: errors[0] } };
    res.status(400).json(output);
  } else {
    const EmailOtpCode = await OtpEmail.findOne({
      emailAddress: data.email_address,
    });
    if (EmailOtpCode && EmailOtpCode.otpCode == data.otp_code) {
      const output = {
        data: {
          message: "Email verified",
        },
      };
      await OtpEmail.deleteOne({
        emailAddress: data.email_address,
      });
      res.status(200).json(output);
    } else {
      const output = {
        data: {
          message: "Invalid OTP. Please try again.",
        },
      };
      res.status(400).json(output);
    }
  }
};

const sendOTPCode = async (req, res) => {
  const phone_number = req.body.phone_number;
  const user = await User.findOne({ phone_number: phone_number });
  if (user) {
    const output = { data: { message: "Phone Number Already Registered" } };
    return res.status(403).json(output);
  }
  const client = require("twilio")(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  const otpCode = otpGenerator.generate(6, {
    specialChars: false,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
  });
  client.messages
    .create({
      from: "+19376750028",
      body:
        "Your StrokeNet Verification OTP is " +
        otpCode +
        "\nIts valid For Only 1 minute",
      to: "+91" + phone_number,
    })
    .then(
      async (message) => {
        await OtpPhone.deleteMany({
          phoneNumber: phone_number,
        });
        const SavedOtp = await OtpPhone.insertMany([
          {
            phoneNumber: phone_number,
            otpCode: otpCode,
          },
        ]);
        if (SavedOtp) {
          const output = { data: { message: "sms_sent" } };
          res.status(200).json(output);
        } else {
          const output = { data: { message: "Unable To send Otp" } };
          res.status(403).json(output);
        }
      },
      (err) => {
        console.log(err);
        const output = { data: { message: "Unable To send Otp" } };
        res.status(403).json(output);
      }
    );
};

const verifyOTP = async (req, res) => {
  const data = req.body;
  console.log(data);
  const errors = [];

  if (!data.phone_number || data.phone_number === "") {
    errors.push("Mobile Number is required");
  } else if (!data.otp_code || data.otp_code === "") {
    errors.push("OTP is required");
  }

  // if (!data.message_api_code || data.message_api_code === "") {
  //   errors.push("Message code is required");
  // }
  if (errors.length > 0) {
    const output = { data: { message: errors[0] } };
    res.status(400).json(output);
  } else {
    const otpCode = await OtpPhone.findOne({ phoneNumber: data.phone_number });
    if (otpCode && otpCode.otpCode == data.otp_code) {
      const output = {
        data: {
          message: "OTP verified",
        },
      };
      await OtpPhone.deleteOne({
        phoneNumber: data.phone_number,
      });
      res.status(200).json(output);
    } else {
      const output = {
        data: {
          message: "Invalid OTP. Please try again.",
        },
      };
      res.status(400).json(output);
    }
  }
};

module.exports = { sendOTPCode, verifyOTP, sendEmailCode, verifyEmailOtp };
