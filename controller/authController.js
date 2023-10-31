const express = require("express");
const User = require("../models/UserCollection");
const {sendNotification} = require("../controller/BaseController");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const signup = async (req, res) => {
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
  const insertUser = {
    first_name: data.first_name,
    last_name: data.last_name,
    fullname: data.first_name + " " + data.last_name,
    email_address: data.email_address,
    phone_number: data.phone_number,
    phone_number_verified: false,
    password: data.password,
    center_id: {
      id: data.center_id,
    },
    user_department: data.user_department,
    user_role: data.user_role,
    last_login: data.last_login,
    online_status: data.online_status,
    status: data.status,
  };

  // Now add this insertUser into the dataBase

  const saved_user = await User.insertMany([insertUser]);

  // Store the user and check if it has been stored or not
  //  if signed up then send an sms to every admin

  // get admin numbers and then iterate over it and send an sms message to all.

  // Now also iterate over the admin emails which can be taken from database and
  //     send an email to every admin to notify a user has been added.

  //  At last send appropriate information
  return res.status(200).send({
    data: {
      message: "User has been Created Successfully",
      userId: saved_user._id,
    },
  });
};

const login = async (req, res) => {
  const data = req.body;
  console.log(data);
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
    if (data.fcm_userid && data.fcm_userid != "" && data.fcm_userid != user.fcm_userid) {
      user.fcm_userid = data.fcm_userid;
      sendNotification(data.fcm_userid);
    }
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
    await user.save();
    res.cookie("refreshToken", refreshtoken, { httpOnly: true });
    return res.status(200).json({ data: user });
  }
  //  Do further checkings and then return the reqired information
  res.status(403).json({ data: { message: "Invalid Login Credentials" } });
};

const forgotPassword = (req, res) => {
  // Implement the forgotPassword Function
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
