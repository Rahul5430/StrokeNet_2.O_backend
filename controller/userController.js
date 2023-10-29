const User = require("../models/UserCollection");

const changeOnlineStatus = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if ((headerUserId, headerUserToken)) {
    const getUser = await User.findById(headerUserId);
    if (getUser) {
      if (getUser.online_status) {
        getUser.online_status = false;
        await getUser.save();
        const output = { data: { status: "Offline", user_data: getUser } };
        return res.status(200).json(output);
      } else {
        getUser.online_status = true;
        await getUser.save();
        const output = { data: { status: "Online", user_data: getUser } };
        return res.status(200).json(output);
      }
    } else {
      const output = { data: { message: "User not found" } };
      return res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const GetUsersForAdmin = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if ((headerUserId, headerUserToken)) {
    const getUser = await User.findById(headerUserId);
    console.log(getUser);
    if (getUser && getUser.admin) {
      const VerifiedUsers = await User.find({
        phone_number_verified: true,
        _id: { $ne: headerUserId },
      });
      const RequestedUsers = await User.find({
        phone_number_verified: false,
      });
      const output = {
        data: { VerifiedUsers: VerifiedUsers, RequestedUsers: RequestedUsers },
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

const UserVerification = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const getUser = await User.findById(headerUserId);
    console.log(getUser);
    if (getUser && getUser.admin) {
      const UserToVerifyId = req.body.verifyuserId;
      const UserVerify = await User.findById(UserToVerifyId);
      if (UserVerify) {
        UserVerify.phone_number_verified = !UserVerify.phone_number_verified;
        await UserVerify.save();
      } else {
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
        data: { VerifiedUsers: VerifiedUsers, RequestedUsers: RequestedUsers },
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

module.exports = { changeOnlineStatus, GetUsersForAdmin, UserVerification };