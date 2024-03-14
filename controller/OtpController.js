const { OtpEmail, OtpPhone } = require("../models/OtpCollection");
const { sendemail } = require("./BaseController");
const User = require("../models/UserCollection");
const otpGenerator = require("otp-generator");
require("dotenv").config();
const {executeQuery} = require("../config/sqlDatabase");

const sendEmailCode = async (req, res) => {
  const email_address = req.body.email_address;
  const findUserQuery = `SELECT * FROM UserCollection WHERE email_address = ?`;

  try {
    const userData = await executeQuery(findUserQuery, [email_address]);

    if (userData.length > 0) {
      const output = { data: { message: "Email Address Already Registered" } };
      return res.status(403).json(output);
    }

    // Delete existing OTP records for the email address
    const deleteOtpQuery = `DELETE FROM OtpEmailCollections WHERE emailAddress = ?`;
    await executeQuery(deleteOtpQuery, [email_address]);

    // Generate OTP code
    const otpCode = otpGenerator.generate(6, {
      specialChars: false,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
    });

    // Insert new OTP record
    const insertOtpQuery = `INSERT INTO OtpEmailCollections (emailAddress, otpCode) VALUES (?, ?)`;
    await executeQuery(insertOtpQuery, [email_address, otpCode]);

    // Send email with OTP code
    sendemail(email_address, otpCode)
      .then((info) => {
        const output = { data: { message: "email_sent" } };
        res.status(200).json(output);
      })
      .catch((err) => {
        console.log(err);
        const output = { data: { message: "Unable To send Otp" } };
        res.status(403).json(output);
      });
  } catch (error) {
    console.log(error);
    const output = { data: { message: "Error sending email. Please try again later." } };
    res.status(500).json(output);
  }
};


const verifyEmailOtp = async (req, res) => {
  const data = req.body;
  const errors = [];

  if (!data.email_address || data.email_address === "") {
    errors.push("Email Address is required");
  } else if (!data.otp_code || data.otp_code === "") {
    errors.push("OTP is required");
  }

  if (errors.length > 0) {
    const output = { data: { message: errors[0] } };
    res.status(400).json(output);
  } else {
    // Find OTP code for the provided email address
    const findOtpQuery = `SELECT * FROM OtpEmailCollections WHERE emailAddress = ?`;

    try {
      const otpData = await executeQuery(findOtpQuery, [data.email_address]);

      if (otpData.length > 0 && otpData[0].otpCode === data.otp_code) {
        // If OTP matches, delete OTP record and send success response
        const deleteOtpQuery = `DELETE FROM OtpEmailCollections WHERE emailAddress = ?`;
        await executeQuery(deleteOtpQuery, [data.email_address]);

        const output = {
          data: {
            message: "Email verified",
          },
        };
        res.status(200).json(output);
      } else {
        // If OTP is invalid, send error response
        const output = {
          data: {
            message: "Invalid OTP. Please try again.",
          },
        };
        res.status(400).json(output);
      }
    } catch (error) {
      console.log(error);
      const output = {
        data: {
          message: "Error verifying OTP. Please try again later.",
        },
      };
      res.status(500).json(output);
    }
  }
};

