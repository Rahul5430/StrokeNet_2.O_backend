const otpGenerator = require("otp-generator");
const User = require("../models/UserCollection");
const {
  sendNotification,
  validateEmail,
  sendemail,
} = require("../controller/BaseController");
const Centers = require("../models/CentersCollection");
const Hubs = require("../models/HubsCollection");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const signup = async (req, res) => {
  try {
    const data = req.body;
    if (data.first_name == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid First Name" } });
    }
    if (data.last_name == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Last Name" } });
    }
    if (data.email_address == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Email Addresss" } });
    }
    // check for other email validations

    //  Check here for the same email address using Data Base
    const user = await User.findOne({ email_address: data.email_address });
    if (user) {
      return res
        .status(403)
        .json({ data: { message: " Email Address already registered" } });
    }

    if (data.phone_number == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Phone Number" } });
    }
    // check for other Phone Number validations

    if (data.password == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Password" } });
    }
    // check for other Password Validations

    if (data.center_id == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Center Id" } });
    }
    if (data.user_department == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid User Department" } });
    }
    if (data.user_role == "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid User Role" } });
    }

    // Now insert the user info in the insertUser Variable
    const center = await Centers.findOne({ id: data.center_id });
    const insertUser = {
      first_name: data.first_name,
      last_name: data.last_name,
      fullname: data.first_name + " " + data.last_name,
      email_address: data.email_address,
      phone_number: data.phone_number,
      phone_number_verified: false,
      password: data.password,
      center_id: center,
      user_department: data.user_department,
      user_role: data.user_role,
      last_login: data.last_login,
      online_status: data.online_status,
      status: data.status,
      is_hub_user: center.is_hub,
      is_spoke_user: center.is_spoke,
      is_center_user: center.is_center,
    };
    // Now adding insertUser into the dataBase
    const saved_user = await User.insertMany([insertUser]);
    const admin = await User.findOne({ admin: true });
    if (admin && admin.fcm_userid != "") {
      sendNotification(admin.fcm_userid, "userAdded", {
        name: insertUser.fullname,
        phone_number: insertUser.phone_number,
      });
    }
    return res.status(200).send({
      data: {
        message: "User has been Created Successfully",
        userId: saved_user._id,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(403).send({
      data: {
        message: "Something Went Wrong",
      },
    });
  }
};

const login = async (req, res) => {
  const data = req.body;
  // console.log(req.body);
  if (data.email_address == "") {
    return res
      .status(403)
      .json({ data: { message: "Please Enter Valid Email Addresss" } });
  }
  // check for other email validations

  if (data.password == "") {
    return res
      .status(403)
      .json({ data: { message: "Please Enter Valid Password" } });
  }
  // check for other Password Validations

  const user_email = data.email_address;
  const password = data.password;

  // Check in the dataBase if email_address exist and then check for that user if password matches
  //  And then store the User.
  const user = await User.findOne({ email_address: user_email });
  if (user && user.password == password) {
    if (!user.phone_number_verified)
      return res.status(403).send({
        data: {
          message:
            "Your account is pending verification. Once its approved, you will be able to access your account.",
        },
      });

    // Payload data (the data you want to include in the token)
    const payload = {
      userId: user._id,
    };
    const refreshtoken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: "1d" }
    );
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET_KEY, {
      expiresIn: "1h",
    });
    user.token = refreshtoken;
    if (data.fcm_userid != "") {
      user.fcm_userid = data.fcm_userid;
    }
    user.last_login = Date.now();
    await user.save();
    res.cookie("refreshToken", refreshtoken, { httpOnly: true });
    return res.status(200).json({ data: user });
  }
  //  Do further checkings and then return the reqired information
  res.status(403).json({ data: { message: "Invalid Login Credentials" } });
};

const forgotPassword = async (req, res) => {
  try {
    const email_address = req.body.email_address;
    if (validateEmail(email_address)) {
      const user = await User.findOne({ email_address: email_address });
      console.log(user);
      if (user) {
        const otpCode = otpGenerator.generate(6, {
          specialChars: false,
        });
        user.password = otpCode;
        await user.save();
        sendemail(email_address, otpCode);
        res.status(200).send({ data: { message: "OTP Sent to Email" } });
      } else {
        return res
          .status(403)
          .send({ data: { message: "Email Address Is Not Registered" } });
      }
    } else {
      res.status(403).send({ data: { message: "Invalid Email" } });
    }
  } catch (err) {
    console.log(err);
    res.status(403).json({ data: { message: "Unable To Send Password" } });
  }
};

const validateUser = async (req, res) => {
  const userId = req.headers.userid;
  const userToken = req.headers.usertoken;
  try {
    const decoded = jwt.verify(userToken, process.env.REFRESH_TOKEN_SECRET_KEY);
    const userData = await User.findById(userId);
    if (decoded.userId == userId && userData) {
      return res.json({ status: true, userData: userData });
    }
    res.json({ status: false });
  } catch (err) {
    res.json({ status: false });
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  validateUser,
};
