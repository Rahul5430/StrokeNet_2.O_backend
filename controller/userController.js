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

module.exports = { changeOnlineStatus };
