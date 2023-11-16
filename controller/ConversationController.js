const Centers = require("../models/CentersCollection");
const Hubs = require("../models/HubsCollection");
const User = require("../models/UserCollection");
const Conversation = require("../models/ConversationCollection");

const fetchAllOnlineUsers = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    try {
      const user = await User.findById(headerUserId);
      const getCenter = user.center_id;
      let centers = [];
      if (getCenter.is_hub == "yes") {
        centers = await Centers.find({
          $or: [
            { main_hub: getCenter.id },
            { $and: [{ is_hub: "yes" }, { id: getCenter.id }] },
          ],
        });
      } else {
        const getHubIdFromCenter = await Hubs.findOne({
          id: getCenter.main_hub,
        });
        centers = await Centers.find({
          $or: [
            { main_hub: getHubIdFromCenter.id },
            { $and: [{ is_hub: "yes" }, { id: getHubIdFromCenter.id }] },
          ],
        });
      }
      const OnlineUsers = [
        // {
        //   center_name: "Pgi",
        //   online_users: [
        //     {
        //       fullname: "Nitin",
        //       user_department: "Hub",
        //       phone_number: "9350130449",
        //       user_id: "6541ffb48cbab833d4c4e986",
        //       user_role: "Resident",
        //     },
        //   ],
        // },
      ];
      for (let i = 0; i < centers.length; i++) {
        const center = centers[i];
        const onlineUsersOfCenter = await User.find({
          center_id: center,
          online_status: true,
          _id: { $ne: user._id },
        });
        if (onlineUsersOfCenter.length > 0) {
          OnlineUsers.push({
            center_name: center.center_name,
            online_users: onlineUsersOfCenter,
          });
        }
      }
      res.status(200).send({ data: OnlineUsers });
    } catch (err) {
      res.status(403).send({ data: { message: "Something Went Wrong" } });
      console.log(err);
    }
  } else {
    res.send(403).send({ data: { message: "Session Expired" } });
  }
};

const sendMessage = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const message = req.body;
    console.log(message);
    try {
      const savedMsg = await Conversation.insertMany([message]);
      res.status(200).send({ data: savedMsg[0] });
    } catch (err) {
      console.log(err);
      res.status(403).send("Something Went Wrong");
    }
  } else {
    res.status(403).send("Something Went Wrong");
  }
};

const getConversation = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const otherUserId = req.body.recieverId;
    try {
      const Messages = await Conversation.find({
        $or: [
          { $and: [{ recieverId: headerUserId }, { senderId: otherUserId }] },
          { $and: [{ senderId: headerUserId }, { recieverId: otherUserId }] },
        ],
      });
      res.status(200).send({ data: Messages });
    } catch (err) {
      console.log(err);
      res.status(403).send("Something Went Wrong");
    }
  } else {
    res.status(403).send("Something Went Wrong");
  }
};

const UserConversation = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const users = await Conversation.distinct("senderId", {
      $or: [{ senderId: headerUserId }, { recieverId: headerUserId }],
    }).distinct("recieverId", {
      $or: [{ senderId: headerUserId }, { recieverId: headerUserId }],
    });
    const ConvoUsers = {
      active: [],
      archived: [],
    };
    for (const userId of users) {
      if (userId == headerUserId) {
        continue;
      }
      const user = await User.findById(userId);
      const modifiedUser = {
        friend_info: { username: user.fullname, user_id: user._id },
        last_message: "random",
        last_message_at: "987654",
        already_read: true,
      };
      // console.log(modifiedUser);
      if (user.online_status) ConvoUsers.active.push(modifiedUser);
      else ConvoUsers.archived.push(modifiedUser);
    }
    // console.log(ConvoUsers);
    res.status(200).send({ data: ConvoUsers });
  } else {
    res.status(403).send({ data: { message: "Something Went Wrong" } });
  }
};

module.exports = {
  fetchAllOnlineUsers,
  sendMessage,
  getConversation,
  UserConversation,
};
