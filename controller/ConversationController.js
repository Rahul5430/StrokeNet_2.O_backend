const Centers = require("../models/CentersCollection");
const Hubs = require("../models/HubsCollection");
const User = require("../models/UserCollection");
const {
  Conversation,
  UsersConversations,
} = require("../models/ConversationCollection");
const { ValidateUser } = require("./authController");
const { executeQuery } = require("../config/sqlDatabase");

const fetchAllOnlineUsers = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const user = await executeQuery(
        "SELECT * FROM UserCollection WHERE id = ?",
        [headerUserId]
      );
      if (user.length === 0) {
        return res.status(403).send({ data: { message: "User not found" } });
      }
      const centerId = user[0].center_id;
      let centers = [];
      if (user[0].is_hub === "yes") {
        centers = await executeQuery(
          "SELECT * FROM CentersCollection WHERE main_hub = ? OR (is_hub = ? AND id = ?)",
          [centerId, "yes", centerId]
        );
      } else {
        const hubIdResult = await executeQuery(
          "SELECT main_hub FROM CentersCollection WHERE id = ?",
          [centerId]
        );
        const hubId = hubIdResult[0].main_hub;
        centers = await executeQuery(
          "SELECT * FROM CentersCollection WHERE main_hub = ? OR (is_hub = ? AND id = ?)",
          [hubId, "yes", hubId]
        );
      }
      const OnlineUsers = [];
      for (let i = 0; i < centers.length; i++) {
        const center = centers[i];
        const onlineUsersOfCenter = await executeQuery(
          "SELECT * FROM UserCollection WHERE center_id = ? AND online_status = ? AND id != ? AND phone_number_verified = ?",
          [center.id, true, headerUserId, true]
        );
        if (onlineUsersOfCenter.length > 0) {
          OnlineUsers.push({
            center_name: center.center_name,
            online_users: onlineUsersOfCenter,
          });
        }
      }
      // console.log(OnlineUsers);
      res.status(200).send({ data: OnlineUsers });
    } catch (err) {
      console.error(err);
      res.status(500).send({ data: { message: "Internal Server Error" } });
    }
  } else {
    res.status(403).send({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const sendMessage = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    const message = req.body;

    try {
      // Format the created datetime
      const formattedDateTime = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      // Insert message into Conversation table
      const insertMessageQuery = `
        INSERT INTO Conversation (senderId, recieverId, message, read_by_user, created)
        VALUES (?, ?, ?, ?, ?)
      `;
      const insertMessageData = [
        message.senderId,
        message.recieverId,
        message.message,
        false,
        formattedDateTime,
      ];
      await executeQuery(
        insertMessageQuery,
        insertMessageData
      );
      // Insert or update UsersConversations table
      const key1 = message.recieverId + "-connect-" + message.senderId;
      const key2 = message.senderId + "-connect-" + message.recieverId;
      const uniqueKey = key1 > key2 ? key1 : key2;

      const convo = await executeQuery(
        "SELECT * FROM UsersConversations WHERE uniqueKey = ?",
        [uniqueKey]
      );

      if (convo.length === 0) {
        // Insert into UsersConversations table
        const insertConvoQuery = `
          INSERT INTO UsersConversations (uniqueKey, last_message, unreadMsg, created)
          VALUES (?, ?, ?, ?)
        `;
        const insertConvoData = [
          uniqueKey,
          message.message,
          0,
          formattedDateTime,
        ];
        await executeQuery(insertConvoQuery, insertConvoData);
      } else {
        // Update UsersConversations table
        const updateConvoQuery = `
          UPDATE UsersConversations
          SET last_message = ?, created = ?
          WHERE uniqueKey = ?
        `;
        const updateConvoData = [message.message, formattedDateTime, uniqueKey];
        await executeQuery(updateConvoQuery, updateConvoData);
      }

      res.status(200).json({ data: message });
    } catch (err) {
      console.error(err);
      res.status(403).json({ data: { message: "Something Went Wrong" } });
    }
  } else {
    res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const getConversation = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    const otherUserId = req.body.recieverId;

    try {
      // Query to fetch messages between two users
      const getMessagesQuery = `
        SELECT * FROM Conversation 
        WHERE (senderId = ? AND recieverId = ?) 
        OR (senderId = ? AND recieverId = ?)
        ORDER BY created ASC
      `;
      const getMessagesData = [
        headerUserId,
        otherUserId,
        otherUserId,
        headerUserId,
      ];
      const messages = await executeQuery(getMessagesQuery, getMessagesData);

      res.status(200).json({ data: messages });
    } catch (err) {
      console.error(err);
      res.status(500).json({ data: { message: "Something Went Wrong" } });
    }
  } else {
    res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const UserConversation = async (req, res) => {
  const headerUserId = req.headers.userid;
  console.log(headerUserId);
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      // Query to fetch conversations
      const getConversationsQuery = `
      
      SELECT 
      *
  FROM 
      UsersConversations
  WHERE 
      uniqueKey LIKE CONCAT('%', '${headerUserId}', '-connect-%') 
      OR uniqueKey LIKE CONCAT('%', '-connect-', '${headerUserId}')
    `;

      const getConversationsData = [];

      const conversations = await executeQuery(
        getConversationsQuery,
        getConversationsData
      );

      console.log(conversations);

      // Prepare response data
      const ConvoUsers = {
        active: [],
        archived: [],
      };
      for (const conversation of conversations) {
        const userId = conversation.uniqueKey.split("-connect-").find((id) => id !== headerUserId);
      
        const getUserQuery = `
          SELECT
            u.fullname AS username,
            u.id AS user_id
          FROM UserCollection u
          WHERE u.id = ?
        `;
        const getUserData = [userId];
        const friend = await executeQuery(getUserQuery, getUserData);
      
        const modifiedUser = {
          friend_info: friend[0],
          last_message: conversation.last_message,
          last_message_at: conversation.created,
          already_read: conversation.unreadMsg,
        };
      
        if (conversation.online_status === true || 1) {
          ConvoUsers.active.push(modifiedUser);
        } else {
          ConvoUsers.archived.push(modifiedUser);
        }
      }
      res.status(200).json({ data: ConvoUsers });
    } catch (err) {
      console.error(err);
      res.status(500).json({ data: { message: "Something Went Wrong" } });
    }
  } else {
    res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

module.exports = {
  fetchAllOnlineUsers,
  sendMessage,
  getConversation,
  UserConversation,
};
