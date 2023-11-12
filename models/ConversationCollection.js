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

const Conversation = mongoose.model("Chat", chatSchema);

module.exports = Conversation;