const sendOTPCode = async (req, res) => {
  const phone_number = req.body.phone_number;
  
  // Check if the reason is valid
  if (req.body.reason !== "signup" && req.body.reason !== "login") {
    const output = { data: { message: "Invalid Reason" } };
    return res.status(403).json(output);
  }

  // Find user by phone number
  const findUserQuery = `SELECT * FROM UserCollection WHERE phone_number = ?`;
  try {
    const userData = await executeQuery(findUserQuery, [phone_number]);

    if (userData.length > 0) {
      // If user exists and reason is signup, return phone number already registered error
      if (req.body.reason === "signup") {
        const output = { data: { message: "Phone Number Already Registered" } };
        return res.status(403).json(output);
      }
    } else {
      // If user doesn't exist and reason is login, return phone number not registered error
      if (req.body.reason === "login") {
        const output = { data: { message: "Phone Number Not Registered" } };
        return res.status(403).json(output);
      }
    }

    // Send OTP via Twilio
    const otpCode = otpGenerator.generate(6, {
      specialChars: false,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
    });
    // const twilio = require("twilio")(
    //   process.env.TWILIO_ACCOUNT_SID,
    //   process.env.TWILIO_AUTH_TOKEN
    // );
    // twilio.messages
    //   .create({
    //     from: "+19376750028",
    //     body: "Your StrokeNet Verification OTP is " + otpCode + "\nIts valid For Only 1 minute",
    //     to: "+91" + phone_number,
    //   })
    //   .then(
    //     async (message) => {
    //       // If message sent successfully, delete existing OTP records and save new OTP
    //       const deleteOtpQuery = `DELETE FROM OtpPhoneCollections WHERE phoneNumber = ?`;
    //       await executeQuery(deleteOtpQuery, [phone_number]);

          const saveOtpQuery = `INSERT INTO OtpPhoneCollections (phoneNumber, otpCode) VALUES (?, ?)`;
          await executeQuery(saveOtpQuery, [phone_number, otpCode]);

          const output = { data: { message: "sms_sent" } };
          res.status(200).json(output);
      //   },
      //   (err) => {
      //     console.log(err);
      //     const output = { data: { message: "Unable To send Otp" } };
      //     res.status(403).json(output);
      //   }
      // );
  } catch (error) {
    console.log(error);
    const output = { data: { message: "Error sending OTP. Please try again later." } };
    res.status(500).json(output);
  }
};

const verifyOTP = async (req, res) => {
  const data = req.body;
  const errors = [];

  if (!data.phone_number || data.phone_number === "") {
    errors.push("Mobile Number is required");
  } else if (!data.otp_code || data.otp_code === "") {
    errors.push("OTP is required");
  }

  if (errors.length > 0) {
    const output = { data: { message: errors[0] } };
    res.status(400).json(output);
  } else {
    // Find OTP code by phone number
    const findOtpQuery = `SELECT * FROM OtpPhoneCollections WHERE phoneNumber = ?`;
    try {
      const otpData = await executeQuery(findOtpQuery, [data.phone_number]);

      if (otpData.length > 0 && otpData[0].otpCode == data.otp_code) {
        // If OTP is valid, delete OTP record
        const deleteOtpQuery = `DELETE FROM OtpPhoneCollections WHERE phoneNumber = ?`;
        await executeQuery(deleteOtpQuery, [data.phone_number]);

        if (data.reason === "login") {
          // If reason is login, check if user exists
          const findUserQuery = `SELECT * FROM UsersCollection WHERE phone_number = ?`;
          const userData = await executeQuery(findUserQuery, [data.phone_number]);

          if (userData.length === 0) {
            const output = { data: { message: "User Not Exists" } };
            return res.status(400).json(output);
          }

          // Update FCM user ID if provided
          if (data.fcm_userid && data.fcm_userid !== "") {
            const updateFcmQuery = `UPDATE UsersCollection SET fcm_userid = ? WHERE phone_number = ?`;
            await executeQuery(updateFcmQuery, [data.fcm_userid, data.phone_number]);
          }

          const output = userData[0];
          res.status(200).json(output);
        } else {
          const output = { data: { message: "OTP verified" } };
          res.status(200).json(output);
        }
      } else {
        const output = { data: { message: "Invalid OTP. Please try again." } };
        res.status(400).json(output);
      }
    } catch (error) {
      console.log(error);
      const output = { data: { message: "Error verifying OTP. Please try again later." } };
      res.status(500).json(output);
    }
  }
};

module.exports = { sendOTPCode, verifyOTP, sendEmailCode, verifyEmailOtp };
