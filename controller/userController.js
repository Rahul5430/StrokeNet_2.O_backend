const User = require("../models/UserCollection");
const { ValidateUser } = require("./authController");
const {executeQuery}  = require("../config/sqlDatabase");

const changeOnlineStatus = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const user = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [headerUserId]);
      if (user.length === 0) {
        return res.status(403).json({ data: { message: "User not found" } });
      }

      const onlineStatus = user[0].online_status === 1 ? false : true;

      await executeQuery('UPDATE UserCollection SET online_status = ? WHERE id = ?', [onlineStatus, headerUserId]);

      const updatedUser = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [headerUserId]);

      const statusMessage = onlineStatus ? "Online" : "Offline";

      return res.status(200).json({
        data: { status: statusMessage, user_data: updatedUser[0] },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ data: { message: "Internal Server Error" } });
    }
  } else {
    return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const GetUsersForAdmin = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const user = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [headerUserId]);
      if (user.length === 0) {
        return res.status(403).json({ data: { message: "User not found" } });
      }
      if (user[0].admin) {
        const verifiedUsers = await executeQuery('SELECT * FROM UserCollection WHERE phone_number_verified = ? AND id != ?', [true, headerUserId]);
        const requestedUsers = await executeQuery('SELECT * FROM UserCollection WHERE phone_number_verified = ?', [false]);

        return res.status(200).json({
          data: { VerifiedUsers: verifiedUsers, RequestedUsers: requestedUsers },
        });
      } else {
        return res.status(403).json({ data: { message: "User NOT Found or not Admin" } });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ data: { message: "Internal Server Error" } });
    }
  } else {
    return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const UserVerification = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const user = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [headerUserId]);
      if (user.length === 0) {
        return res.status(403).json({ data: { message: "User not found" } });
      }
      if (user[0].admin) {
        const userToVerifyId = req.body.verifyuserId;
        const userToVerify = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [userToVerifyId]);
        if (userToVerify.length === 0) {
          return res.status(403).json({ data: { message: "User NOT Found" } });
        }
        const newVerificationStatus = !userToVerify[0].phone_number_verified;
        await executeQuery('UPDATE UserCollection SET phone_number_verified = ? WHERE id = ?', [newVerificationStatus, userToVerifyId]);

        const verifiedUsers = await executeQuery('SELECT * FROM UserCollection WHERE phone_number_verified = ? AND id != ?', [true, headerUserId]);
        const requestedUsers = await executeQuery('SELECT * FROM UserCollection WHERE phone_number_verified = ?', [false]);

        return res.status(200).json({
          data: {
            message: "User Verification status changed",
            VerifiedUsers: verifiedUsers,
            RequestedUsers: requestedUsers,
          },
        });
      } else {
        return res.status(403).json({ data: { message: "User NOT Found or not Admin" } });
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ data: { message: "Internal Server Error" } });
    }
  } else {
    return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const RemoveUser = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    const getUser = await User.findById(headerUserId);
    // console.log(getUser);
    if (getUser && getUser.admin) {
      const UserToVerifyId = req.body.verifyuserId;
      const UserVerify = await User.deleteOne({ _id: UserToVerifyId });
      if (!UserVerify) {
        const output = { data: { message: "User NOT Found" } };
        return res.status(403).json(output);
      }
      const VerifiedUsers = await User.find({
        phone_number_verified: true,
        _id: { $ne: headerUserId },
      });
      const RequestedUsers = await User.find({
        phone_number_verified: false,
      });
      const output = {
        data: {
          message: "User Removed",
          VerifiedUsers: VerifiedUsers,
          RequestedUsers: RequestedUsers,
        },
      };
      return res.status(200).json(output);
    } else {
      const output = { data: { message: "User NOT Found or Admin" } };
      return res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const RemoveUserFcm = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  try {
    // Validate user credentials
    if (await ValidateUser(headerUserId, headerUserToken)) {
      // Retrieve user data from the database based on userId
      const [userData] = await executeQuery('SELECT * FROM UserCollection WHERE id = ?', [headerUserId]);
      if (userData) {
        // Update fcm_userid to empty string
        await executeQuery('UPDATE UserCollection SET fcm_userid = ? WHERE id = ?', ['', headerUserId]);
        res.status(200).json({ data: "FCM Removed" });
      } else {
        // User not found in the database
        res.status(404).json({ data: { message: "User not found" } });
      }
    } else {
      // Invalid credentials
      res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
    }
  } catch (err) {
    // Error occurred during execution
    console.error("Error:", err);
    res.status(500).json({ data: { message: "Internal Server Error" } });
  }
};

module.exports = {
  changeOnlineStatus,
  GetUsersForAdmin,
  UserVerification,
  RemoveUser,
  RemoveUserFcm,
};
