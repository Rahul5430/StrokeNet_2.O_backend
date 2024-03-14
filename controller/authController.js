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
const { executeQuery } = require("../config/sqlDatabase");
const { v4: uuidv4 } = require("uuid");

const signup = async (req, res) => {
  try {
    const data = req.body;
    if (data.first_name === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid First Name" } });
    }
    if (data.last_name === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Last Name" } });
    }
    if (data.email_address === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Email Address" } });
    }

    // Check if email already exists in the database
    const [existingUser] = await executeQuery(
      "SELECT * FROM UserCollection WHERE email_address = ?",
      [data.email_address]
    );
    if (existingUser) {
      return res
        .status(403)
        .json({ data: { message: "Email Address already registered" } });
    }

    if (data.phone_number === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Phone Number" } });
    }

    // Additional validation for phone number and password can be added here

    if (data.center_id === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid Center Id" } });
    }
    if (data.user_department === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid User Department" } });
    }
    if (data.user_role === "") {
      return res
        .status(403)
        .json({ data: { message: "Please Enter Valid User Role" } });
    }

    // Retrieve center information based on center_id
    const [center] = await executeQuery(
      "SELECT * FROM CentersCollection WHERE id = ?",
      [data.center_id]
    );
    if (!center) {
      return res.status(403).json({ data: { message: "Invalid Center Id" } });
    }

    // Generate a unique ID for the user
    const userId = uuidv4();

    // Insert new user into the database
    const insertUserQuery = `
      INSERT INTO UserCollection (
        id,
        first_name,
        last_name,
        fullname,
        email_address,
        password,
        phone_number,
        phone_number_verified,
        user_department,
        user_role,
        center_id,
        status,
        is_hub_user,
        is_spoke_user,
        is_center_user
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const insertUserData = [
      userId,
      data.first_name,
      data.last_name,
      `${data.first_name} ${data.last_name}`,
      data.email_address,
      data.password,
      data.phone_number,
      false, // Assuming phone_number_verified starts as false
      data.user_department,
      data.user_role,
      data.center_id,
      "active", // Assuming status is optional
      !!center.is_hub, // Assuming is_hub_user, is_spoke_user, and is_center_user are optional
      !!center.is_spoke,
      !!center.is_center,
    ];

    await executeQuery(insertUserQuery, insertUserData);

    return res.status(200).json({
      data: {
        message: "User has been Created Successfully",
        userId: userId,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ data: { message: "Something Went Wrong" } });
  }
};

const login = async (req, res) => {
  const data = req.body;
  console.log(data);

  if (!data.email_address) {
    return res
      .status(403)
      .json({ data: { message: "Please Enter Valid Email Address" } });
  }
  // Additional email validation logic here

  if (!data.password) {
    return res
      .status(403)
      .json({ data: { message: "Please Enter Valid Password" } });
  }
  // Additional password validation logic here

  try {
    const [user] = await executeQuery(
      "SELECT * FROM UserCollection WHERE email_address = ?",
      [data.email_address]
    );
    if (!user) {
      return res
        .status(403)
        .json({ data: { message: "Invalid Login Credentials" } });
    }

    const passwordIsValid = data.password == user.password;
    if (!passwordIsValid) {
      return res
        .status(403)
        .json({ data: { message: "Invalid Login Credentials" } });
    }

    if (!user.phone_number_verified) {
      return res
        .status(403)
        .json({
          data: {
            message:
              "Your account is pending for verification. Once it's approved, you will be able to access your account.",
          },
        });
    }

    // Generate tokens
    const payload = { userId: user.id }; // Adjust based on your user id field
    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET_KEY,
      { expiresIn: "1d" }
    );
    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET_KEY, {
      expiresIn: "1d",
    });

    // Update user's FCM UserID and last login, if needed
    if (data.fcm_userid) {
      await executeQuery(
        "UPDATE UserCollection SET fcm_userid = ?,token=?, last_login = NOW() WHERE id = ?",
        [data.fcm_userid, refreshToken, user.id]
      );
    }
    res.cookie("refreshToken", refreshToken, { httpOnly: true });
    return res.status(200).json({ data: { ...user, token: refreshToken } }); // Be cautious about what user information you send back!
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ data: { message: "Something went wrong" } });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const email_address = req.body.email_address;
    if (validateEmail(email_address)) {
      const user = await executeQuery(
        "SELECT * FROM UserCollection WHERE email_address = ?",
        [email_address]
      );
      console.log(user);
      if (user.length > 0) {
        const otpCode = otpGenerator.generate(6, {
          specialChars: false,
        });
        await executeQuery(
          "UPDATE UserCollection SET password = ? WHERE email_address = ?",
          [otpCode, email_address]
        );
        sendemail(email_address, otpCode);
        return res.status(200).send({ data: { message: "OTP Sent to Email" } });
      } else {
        return res
          .status(403)
          .send({ data: { message: "Email Address Is Not Registered" } });
      }
    } else {
      return res.status(403).send({ data: { message: "Invalid Email" } });
    }
  } catch (err) {
    console.error(err);
    return res
      .status(403)
      .json({ data: { message: "Unable To Send Password" } });
  }
};

const validateUser = async (req, res) => {
  const userId = req.headers.userid;
  const userToken = req.headers.usertoken;
  try {
    // Verify the user token
    const decoded = jwt.verify(userToken, process.env.REFRESH_TOKEN_SECRET_KEY);

    // Retrieve user data from the database based on userId
    const [userData] = await executeQuery(
      "SELECT * FROM UserCollection WHERE id = ?",
      [userId]
    );

    // Check if the decoded userId matches the provided userId and user data exists
    if (decoded.userId === userId && userData) {
      return res.json({ status: true, userData: userData });
    }

    res.json({ status: false });
  } catch (err) {
    console.log(err);
    res.json({ status: false });
  }
};

const ValidateUser = async (userId, userToken) => {
  try {
    // Verify the user token
    const decoded = jwt.verify(userToken, process.env.REFRESH_TOKEN_SECRET_KEY);

    // Retrieve user data from the database based on userId
    const [userData] = await executeQuery(
      "SELECT * FROM UserCollection WHERE id = ?",
      [userId]
    );

    // Check if the decoded userId matches the provided userId and user data exists
    if (decoded.userId === userId && userData) {
      return true; // User is valid
    }

    return false; // User is not valid
  } catch (err) {
    return false; // Error occurred, user is not valid
  }
};

const updateProfile = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const data = req.body;
      const user = await executeQuery(
        "SELECT * FROM UserCollection WHERE id = ?",
        [headerUserId]
      );
      if (user.length > 0) {
        const updateUserQuery = `
          UPDATE UserCollection 
          SET first_name = ?, last_name = ?, email_address = ?, phone_number = ?
          WHERE id = ?
        `;
        await executeQuery(updateUserQuery, [
          data.first_name,
          data.last_name,
          data.email_address,
          data.phone_number,
          headerUserId,
        ]);
        const updatedUser = await executeQuery(
          "SELECT * FROM UserCollection WHERE id = ?",
          [headerUserId]
        );
        return res.status(200).json({ data: updatedUser });
      } else {
        const output = { data: { message: "User not found" } };
        return res.status(403).json(output);
      }
    } catch (err) {
      console.error(err);
      const output = { data: { message: "Something Went Wrong" } };
      return res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const changePassword = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const data = req.body;
      const user = await executeQuery(
        "SELECT * FROM UserCollection WHERE id = ?",
        [headerUserId]
      );
      if (user.length > 0) {
        const oldPassword = user[0].password;
        const errors = [];
        if (!data.new_password) {
          errors.push("Invalid New Password");
        } else if (data.repeat_password !== data.new_password) {
          errors.push("New Password and Repeat Password Didn't Match");
        } else if (data.old_password !== oldPassword) {
          errors.push("Old Password Didn't Match");
        }
        if (errors.length > 0) {
          const output = { data: { message: errors[0] } };
          return res.status(403).json(output);
        }
        if (data.old_password === oldPassword) {
          const updatePasswordQuery = `
            UPDATE UserCollection
            SET password = ?
            WHERE id = ?
          `;
          await executeQuery(updatePasswordQuery, [
            data.new_password,
            headerUserId,
          ]);
          return res.status(200).json({ data: "Password Changed" });
        } else {
          const output = { data: { message: "Old Password Didn't Match" } };
          return res.status(403).json(output);
        }
      } else {
        const output = { data: { message: "User not found" } };
        return res.status(403).json(output);
      }
    } catch (err) {
      console.error(err);
      const output = { data: { message: "Something Went Wrong" } };
      return res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

module.exports = {
  signup,
  login,
  forgotPassword,
  validateUser,
  updateProfile,
  ValidateUser,
  changePassword,
};
