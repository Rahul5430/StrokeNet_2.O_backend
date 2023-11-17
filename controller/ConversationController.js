const Centers = require("../models/CentersCollection");
const Hubs = require("../models/HubsCollection");
const User = require("../models/UserCollection");
const {
  Conversation,
  UsersConversations,
} = require("../models/ConversationCollection");

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
          phone_number_verified: true,
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
    try {
      const savedMsg = await Conversation.insertMany([message]);
      // console.log(message);
      res.status(200).send({ data: savedMsg[0] });
      const key1 = message.recieverId + "-" + message.senderId;
      const key2 = message.senderId + "-" + message.recieverId;
      const uniqueKey = key1 > key2 ? key1 : key2;
      const Convo = await UsersConversations.findOne({ uniqueKey: uniqueKey });
      if (!Convo) {
        await UsersConversations.insertMany([
          {
            uniqueKey: uniqueKey,
            last_message: message.message,
            created: Date.now(),
          },
        ]);
      } else {
        Convo.last_message = message.message;
        Convo.created = Date.now();
        await Convo.save();
      }
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
    const users = await UsersConversations.find({
      uniqueKey: { $regex: headerUserId },
    });
    const ConvoUsers = {
      active: [],
      archived: [],
    };
    for (const userMessage of users) {
      const Id1 = userMessage.uniqueKey.split("-")[0];
      const Id2 = userMessage.uniqueKey.split("-")[1];
      const userId = Id1 == headerUserId ? Id2 : Id1;
      const user = await User.findById(userId);
      const modifiedUser = {
        friend_info: { username: user.fullname, user_id: user._id },
        last_message: userMessage.last_message,
        last_message_at: userMessage.created,
        already_read: userMessage.unreadMsg,
      };
      if (user.online_status) ConvoUsers.active.push(modifiedUser);
      else ConvoUsers.archived.push(modifiedUser);
    }
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
