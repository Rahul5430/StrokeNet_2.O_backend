const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    senderId: {
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: "User",
      type: String,
    },
    recieverId: {
      //   type: mongoose.Schema.Types.ObjectId,
      //   ref: "User",
      type: String,
    },
    message: {
      type: String,
      required: true,
    },
    read_by_user: {
      type: Boolean,
      default: false,
    },
    created: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const convoSchema = new mongoose.Schema(
  {
    uniqueKey: {
      type: String,
    },
    last_message: {
      type: String,
    },
    unreadMsg: {
      type: Number,
      default: 0,
    },
    created: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Conversation = mongoose.model("Chat", chatSchema);
const UsersConversations = mongoose.model("UserConversation", convoSchema);

module.exports = { Conversation, UsersConversations };
